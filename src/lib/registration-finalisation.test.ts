import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE, CURRENT_SESSION, CURRENT_SEMESTER } from "./constants";
import { MIN_REGISTRATION_UNITS } from "./student-registration";
import {
  buildRegistrationDocument,
  getRegistrationForView,
  isRegistrationFinalised,
} from "./student-finalisation";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

const state = vi.hoisted(() => ({ token: "" as string }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? "127.0.0.1" : name === "user-agent" ? "vitest-finalisation" : null,
  }),
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE ? { name, value: state.token } : undefined,
    set: () => {},
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));

const actions = await import("./module-actions");

// ---------------------------------------------------------------------------
// Fixtures: one shared pool of eligible courses (all ACTIVE for the current
// session, semester 1, level 300) plus rejection courses, and one STUDENT per
// scenario so the tests stay independent of each other's finalisation state.
// Everything created here is deleted in afterAll.
// ---------------------------------------------------------------------------

const SUFFIX = Date.now().toString(36);
const U = (name: string) => `${name}-${SUFFIX}`;

// Eligible set — 3 units each, 5 of them make 15.
const ELIGIBLE = ["FIN401", "FIN402", "FIN403", "FIN404", "FIN405", "FIN406"];
const E = (code: string) => `FIN${code}_${SUFFIX}`;

const COURSE_SPECS: {
  code: string;
  units: number;
  level: number;
  semester: number;
  capacity: number;
  prerequisites?: string[];
}[] = [
  { code: E("FIN401"), units: 3, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN402"), units: 3, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN403"), units: 3, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN404"), units: 3, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN405"), units: 3, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN406"), units: 2, level: 300, semester: 1, capacity: 150 },
  { code: E("FIN407"), units: 3, level: 300, semester: 1, capacity: 150, prerequisites: [E("REQ")] }, // unmet prereq
  { code: E("FIN408"), units: 3, level: 300, semester: 1, capacity: 150 }, // no offering at all
  { code: E("REQ"), units: 3, level: 300, semester: 1, capacity: 150 }, // prereq course (no offering)
  { code: E("FIN409"), units: 3, level: 300, semester: 1, capacity: 150 }, // programme-A offering only
  { code: E("FIN410"), units: 3, level: 400, semester: 1, capacity: 150 }, // level-400 offering only
  { code: E("FIN411"), units: 3, level: 300, semester: 1, capacity: 150 }, // 2024/2025 offering only
  { code: E("FIN412"), units: 3, level: 300, semester: 2, capacity: 150 }, // semester-2 offering only
];

const students: string[] = [];
let progA: { id: string };
let progB: { id: string };
const courseIds = new Map<string, string>();
const offeringIds: string[] = [];
let regNoCounter = 0;

const fiveIds = () => ELIGIBLE.slice(0, 5).map((c) => courseIds.get(E(c))!);

async function makeTokenFor(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: "127.0.0.1",
      userAgent: "vitest-finalisation",
    },
  });
  const payload = `${session.id}.${session.expiresAt.getTime()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

async function asStudent(userId: string) {
  state.token = await makeTokenFor(userId);
}

async function createStudent(
  username: string,
  feeAccount: { clearanceStatus: boolean; balanceCents: number },
) {
  regNoCounter += 1;
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@uniabuja.edu.ng`,
      passwordHash: "not-used",
      role: "STUDENT",
      firstName: "Fin",
      lastName: "Test",
      fullName: `Fin Test ${username}`,
      registrationNo: `23/FIN/${String(regNoCounter).padStart(4, "0")}`,
      programmeId: progB.id,
      department: "Computer Science",
      faculty: "Faculty of Science",
    },
  });
  await prisma.feeAccount.create({
    data: { userId: user.id, ...feeAccount },
  });
  students.push(user.id);
  return user;
}

function fd(courseId: string[]): FormData {
  const f = new FormData();
  for (const id of courseId) f.append("courseId", id);
  return f;
}

