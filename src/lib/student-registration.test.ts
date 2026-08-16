import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE, CURRENT_SESSION, CURRENT_SEMESTER } from "./constants";
import { MIN_REGISTRATION_UNITS } from "./student-registration";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

const state = vi.hoisted(() => ({ token: "" as string }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? "127.0.0.1" : name === "user-agent" ? "vitest-registration" : null,
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
const registration = await import("./student-registration");

// ---------------------------------------------------------------------------
// Test fixtures:
//  - Student A (level 300, programme B): used for every validation-rejection
//    test and for the final success/finalisation test (which must run LAST —
//    once A finalises, the session becomes locked and every later submission
//    would be rejected as "already completed").
//  - Student B (level 300, programme B): used for the post-activation LMS test
//    and the audit-atomicity duplicate test (needs an already-ACTIVE row that
//    would otherwise be created by A's success test).
// Everything created here is deleted in afterAll.
// ---------------------------------------------------------------------------

const SUFFIX = Date.now().toString(36);
const USERNAME = `REG-TEST-${SUFFIX}`;
const EMAIL = `reg-test-${SUFFIX}@uniabuja.edu.ng`;
const REG_NO = "23/TEST/0001"; // admitted 2023 → level 300 (max 400)
const USERNAME_B = `REG-TEST-B-${SUFFIX}`;
const EMAIL_B = `reg-test-b-${SUFFIX}@uniabuja.edu.ng`;
const REG_NO_B = "23/TEST/0002";

const COURSE_SPECS: {
  code: string;
  units: number;
  level: number;
  semester: number;
  capacity: number;
  prerequisites?: string[];
}[] = [
  { code: `TEST101_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // no offering at all
  { code: `TEST102_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // INACTIVE offering
  { code: `TEST103_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // programme-A offering
  { code: `TEST104_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // level-400 offering
  { code: `TEST105_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // 2024/2025 offering
  { code: `TEST106_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // semester-2 offering
  { code: `TEST401_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // eligible
  { code: `TEST402_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // eligible
  { code: `TEST403_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // eligible
  { code: `TEST404_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // eligible
  { code: `TEST405_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150 }, // eligible
  { code: `TEST406_${SUFFIX}`, units: 2, level: 300, semester: 1, capacity: 150 }, // eligible (2 units)
  { code: `TEST407_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 150, prerequisites: ["CSC301"] }, // unmet prereq
  { code: `TEST408_${SUFFIX}`, units: 3, level: 300, semester: 1, capacity: 0 }, // capacity 0
];

let studentId: string;
let studentBId: string;
let progA: { id: string };
let progB: { id: string };
const courses = new Map<string, { id: string; code: string; units: number }>();
const offerings = new Map<string, { id: string; courseId: string }>();

async function makeTokenFor(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: "127.0.0.1",
      userAgent: "vitest-registration",
    },
  });
  const payload = `${session.id}.${session.expiresAt.getTime()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

async function asStudent(userId = studentId) {
  state.token = await makeTokenFor(userId);
}

function fd(courseIds: string[]): FormData {
  const f = new FormData();
  for (const id of courseIds) f.append("courseId", id);
  return f;
}

async function offeringOverrides(
  courseId: string,
  overrides: Partial<{
    programmeId: string | null;
    academicSession: string;
    semester: number;
    level: number;
    status: string;
  }> = {},
) {
  return prisma.courseOffering.create({
    data: {
      courseId,
      programmeId: null,
      academicSession: CURRENT_SESSION,
      semester: CURRENT_SEMESTER,
      level: 300,
      status: "ACTIVE",
      ...overrides,
    },
  });
}

async function registrationsForCourse(courseId: string) {
  return prisma.courseRegistration.count({ where: { userId: studentId, courseId } });
}

async function createStudent(username: string, email: string, regNo: string) {
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: "not-used",
      role: "STUDENT",
      firstName: "Reg",
      lastName: "Test",
      fullName: "Reg Test Student",
      registrationNo: regNo,
      programmeId: progB.id,
      department: "Computer Science",
      faculty: "Faculty of Science",
    },
  });
  await prisma.feeAccount.create({
    data: { userId: user.id, clearanceStatus: true, balanceCents: 0 },
  });
  return user;
}

describe("student course registration eligibility", () => {
  beforeAll(async () => {
    const programmes = await prisma.programme.findMany({ take: 2, select: { id: true } });
    expect(programmes.length).toBeGreaterThanOrEqual(2);
    progA = programmes[0];
    progB = programmes[1];

    const student = await createStudent(USERNAME, EMAIL, REG_NO);
    studentId = student.id;
    const studentB = await createStudent(USERNAME_B, EMAIL_B, REG_NO_B);
    studentBId = studentB.id;

    for (const spec of COURSE_SPECS) {
      const course = await prisma.course.create({
        data: {
          code: spec.code,
          title: `Test course ${spec.code}`,
          units: spec.units,
          level: spec.level,
          semester: spec.semester,
          capacity: spec.capacity,
          prerequisites: spec.prerequisites ?? undefined,
        },
      });
      courses.set(spec.code, { id: course.id, code: spec.code, units: spec.units });
    }

    // Legacy ACTIVE row for student B — gives the audit-atomicity test a
    // duplicate to trip on without depending on student A's finalisation.
    await prisma.courseRegistration.create({
      data: {
        userId: studentBId,
        courseId: courses.get(`TEST401_${SUFFIX}`)!.id,
        academicSession: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
      },
    });

    // TEST102 → INACTIVE offering
    offerings.set("TEST102", {
      id: (await offeringOverrides(courses.get(`TEST102_${SUFFIX}`)!.id, { status: "INACTIVE" })).id,
      courseId: courses.get(`TEST102_${SUFFIX}`)!.id,
    });
    // TEST103 → programme-A only
    offerings.set("TEST103", {
      id: (await offeringOverrides(courses.get(`TEST103_${SUFFIX}`)!.id, { programmeId: progA.id })).id,
      courseId: courses.get(`TEST103_${SUFFIX}`)!.id,
    });
    // TEST104 → level 400
    offerings.set("TEST104", {
      id: (await offeringOverrides(courses.get(`TEST104_${SUFFIX}`)!.id, { level: 400 })).id,
      courseId: courses.get(`TEST104_${SUFFIX}`)!.id,
    });
    // TEST105 → previous session
    offerings.set("TEST105", {
      id: (await offeringOverrides(courses.get(`TEST105_${SUFFIX}`)!.id, { academicSession: "2024/2025" })).id,
      courseId: courses.get(`TEST105_${SUFFIX}`)!.id,
    });
    // TEST106 → semester 2
    offerings.set("TEST106", {
      id: (await offeringOverrides(courses.get(`TEST106_${SUFFIX}`)!.id, { semester: 2 })).id,
      courseId: courses.get(`TEST106_${SUFFIX}`)!.id,
    });
    // Eligible set (TEST401–TEST406) → ACTIVE, current session, semester 1, level 300, all-programmes
    for (const code of ["TEST401", "TEST402", "TEST403", "TEST404", "TEST405", "TEST406", "TEST407", "TEST408"]) {
      offerings.set(code, {
        id: (await offeringOverrides(courses.get(`${code}_${SUFFIX}`)!.id)).id,
        courseId: courses.get(`${code}_${SUFFIX}`)!.id,
      });
    }

    await asStudent();
  });

  afterAll(async () => {
    const userIds = [studentId, studentBId];

    // Delete finalisation headers BEFORE the course-registration rows that
    // reference them (FK on CourseRegistration.registrationId is SET NULL).
    await prisma.registration.deleteMany({ where: { userId: { in: userIds } } });

    const regIds = (await prisma.courseRegistration.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    })).map((r) => r.id);
    await prisma.courseRegistration.deleteMany({ where: { userId: { in: userIds } } });
    if (regIds.length > 0) {
      await prisma.lmsSyncLog.deleteMany({ where: { refId: { in: regIds } } });
    }
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });

    await prisma.courseOffering.deleteMany({ where: { id: { in: [...offerings.values()].map((o) => o.id) } } });
    await prisma.course.deleteMany({
      where: { code: { in: [...courses.values()].map((c) => c.code) } },
    });
    await prisma.feeAccount.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userAgent: "vitest-registration" } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // -------------------------------------------------------------------------
  // Rejection tests (student A) — all run BEFORE the success test finalises A.
  // -------------------------------------------------------------------------

  it("TEST 1: course exists but has NO CourseOffering → registration fails", async () => {
    const course = courses.get(`TEST101_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 2: CourseOffering INACTIVE → registration fails", async () => {
    const course = courses.get(`TEST102_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 3: offering for Programme A, student in Programme B → registration fails", async () => {
    const course = courses.get(`TEST103_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 4: offering at level 400, student at level 300 → registration fails", async () => {
    const course = courses.get(`TEST104_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 5: offering for 2024/2025, current session 2025/2026 → registration fails", async () => {
    const course = courses.get(`TEST105_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 6: offering for semester 1 but student submits in semester 2 context → fails", async () => {
    const course = courses.get(`TEST106_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 7: selection totalling 14 units → registration fails", async () => {
    const ids = [
      courses.get(`TEST401_${SUFFIX}`)!.id,
      courses.get(`TEST402_${SUFFIX}`)!.id,
      courses.get(`TEST403_${SUFFIX}`)!.id,
      courses.get(`TEST404_${SUFFIX}`)!.id,
      courses.get(`TEST406_${SUFFIX}`)!.id, // 3+3+3+3+2 = 14
    ];
    const res = await actions.submitCourseRegistration(null, fd(ids));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(new RegExp(`minimum of ${MIN_REGISTRATION_UNITS}`));
    for (const id of ids) expect(await registrationsForCourse(id)).toBe(0);
  });

  it("TEST 9: valid + invalid + valid → NONE are registered (atomic)", async () => {
    const valid1 = courses.get(`TEST401_${SUFFIX}`)!;
    const invalid = courses.get(`TEST102_${SUFFIX}`)!;
    const valid2 = courses.get(`TEST402_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([valid1.id, invalid.id, valid2.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
    expect(await registrationsForCourse(valid1.id)).toBe(0);
    expect(await registrationsForCourse(valid2.id)).toBe(0);
  });

  it("TEST 10: tampered courseId (course not offered / unknown) → server rejects", async () => {
    const res = await actions.submitCourseRegistration(null, fd(["does-not-exist-123"]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/invalid/);
  });

  it("TEST 11: INACTIVE offering activated by HOD becomes eligible (student B)", async () => {
    await prisma.courseOffering.update({ where: { id: offerings.get("TEST102")!.id }, data: { status: "ACTIVE" } });
    await asStudent(studentBId);
    const eligible = await registration.getEligibleStudentCourseOfferings({
      registrationNo: REG_NO_B,
      department: "Computer Science",
      programmeId: progB.id,
    });
    expect(eligible.some((o) => o.courseId === offerings.get("TEST102")!.courseId)).toBe(true);

    const course = courses.get(`TEST102_${SUFFIX}`)!;
    const res = await actions.registerCourse(null, fd([course.id]));
    expect(res).toEqual({ ok: true });
    const count = await prisma.courseRegistration.count({
      where: { userId: studentBId, courseId: course.id },
    });
    expect(count).toBe(1);
    await asStudent();
  });

  it("TEST 12: ACTIVE offering deactivated by HOD is no longer eligible", async () => {
    await prisma.courseOffering.update({ where: { id: offerings.get("TEST102")!.id }, data: { status: "INACTIVE" } });
    const eligible = await registration.getEligibleStudentCourseOfferings({
      registrationNo: REG_NO,
      department: "Computer Science",
      programmeId: progB.id,
    });
    expect(eligible.some((o) => o.courseId === offerings.get("TEST102")!.courseId)).toBe(false);

    const course = courses.get(`TEST102_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/not offered to you/);
  });

  it("TEST 13: unmet prerequisite still blocks registration", async () => {
    const course = courses.get(`TEST407_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/Prerequisite CSC301/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  it("TEST 14: capacity limit still blocks registration", async () => {
    const course = courses.get(`TEST408_${SUFFIX}`)!;
    const res = await actions.submitCourseRegistration(null, fd([course.id]));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/at capacity/);
    expect(await registrationsForCourse(course.id)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Success test — runs LAST on student A: it finalises and locks A's session.
  // -------------------------------------------------------------------------

  it("TEST 8: selection totalling 15 units, all valid → registration finalised with a reference", async () => {
    const ids = [
      courses.get(`TEST401_${SUFFIX}`)!.id,
      courses.get(`TEST402_${SUFFIX}`)!.id,
      courses.get(`TEST403_${SUFFIX}`)!.id,
      courses.get(`TEST404_${SUFFIX}`)!.id,
      courses.get(`TEST405_${SUFFIX}`)!.id, // 3×5 = 15
    ];
    const res = await actions.submitCourseRegistration(null, fd(ids));
    expect(res.ok).toBe(true);
    expect(res.reference).toMatch(/^CR-2025-\d{6}$/);

    const header = await prisma.registration.findUnique({
      where: { registrationReference: res.reference! },
      include: { courseRegistrations: true },
    });
    expect(header).not.toBeNull();
    expect(header!.userId).toBe(studentId);
    expect(header!.status).toBe("FINALIZED");
    expect(header!.totalUnits).toBe(15);
    expect(header!.lockedAt).not.toBeNull();
    expect(header!.finalisedAt).not.toBeNull();
    expect(header!.courseRegistrations).toHaveLength(5);
  });

  it("after finalisation the same student cannot submit again (locked)", async () => {
    const ids = [
      courses.get(`TEST401_${SUFFIX}`)!.id,
      courses.get(`TEST402_${SUFFIX}`)!.id,
      courses.get(`TEST403_${SUFFIX}`)!.id,
      courses.get(`TEST404_${SUFFIX}`)!.id,
      courses.get(`TEST405_${SUFFIX}`)!.id,
    ];
    const res = await actions.submitCourseRegistration(null, fd(ids));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/already been completed/);
  });

  it("a valid batch also writes LMS sync logs and audit records (student B, duplicate)", async () => {
    await asStudent(studentBId);
    const before = await prisma.auditLog.count({ where: { actorUserId: studentBId } });
    const ids = [
      courses.get(`TEST403_${SUFFIX}`)!.id,
      courses.get(`TEST404_${SUFFIX}`)!.id,
      courses.get(`TEST405_${SUFFIX}`)!.id,
      courses.get(`TEST406_${SUFFIX}`)!.id,
      courses.get(`TEST401_${SUFFIX}`)!.id, // already ACTIVE for B → duplicate error, nothing written
    ];
    const res = await actions.submitCourseRegistration(null, fd(ids));
    expect(res.ok).toBeFalsy();
    expect(res.error).toMatch(/already registered/);
    const after = await prisma.auditLog.count({ where: { actorUserId: studentBId } });
    expect(after).toBe(before); // atomic — no partial audit/LMS writes
  });
});