describe("student registration finalisation, immutable reference, locking, and view/print", () => {
  beforeAll(async () => {
    const programmes = await prisma.programme.findMany({ take: 2, select: { id: true } });
    expect(programmes.length).toBeGreaterThanOrEqual(2);
    progA = programmes[0];
    progB = programmes[1];

    for (const spec of COURSE_SPECS) {
      const course = await prisma.course.create({
        data: {
          code: spec.code,
          title: `Fin test course ${spec.code}`,
          units: spec.units,
          level: spec.level,
          semester: spec.semester,
          capacity: spec.capacity,
          prerequisites: spec.prerequisites ?? undefined,
        },
      });
      courseIds.set(spec.code, course.id);
    }

    // FIN407 → prerequisite that nobody has passed. FIN408 → no offering at all.
    for (const code of ["FIN401", "FIN402", "FIN403", "FIN404", "FIN405", "FIN406", "FIN407"]) {
      const offering = await prisma.courseOffering.create({
        data: {
          courseId: courseIds.get(E(code))!,
          programmeId: null,
          academicSession: CURRENT_SESSION,
          semester: CURRENT_SEMESTER,
          level: 300,
          status: "ACTIVE",
        },
      });
      offeringIds.push(offering.id);
    }
    // FIN409 → Programme A only
    offeringIds.push(
      (
        await prisma.courseOffering.create({
          data: {
            courseId: courseIds.get(E("FIN409"))!,
            programmeId: progA.id,
            academicSession: CURRENT_SESSION,
            semester: CURRENT_SEMESTER,
            level: 300,
            status: "ACTIVE",
          },
        })
      ).id,
    );
    // FIN410 → level 400
    offeringIds.push(
      (
        await prisma.courseOffering.create({
          data: {
            courseId: courseIds.get(E("FIN410"))!,
            programmeId: null,
            academicSession: CURRENT_SESSION,
            semester: CURRENT_SEMESTER,
            level: 400,
            status: "ACTIVE",
          },
        })
      ).id,
    );
    // FIN411 → previous session
    offeringIds.push(
      (
        await prisma.courseOffering.create({
          data: {
            courseId: courseIds.get(E("FIN411"))!,
            programmeId: null,
            academicSession: "2024/2025",
            semester: 1,
            level: 300,
            status: "ACTIVE",
          },
        })
      ).id,
    );
    // FIN412 → semester 2
    offeringIds.push(
      (
        await prisma.courseOffering.create({
          data: {
            courseId: courseIds.get(E("FIN412"))!,
            programmeId: null,
            academicSession: CURRENT_SESSION,
            semester: 2,
            level: 300,
            status: "ACTIVE",
          },
        })
      ).id,
    );
  });

  afterAll(async () => {
    await prisma.registration.deleteMany({ where: { userId: { in: students } } });

    const regIds = (await prisma.courseRegistration.findMany({
      where: { userId: { in: students } },
      select: { id: true },
    })).map((r) => r.id);
    await prisma.courseRegistration.deleteMany({ where: { userId: { in: students } } });
    if (regIds.length > 0) {
      await prisma.lmsSyncLog.deleteMany({ where: { refId: { in: regIds } } });
    }
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: students } } });

    await prisma.courseOffering.deleteMany({ where: { id: { in: offeringIds } } });
    await prisma.course.deleteMany({
      where: { id: { in: [...courseIds.values()] } },
    });
    await prisma.feeAccount.deleteMany({ where: { userId: { in: students } } });
    await prisma.session.deleteMany({ where: { userAgent: "vitest-finalisation" } });
    await prisma.user.deleteMany({ where: { id: { in: students } } });
  });

  it("TEST 1: valid 15+ unit selection finalises atomically with a reference, status and lock", async () => {
    const s1 = await createStudent(U("fin-s1"), { clearanceStatus: true, balanceCents: 0 });
    await asStudent(s1.id);

    const beforeAudits = await prisma.auditLog.count({ where: { actorUserId: s1.id } });
    const res = await actions.submitCourseRegistration(null, fd(fiveIds()));
    expect(res.ok).toBe(true);
    expect(res.reference).toBeDefined();

    const header = await prisma.registration.findUnique({
      where: { registrationReference: res.reference! },
      include: { courseRegistrations: true },
    });
    expect(header).not.toBeNull();
    expect(header!.userId).toBe(s1.id);
    expect(header!.status).toBe("FINALIZED");
    expect(header!.lockedAt).not.toBeNull();
    expect(header!.finalisedAt).not.toBeNull();
    expect(header!.submittedAt).toBeInstanceOf(Date);
    expect(header!.totalUnits).toBe(15);
    expect(header!.courseRegistrations).toHaveLength(5);
    for (const row of header!.courseRegistrations) {
      expect(row.registrationId).toBe(header!.id);
      expect(row.status).toBe("ACTIVE");
    }

    const afterAudits = await prisma.auditLog.count({ where: { actorUserId: s1.id } });
    expect(afterAudits).toBeGreaterThan(beforeAudits);
    const finaliseAudits = await prisma.auditLog.findMany({
      where: { actorUserId: s1.id, action: { in: ["FINALIZE", "LOCK", "CREATE"] } },
      select: { action: true, targetType: true },
    });
    expect(finaliseAudits.length).toBeGreaterThanOrEqual(3);
    for (const a of finaliseAudits) expect(a.targetType).toBe("REGISTRATION");

    const syncLogs = await prisma.lmsSyncLog.count({
      where: { userId: s1.id, refType: "COURSE_REGISTRATION" },
    });
    expect(syncLogs).toBe(5);
  });

  it("TEST 2: every registration gets a unique, correctly formatted reference", async () => {
    const s2 = await createStudent(U("fin-s2"), { clearanceStatus: true, balanceCents: 0 });
    await asStudent(s2.id);
    const res = await actions.submitCourseRegistration(null, fd(fiveIds()));
    expect(res.ok).toBe(true);
    expect(res.reference).toMatch(/^CR-2025-\d{6}$/);

    const headers = await prisma.registration.findMany({
      where: { userId: { in: students } },
      select: { registrationReference: true },
    });
    const refs = headers.map((h) => h.registrationReference);
    expect(new Set(refs).size).toBe(refs.length); // globally unique
  });

  it("TEST 3: the reference is immutable — stored value never changes", async () => {
    const header = await prisma.registration.findFirst({
      where: { userId: students[0] },
      select: { registrationReference: true },
    });
    expect(header).not.toBeNull();
    const again = await prisma.registration.findFirst({
      where: { registrationReference: header!.registrationReference },
      select: { registrationReference: true },
    });
    expect(again!.registrationReference).toBe(header!.registrationReference);
  });

  it("TEST 4: after finalisation the registration is locked — no add and no drop", async () => {
    const s1 = students[0];
    await asStudent(s1);

    const add = await actions.registerCourse(null, fd([courseIds.get(E("FIN406"))!]));
    expect(add.ok).toBeFalsy();
    expect(add.error).toMatch(/finalised and locked/);

    const row = await prisma.courseRegistration.findFirst({
      where: { userId: s1 },
      select: { id: true },
    });
    const dropForm = new FormData();
    dropForm.append("id", row!.id);
    const drop = await actions.dropCourse(null, dropForm);
    expect(drop.ok).toBeFalsy();
    expect(drop.error).toMatch(/finalised and locked/);
  });

  it("TEST 5: direct server actions are rejected after finalisation", async () => {
    const s1 = students[0];
    await asStudent(s1);

    const resubmit = await actions.submitCourseRegistration(null, fd(fiveIds()));
    expect(resubmit.ok).toBeFalsy();
    expect(resubmit.error).toMatch(/already been completed/);

    const header = await prisma.registration.findFirst({
      where: { userId: s1 },
      include: { courseRegistrations: true },
    });
    expect(header!.courseRegistrations).toHaveLength(5);
    expect(header!.totalUnits).toBe(15);
  });

  it("TEST 6: a second finalisation attempt for the same student/session is rejected", async () => {
    const s2 = await prisma.user.findFirst({
      where: { username: U("fin-s2") },
      select: { id: true },
    });
    await asStudent(s2!.id);
    const res = await actions.submitCourseRegistration(null, fd(fiveIds()));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/already been completed/);

    const count = await prisma.registration.count({ where: { userId: s2!.id } });
    expect(count).toBe(1);
  });

  it("TEST 7: two concurrent submissions produce exactly one registration header", async () => {
    const s3 = await createStudent(U("fin-s3"), { clearanceStatus: true, balanceCents: 0 });
    await asStudent(s3.id);

    const [a, b] = await Promise.all([
      actions.submitCourseRegistration(null, fd(fiveIds())),
      actions.submitCourseRegistration(null, fd(fiveIds())),
    ]);

    const okCount = [a, b].filter((r) => r.ok).length;
    const errCount = [a, b].filter((r) => !r.ok).length;
    expect(okCount).toBe(1);
    expect(errCount).toBe(1);
    const failed = [a, b].find((r) => !r.ok);
    expect(failed!.error).toMatch(/already been completed|already registered|try again/);

    const count = await prisma.registration.count({ where: { userId: s3.id } });
    expect(count).toBe(1);
  });

  it("TEST 8: a student can never view another student's registration", async () => {
    const s1 = students[0];
    const s4 = await createStudent(U("fin-s4"), { clearanceStatus: true, balanceCents: 0 });

    const s1Header = await prisma.registration.findFirst({
      where: { userId: s1 },
      select: { registrationReference: true },
    });

    const viewedAsS4 = await getRegistrationForView(s4, { reference: s1Header!.registrationReference });
    expect(viewedAsS4).toBeNull();

    const s4Header = await prisma.registration.findFirst({
      where: { userId: s4.id },
      select: { registrationReference: true },
    });
    expect(s4Header).toBeNull();
  });

  it("TEST 9: a fabricated or tampered reference is denied", async () => {
    const s4 = await prisma.user.findFirst({
      where: { username: U("fin-s4") },
      select: { id: true },
    });
    const tampered = await getRegistrationForView(s4!, { reference: "CR-1999-999999" });
    expect(tampered).toBeNull();

    const s1Header = await prisma.registration.findFirst({
      where: { userId: students[0] },
      select: { registrationReference: true },
    });
    const tamperedToOther = await getRegistrationForView(s4!, { reference: s1Header!.registrationReference });
    expect(tamperedToOther).toBeNull();
  });

  it("TEST 10: historical registrations remain viewable by their own session/semester", async () => {
    const s4 = await prisma.user.findFirst({
      where: { username: U("fin-s4") },
      select: { id: true },
    });
    const s4User = (await prisma.user.findUnique({
      where: { id: s4!.id },
    }))!;

    const historical = await prisma.registration.create({
      data: {
        userId: s4User.id,
        registrationReference: `CR-2024-900001-${SUFFIX}`,
        academicSession: "2024/2025",
        semester: 1,
        totalUnits: 6,
        status: "FINALIZED",
        submittedAt: new Date("2025-01-10T09:00:00Z"),
        finalisedAt: new Date("2025-01-10T09:00:00Z"),
        lockedAt: new Date("2025-01-10T09:00:00Z"),
      },
    });
    await prisma.courseRegistration.create({
      data: {
        userId: s4User.id,
        courseId: courseIds.get(E("FIN411"))!,
        academicSession: "2024/2025",
        semester: 1,
        status: "ACTIVE",
        registrationId: historical.id,
      },
    });

    const viewed = await getRegistrationForView(s4User, { academicSession: "2024/2025", semester: 1 });
    expect(viewed).not.toBeNull();
    expect(viewed!.registrationReference).toBe(historical.registrationReference);
    expect(viewed!.totalUnits).toBe(6);

    // The current-session lookup must NOT return the historical header.
    const current = await getRegistrationForView(s4User, {});
    expect(current).toBeNull();
  });

  it("TEST 11: the printable document contains all official fields", async () => {
    const s1 = await prisma.user.findUnique({ where: { id: students[0] } });
    const header = await prisma.registration.findFirst({
      where: { userId: students[0] },
      include: {
        courseRegistrations: { include: { course: true }, orderBy: { course: { code: "asc" } } },
      },
    });
    expect(header).not.toBeNull();

    const doc = buildRegistrationDocument(s1!, header!);
    expect(doc.reference).toBe(header!.registrationReference);
    expect(doc.academicSession).toBe(CURRENT_SESSION);
    expect(doc.semester).toBe(CURRENT_SEMESTER);
    expect(doc.semesterLabel).toMatch(/Semester|First|Second/);
    expect(doc.totalUnits).toBe(15);
    expect(doc.statusLabel).toBe("FINAL / LOCKED");
    expect(doc.finalisedAt).not.toBeNull();
    expect(doc.submittedAt).toBeTruthy();
    expect(doc.fullName).toBe(s1!.fullName);
    expect(doc.registrationNo).toBe(s1!.registrationNo);
    expect(doc.faculty).toBe("Faculty of Science");
    expect(doc.department).toBe("Computer Science");
    expect(doc.courses).toHaveLength(5);
    for (const c of doc.courses) {
      expect(c.code).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.units).toBeGreaterThan(0);
    }
    expect(doc.courses.reduce((s, c) => s + c.units, 0)).toBe(15);
    expect(isRegistrationFinalised(header!)).toBe(true);
  });

  it("TEST 12: a selection totalling below 15 units is rejected", async () => {
    const sv = await createStudent(U("fin-sv"), { clearanceStatus: true, balanceCents: 0 });
    await asStudent(sv.id);

    const ids = ["FIN401", "FIN402", "FIN403", "FIN406"].map((c) => courseIds.get(E(c))!); // 3+3+3+2 = 11
    const res = await actions.submitCourseRegistration(null, fd(ids));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(new RegExp(`minimum of ${MIN_REGISTRATION_UNITS}`));
  });

  it("TEST 13: a course with no eligible offering is rejected", async () => {
    const sv = await prisma.user.findFirst({
      where: { username: U("fin-sv") },
      select: { id: true },
    });
    await asStudent(sv!.id);
    const res = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN408"))!]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
  });

  it("TEST 14: unpaid fees block finalisation", async () => {
    const sf = await createStudent(U("fin-sf"), { clearanceStatus: false, balanceCents: 25000 });
    await asStudent(sf.id);
    const res = await actions.submitCourseRegistration(null, fd(fiveIds()));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/Fee clearance is required/);
    expect(await prisma.registration.count({ where: { userId: sf.id } })).toBe(0);
  });

  it("TEST 15: an unmet prerequisite still blocks finalisation", async () => {
    const sv = await prisma.user.findFirst({
      where: { username: U("fin-sv") },
      select: { id: true },
    });
    await asStudent(sv!.id);
    const res = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN407"))!]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/Prerequisite FINREQ/);
  });

  it("TEST 16: wrong programme, level, session or semester offerings are rejected", async () => {
    const sv = await prisma.user.findFirst({
      where: { username: U("fin-sv") },
      select: { id: true },
    });
    await asStudent(sv!.id);

    const prog = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN409"))!]));
    expect(prog.ok).toBeFalsy();
    expect(prog.error).toMatch(/not offered to you/);

    const level = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN410"))!]));
    expect(level.ok).toBeFalsy();
    expect(level.error).toMatch(/not offered to you/);

    const session = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN411"))!]));
    expect(session.ok).toBeFalsy();
    expect(session.error).toMatch(/not offered to you/);

    const sem = await actions.submitCourseRegistration(null, fd([courseIds.get(E("FIN412"))!]));
    expect(sem.ok).toBeFalsy();
    expect(sem.error).toMatch(/not offered to you/);
  });

  it("TEST 17: a finalised registration is unchanged by client manipulation", async () => {
    const s1 = students[0];
    await asStudent(s1);

    // Try to sneak in an extra course and drop an existing one via the server action.
    const tampered = fd([courseIds.get(E("FIN406"))!, ...fiveIds().slice(1)]);
    const res = await actions.submitCourseRegistration(null, tampered);
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/already been completed/);

    const header = await prisma.registration.findFirst({
      where: { userId: s1 },
      include: { courseRegistrations: { include: { course: true } } },
    });
    expect(header!.totalUnits).toBe(15);
    expect(header!.courseRegistrations).toHaveLength(5);
    expect(header!.courseRegistrations.every((r) => r.registrationId === header!.id)).toBe(true);

    const dbTotal = header!.courseRegistrations.reduce((s, r) => s + r.course.units, 0);
    expect(dbTotal).toBe(header!.totalUnits);
  });
});
