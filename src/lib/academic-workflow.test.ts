import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE, CURRENT_SESSION, CURRENT_SEMESTER, can } from "./constants";
import { isGovernanceRole, governanceExceptions, governanceStats, resultsPipeline } from "./governance";
import { facultyDepartments, facultyCourseCodes } from "./faculty";
import { verifyChain } from "./audit";
import { requireVC } from "../app/portal/vc/guard";
import { requireGovernanceOversight } from "../app/portal/dvc/guard";
import {
  getResultPipelineStats,
  getUniversityAcademicStats,
  getCourseAssignmentStats,
  getCourseRegResultCounts,
  type ResultPipelineStats,
} from "./academic-stats";

// ---------------------------------------------------------------------------
// End-to-end academic workflow — security + integration coverage.
//
//  - TESTS 1-6   Course allocation (HoD)
//  - TESTS 7-15  Student course registration / finalisation
//  - TESTS 16-21 Lecturer result submission
//  - TESTS 22-25 HoD approval
//  - TESTS 26-29 Dean faculty oversight
//  - TESTS 30-32 SBC (Senate) read-only oversight
//  - TESTS 33-35 DVC / Governance monitoring
//  - TESTS 36-38 VC executive oversight
//  - TESTS 39-50 Full end-to-end scenario (SUBMITTED → HOD_APPROVED →
//    SENATE_APPROVED → FINAL) with audit-chain and shared-stats verification.
//  - TESTS 51-57 Lecturer course delivery & result submission recovery
//  - TESTS 58-59 Session-scoped aggregation (cross-session exclusion + the
//    resultsPipeline dashboard helper staying in lock-step with the shared
//    getResultPipelineStats helper).
//  - TESTS 60-66 UAT integration: HOD course-offering management scoped to the
//    department, client-supplied session/semester scope-override rejection,
//    result-batch atomicity, out-of-scope HOD approval mutating nothing, the
//    governance membership guard, cross-level lock-step aggregation for a
//    controlled dataset, and the Dean's read-only approval posture.
//
// Every row created here is deleted in afterAll. The catalogue (Courses_UG
// sheet) is mocked so course-allocation and offering checks run against a
// fixed, deterministic catalogue instead of the live sheet.
// ---------------------------------------------------------------------------

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const AGENT = "vitest-academic-workflow";

const state = vi.hoisted(() => ({ token: "" as string }));

const fx = vi.hoisted(() => {
  const suffix = Date.now().toString(36).toUpperCase();
  const c = (n: string) => `ACW${n}_${suffix}`;
  return {
    suffix,
    CS: c("101"),
    CS2: c("102"),
    ENG: c("201"),
    LEVEL: c("302"),
    PROG: c("303"),
    CAP: c("304"),
    NOOFF: c("305"),
    PREREQ: c("306"),
    E2E: c("501"),
    FIN: Array.from({ length: 6 }, (_, i) => c(`6${i + 1}`)),
    HOD_CS: `acw-${suffix}-hod@uniabuja.local`,
    LEC_MAIN: `acw-${suffix}-main@uniabuja.local`,
    LEC_CO: `acw-${suffix}-co@uniabuja.local`,
    LEC_ENG: `acw-${suffix}-eng@uniabuja.local`,
    LEC_NONE: `acw-${suffix}-none@uniabuja.local`,
    EXAM: `acw-${suffix}-exam@uniabuja.local`,
    DEAN: `acw-${suffix}-dean@uniabuja.local`,
    SBC: `acw-${suffix}-sbc@uniabuja.local`,
    GOV: `acw-${suffix}-gov@uniabuja.local`,
    VC: `acw-${suffix}-vc@uniabuja.local`,
    STUDENT_A: `acw-${suffix}-sa@uniabuja.local`,
    STUDENT_B: `acw-${suffix}-sb@uniabuja.local`,
    STUDENT_E2E: `acw-${suffix}-se@uniabuja.local`,
    STUDENT_FIN: `acw-${suffix}-sf@uniabuja.local`,
  };
});

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? "127.0.0.1" : name === "user-agent" ? AGENT : null,
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

// Deterministic master catalogue (Courses_UG). Only the courses listed below
// "exist" in the catalogue; everything else fails the HoD scope check.
vi.mock("@/lib/sheets", () => ({
  getCoursesUG: async () => [
    { code: fx.CS, title: "ACW Computer Science Core", faculty: "Faculty of Science", hostingDepartment: "Computer Science", semester: 1, unit: 3 },
    { code: fx.CS2, title: "ACW Computer Science Lab", faculty: "Faculty of Science", hostingDepartment: "Computer Science", semester: 1, unit: 3 },
    { code: fx.ENG, title: "ACW Mechanical Workshop", faculty: "Faculty of Engineering", hostingDepartment: "Mechanical Engineering", semester: 1, unit: 3 },
    { code: fx.E2E, title: "ACW End-to-End Project", faculty: "Faculty of Science", hostingDepartment: "Computer Science", semester: 1, unit: 3 },
  ],
}));

// Wrap getResultPipelineStats in a spy so TEST 59 can prove resultsPipeline
// (the DVC/VC/SBC dashboard helper) delegates to the shared helper. Every other
// call passes through to the real implementation.
vi.mock("./academic-stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./academic-stats")>();
  return { ...actual, getResultPipelineStats: vi.fn(actual.getResultPipelineStats) };
});

const actions = await import("./module-actions");
const lecturerActions = await import("../app/portal/lecturer/actions");

// ---------------------------------------------------------------------------
// Fixture state
// ---------------------------------------------------------------------------

const userIds: string[] = [];
const studentIds: string[] = [];
const courseIds: string[] = [];
const offeringIds: string[] = [];
const seededResultIds: string[] = [];

let progA: { id: string };
let progB: { id: string };

let C_CS = "";
let C_CS2 = "";
let C_ENG = "";
let C_LEVEL = "";
let C_PROG = "";
let C_CAP = "";
let C_NOOFF = "";
let C_PREREQ = "";
let C_E2E = "";

async function makeTokenFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user ${email}`);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: "127.0.0.1",
      userAgent: AGENT,
    },
  });
  const payload = `${session.id}.${session.expiresAt.getTime()}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

async function as(email: string) {
  state.token = await makeTokenFor(email);
}

function fd(entries: Record<string, string | number | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) if (v !== undefined) f.append(k, String(v));
  return f;
}

async function createUser(email: string, overrides: Record<string, unknown>): Promise<string> {
  const user = await prisma.user.create({
    data: {
      username: email.split("@")[0].toUpperCase(),
      email,
      passwordHash: "not-used",
      firstName: "ACW",
      lastName: "Test",
      fullName: "ACW Test User",
      ...overrides,
    } as never,
  });
  userIds.push(user.id);
  return user.id;
}

async function createCourse(code: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const course = await prisma.course.create({
    data: {
      code,
      title: `ACW ${code}`,
      units: 3,
      level: 300,
      semester: 1,
      capacity: 150,
      ...overrides,
    },
  });
  courseIds.push(course.id);
  return course.id;
}

async function createOffering(courseId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const offering = await prisma.courseOffering.create({
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
  offeringIds.push(offering.id);
  return offering.id;
}

async function createRegistration(userId: string, courseId: string, status = "ACTIVE") {
  return prisma.courseRegistration.create({
    data: {
      userId,
      courseId,
      academicSession: CURRENT_SESSION,
      semester: CURRENT_SEMESTER,
      status,
    },
  });
}

async function seedResult(userId: string, courseId: string, gradeStatus: string, submittedById: string) {
  const result = await prisma.result.create({
    data: {
      userId,
      courseId,
      academicSession: CURRENT_SESSION,
      semester: CURRENT_SEMESTER,
      caScore: 30,
      examScore: 40,
      total: 70,
      grade: "B",
      gradeStatus,
      submittedById,
    },
  });
  seededResultIds.push(result.id);
  return result;
}

describe("end-to-end academic workflow (integration)", () => {
  beforeAll(async () => {
    const programmes = await prisma.programme.findMany({ take: 2, select: { id: true } });
    expect(programmes.length).toBeGreaterThanOrEqual(2);
    progA = programmes[0];
    progB = programmes[1];

    await createUser(fx.HOD_CS, { role: "HOD", faculty: "Faculty of Science", department: "Computer Science" });
    await createUser(fx.LEC_MAIN, { role: "LECTURER", faculty: "Faculty of Science", department: "Computer Science" });
    await createUser(fx.LEC_CO, { role: "LECTURER", faculty: "Faculty of Science", department: "Computer Science" });
    await createUser(fx.LEC_ENG, { role: "LECTURER", faculty: "Faculty of Engineering", department: "Mechanical Engineering" });
    await createUser(fx.LEC_NONE, { role: "LECTURER", faculty: "Faculty of Science", department: "Computer Science" });
    await createUser(fx.EXAM, { role: "EXAMS_RECORDS" });
    await createUser(fx.DEAN, { role: "DEAN", faculty: "Faculty of Science", department: "Computer Science" });
    await createUser(fx.SBC, { role: "SBC_CHAIRMAN" });
    await createUser(fx.GOV, { role: "GOVERNANCE_OVERSIGHT_MEMBER" });
    await createUser(fx.VC, { role: "VC" });

    for (const [email, regNo] of [
      [fx.STUDENT_A, "23/ACW/0001"],
      [fx.STUDENT_B, "23/ACW/0002"],
      [fx.STUDENT_E2E, "23/ACW/0003"],
      [fx.STUDENT_FIN, "23/ACW/0004"],
    ] as const) {
      const id = await createUser(email, {
        role: "STUDENT",
        faculty: "Faculty of Science",
        department: "Computer Science",
        registrationNo: regNo,
        programmeId: progB.id,
      });
      studentIds.push(id);
      await prisma.feeAccount.create({ data: { userId: id, clearanceStatus: true, balanceCents: 0 } });
    }

    C_CS = await createCourse(fx.CS);
    C_CS2 = await createCourse(fx.CS2);
    C_ENG = await createCourse(fx.ENG);
    C_LEVEL = await createCourse(fx.LEVEL, { level: 400 });
    C_PROG = await createCourse(fx.PROG);
    C_CAP = await createCourse(fx.CAP, { capacity: 0 });
    C_NOOFF = await createCourse(fx.NOOFF);
    C_PREREQ = await createCourse(fx.PREREQ, { prerequisites: ["CSC301"] });
    C_E2E = await createCourse(fx.E2E);
    const finIds = [];
    for (const code of fx.FIN) {
      const id = await createCourse(code, { level: 300, semester: 1, capacity: 150 });
      finIds.push(id);
      await createOffering(id);
    }

    // CourseOffering rows that define registrability for the registration tests.
    await createOffering(C_CS); // eligible for level-300 student A
    await createOffering(C_CS2);
    await createOffering(C_LEVEL, { level: 400 }); // level mismatch for student A
    await createOffering(C_PROG, { programmeId: progA.id }); // programme mismatch for student A
    await createOffering(C_CAP); // zero capacity
    await createOffering(C_PREREQ); // unmet prerequisite (CSC301)
    // C_NOOFF intentionally has NO offering.

    // Pre-seeded allocations (the main + co allocation on C_CS and the E2E
    // allocation are created through the assignCourse action in TESTS 1/39).
    // C_CS2 is allocated to a CS lecturer so the HoD approval tests (22/24)
    // and the Dean oversight test (44) stay inside the department's scope.
    await prisma.courseAssignment.create({
      data: {
        courseCode: fx.ENG,
        courseTitle: `ACW ${fx.ENG}`,
        faculty: "Faculty of Engineering",
        department: "Mechanical Engineering",
        lecturerId: userIds[3],
        assignedById: userIds[0],
        academicSession: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
      },
    });
    await prisma.courseAssignment.create({
      data: {
        courseCode: fx.PROG,
        courseTitle: `ACW ${fx.PROG}`,
        faculty: "Faculty of Science",
        department: "Computer Science",
        lecturerId: userIds[1],
        assignedById: userIds[0],
        academicSession: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
      },
    });
    await prisma.courseAssignment.create({
      data: {
        courseCode: fx.CS2,
        courseTitle: `ACW ${fx.CS2}`,
        faculty: "Faculty of Science",
        department: "Computer Science",
        lecturerId: userIds[4],
        assignedById: userIds[0],
        academicSession: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
      },
    });

    // Pre-registered students so lecturer/E2E tests never depend on test order.
    // Student A registers C_CS through the action itself in TEST 7.
    await createRegistration(studentIds[1], C_CS); // student B on C_CS (TESTS 17/31)
    await createRegistration(studentIds[0], C_CS2); // student A on C_CS2 (TESTS 20)
    await createRegistration(studentIds[0], C_ENG); // student A on C_ENG (TESTS 19)

    // Seeded results for the approval / oversight / governance tests.
    await seedResult(studentIds[1], C_CS2, "SUBMITTED", userIds[1]); // TESTS 22
    await seedResult(studentIds[1], C_ENG, "SUBMITTED", userIds[1]); // TESTS 23
    await seedResult(studentIds[0], C_CS2, "HOD_APPROVED", userIds[1]); // TESTS 24
    await seedResult(studentIds[1], C_LEVEL, "SUBMITTED", userIds[1]); // TESTS 25
    await seedResult(studentIds[1], C_PROG, "HOD_APPROVED", userIds[1]); // TESTS 26
    await seedResult(studentIds[0], C_ENG, "HOD_APPROVED", userIds[1]); // TESTS 27
    await seedResult(studentIds[0], C_PROG, "FINAL", userIds[1]); // TESTS 28
    await seedResult(studentIds[1], C_PREREQ, "HOD_APPROVED", userIds[1]); // TESTS 29
    await seedResult(studentIds[0], C_NOOFF, "SUBMITTED", userIds[1]); // TESTS 30
    await seedResult(studentIds[1], C_NOOFF, "SUBMITTED", userIds[1]); // TESTS 33
    await seedResult(studentIds[0], C_PREREQ, "SENATE_APPROVED", userIds[1]); // TESTS 34
    await seedResult(studentIds[0], C_LEVEL, "SUBMITTED", userIds[1]); // TESTS 38
    await seedResult(studentIds[2], C_CS2, "HOD_APPROVED", userIds[1]); // TESTS 44

    await as(fx.HOD_CS);
  });

  afterAll(async () => {
    const sessions = await prisma.session.findMany({ where: { userAgent: AGENT }, select: { id: true } });
    const sessionIds = sessions.map((s) => s.id);
    await prisma.auditLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.lmsSyncLog.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.registration.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.courseRegistration.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.result.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.courseOffering.deleteMany({ where: { id: { in: offeringIds } } });
    await prisma.courseAssignment.deleteMany({
      where: { courseCode: { in: [fx.CS, fx.CS2, fx.ENG, fx.LEVEL, fx.PROG, fx.CAP, fx.NOOFF, fx.PREREQ, fx.E2E, ...fx.FIN] } },
    });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.feeAccount.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.resultFile.deleteMany({ where: { lecturerId: { in: userIds } } });
    await prisma.resultCorrectionRequest.deleteMany({ where: { requesterId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userAgent: AGENT } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // -------------------------------------------------------------------------
  // TESTS 1-6 — HoD course allocation
  // -------------------------------------------------------------------------

  it("TEST 1 — HoD allocates a course to a main and a co-lecturer", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[1], coLecturerIds: userIds[2] }),
    );
    expect(res).toEqual({ ok: true });

    const assignment = await prisma.courseAssignment.findUnique({
      where: { courseCode_academicSession_semester: { courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } },
      include: { teamMembers: true },
    });
    expect(assignment).toBeTruthy();
    expect(assignment!.lecturerId).toBe(userIds[1]);
    expect(assignment!.department).toBe("Computer Science");
    expect(assignment!.teamMembers.map((m) => m.lecturerId)).toContain(userIds[2]);

    const audit = await prisma.auditLog.findFirst({
      where: { sessionId: { in: (await prisma.session.findMany({ where: { userAgent: AGENT } })).map((s) => s.id) }, targetType: "COURSE_ASSIGNMENT", action: "CREATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("TEST 2 — a non-HoD role cannot allocate a course", async () => {
    await as(fx.LEC_MAIN);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.CS2, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[1] }),
    );
    expect(res.error).toMatch(/Heads of Department/);
  });

  it("TEST 3 — HoD cannot allocate a course outside their department catalogue", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.ENG, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[1] }),
    );
    expect(res.error).toMatch(/own department/);
  });

  it("TEST 4 — HoD cannot assign a non-lecturer as the main lecturer", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: studentIds[0] }),
    );
    expect(res.error).toMatch(/valid lecturer/);
  });

  it("TEST 5 — HoD cannot assign a lecturer from another department as main", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[3] }),
    );
    expect(res.error).toMatch(/main lecturer must belong to your department/);
  });

  it("TEST 6 — HoD cannot add a co-lecturer from another department", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[1], coLecturerIds: `${userIds[3]}` }),
    );
    expect(res.error).toMatch(/Co-lecturers must belong to your department/);
  });

  // -------------------------------------------------------------------------
  // TESTS 7-15 — student course registration / finalisation
  // -------------------------------------------------------------------------

  it("TEST 7 — a student registers an eligible course", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_CS }));
    expect(res).toEqual({ ok: true });
    const reg = await prisma.courseRegistration.findFirst({
      where: { userId: studentIds[0], courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(reg?.status).toBe("ACTIVE");
    expect(reg?.lmsSynced).toBe(true);
  });

  it("TEST 8 — a student cannot register a course with no ACTIVE offering", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_NOOFF }));
    expect(res.error).toMatch(/not offered to you/);
  });

  it("TEST 9 — a student cannot register a course whose level does not match theirs", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_LEVEL }));
    expect(res.error).toMatch(/not offered to you/);
  });

  it("TEST 10 — a student cannot register a programme-specific course of another programme", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_PROG }));
    expect(res.error).toMatch(/not offered to you/);
  });

  it("TEST 11 — a zero-capacity course waitlists instead of registering", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_CAP }));
    expect(res.error).toMatch(/capacity/);
    const reg = await prisma.courseRegistration.findFirst({
      where: { userId: studentIds[0], courseId: C_CAP, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(reg?.status).toBe("WAITLISTED");
  });

  it("TEST 12 — a tampered courseId (course not offered at all) is rejected", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: "does-not-exist" }));
    expect(res.error).toMatch(/Select a course/);
  });

  it("TEST 13 — a course with an unmet prerequisite is rejected", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.registerCourse(null, fd({ courseId: C_PREREQ }));
    expect(res.error).toMatch(/Prerequisite CSC301 has not been passed/);
  });

  it("TEST 14 — a student cannot drop a course they are not registered for", async () => {
    await as(fx.STUDENT_A);
    const res = await actions.dropCourse(null, fd({ id: "missing-registration" }));
    expect(res.error).toMatch(/Registration not found/);
  });

  it("TEST 15 — finalisation creates an immutable registration header", async () => {
    await as(fx.STUDENT_FIN);
    // Six eligible courses (3 units each = 18 units) submitted at once.
    const finIds = courseIds.slice(courseIds.length - 6);
    const f = new FormData();
    for (const id of finIds) f.append("courseId", id);
    const sub = await actions.submitCourseRegistration(null, f);
    expect(sub.ok).toBe(true);
    expect(sub.reference).toMatch(/^CR-\d{4}-\d{6}$/);

    const header = await prisma.registration.findFirst({
      where: { userId: studentIds[3], academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(header).toBeTruthy();
    expect(header!.status).toBe("FINALIZED");
    expect(header!.totalUnits).toBeGreaterThanOrEqual(18);

    // The session is now locked: further registrations are rejected.
    const locked = await actions.registerCourse(null, fd({ courseId: C_CS }));
    expect(locked.error).toMatch(/finalised and locked/);
  });

  // -------------------------------------------------------------------------
  // TESTS 16-21 — lecturer result submission
  // -------------------------------------------------------------------------

  it("TEST 16 — the main lecturer submits a grade for an assigned course", async () => {
    await as(fx.LEC_MAIN);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[0], courseId: C_CS, caScore: 30, examScore: 40 }));
    expect(res).toEqual({ ok: true });
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[0], courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.gradeStatus).toBe("SUBMITTED");
    expect(result?.total).toBe(70);
    expect(result?.submittedById).toBe(userIds[1]);
  });

  it("TEST 17 — a co-lecturer submits a grade for the same course", async () => {
    await as(fx.LEC_CO);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[1], courseId: C_CS, caScore: 20, examScore: 35 }));
    expect(res).toEqual({ ok: true });
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[1], courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.total).toBe(55);
    expect(result?.submittedById).toBe(userIds[2]);
  });

  it("TEST 18 — a lecturer with no assignment cannot submit a grade", async () => {
    await as(fx.LEC_NONE);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[0], courseId: C_CS, caScore: 25, examScore: 30 }));
    expect(res.error).toMatch(/not assigned to teach/);
  });

  it("TEST 19 — a lecturer cannot submit a grade for a course assigned to another lecturer", async () => {
    await as(fx.LEC_MAIN);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[0], courseId: C_ENG, caScore: 25, examScore: 30 }));
    expect(res.error).toMatch(/not assigned to teach/);
  });

  it("TEST 20 — a tampered courseId for an unassigned course is rejected", async () => {
    await as(fx.LEC_MAIN);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[0], courseId: C_CS2, caScore: 25, examScore: 30 }));
    expect(res.error).toMatch(/not assigned to teach/);
  });

  it("TEST 21 — a lecturer cannot approve results", async () => {
    const target = await prisma.result.findFirst({
      where: { userId: studentIds[1], courseId: C_LEVEL },
    });
    expect(target).toBeTruthy();
    await as(fx.LEC_MAIN);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toMatch(/cannot approve/);
  });

  // -------------------------------------------------------------------------
  // TESTS 22-25 — HoD approval
  // -------------------------------------------------------------------------

  it("TEST 22 — HoD approves a SUBMITTED result in their department", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_CS2 } });
    expect(target?.gradeStatus).toBe("SUBMITTED");
    await as(fx.HOD_CS);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: target!.id } });
    expect(after?.gradeStatus).toBe("HOD_APPROVED");
    expect(after?.approvedBy1Id).toBe(userIds[0]);
  });

  it("TEST 23 — HoD cannot approve a result outside their department", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_ENG } });
    await as(fx.HOD_CS);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toMatch(/own department/);
  });

  it("TEST 24 — HoD cannot approve a result not in the SUBMITTED stage", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_CS2 } });
    expect(target?.gradeStatus).toBe("HOD_APPROVED");
    await as(fx.HOD_CS);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toMatch(/Not ready for your approval/);
  });

  it("TEST 25 — a non-HoD role cannot approve results", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_LEVEL } });
    await as(fx.LEC_CO);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toMatch(/cannot approve/);
  });

  // -------------------------------------------------------------------------
  // TESTS 26-29 — Dean faculty oversight (no DEAN_APPROVED stage)
  // -------------------------------------------------------------------------

  it("TEST 26 — the Dean returns an HOD_APPROVED result to the department", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_PROG } });
    expect(target?.gradeStatus).toBe("HOD_APPROVED");
    await as(fx.DEAN);
    const res = await actions.returnResult(null, fd({ id: target!.id, reason: "Recheck coursework scripts" }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: target!.id } });
    expect(after?.gradeStatus).toBe("SUBMITTED");
    expect(after?.approvedBy1Id).toBeNull();
  });

  it("TEST 27 — the Dean cannot return a result from another faculty", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_ENG } });
    await as(fx.DEAN);
    const res = await actions.returnResult(null, fd({ id: target!.id, reason: "Overstep" }));
    expect(res.error).toMatch(/does not belong to your faculty/);
  });

  it("TEST 28 — the Dean cannot return a result not at HOD_APPROVED", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_PROG } });
    expect(target?.gradeStatus).toBe("FINAL");
    await as(fx.DEAN);
    const res = await actions.returnResult(null, fd({ id: target!.id, reason: "Too late" }));
    expect(res.error).toMatch(/Only HoD-approved results can be returned/);
  });

  it("TEST 29 — a non-Dean role cannot return results", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_PREREQ } });
    expect(target?.gradeStatus).toBe("HOD_APPROVED");
    await as(fx.SBC);
    const res = await actions.returnResult(null, fd({ id: target!.id, reason: "Nope" }));
    expect(res.error).toMatch(/Only Deans can return results/);
  });

  // -------------------------------------------------------------------------
  // TESTS 30-32 — SBC (Senate) read-only oversight
  // -------------------------------------------------------------------------

  it("TEST 30 — SBC cannot approve or finalise results", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_NOOFF } });
    expect(target?.gradeStatus).toBe("SUBMITTED");
    await as(fx.SBC);
    const approve = await actions.approveResult(null, fd({ id: target!.id }));
    expect(approve.error).toMatch(/cannot approve/);
    const finalise = await actions.finaliseResult(null, fd({ id: target!.id }));
    expect(finalise.error).toMatch(/Only the Exams & Records office/);
  });

  it("TEST 31 — SBC cannot submit grades", async () => {
    await as(fx.SBC);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[1], courseId: C_CS, caScore: 10, examScore: 20 }));
    expect(res.error).toMatch(/cannot enter grades/);
  });

  it("TEST 32 — SBC holds read-only results oversight", async () => {
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "R")).toBe(true);
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "S")).toBe(false);
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "A")).toBe(false);
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "W")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TESTS 33-35 — DVC / Governance monitoring
  // -------------------------------------------------------------------------

  it("TEST 33 — governance members cannot mutate results", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[1], courseId: C_NOOFF } });
    await as(fx.GOV);
    const approve = await actions.approveResult(null, fd({ id: target!.id }));
    expect(approve.error).toMatch(/cannot approve/);
    const finalise = await actions.finaliseResult(null, fd({ id: target!.id }));
    expect(finalise.error).toMatch(/Only the Exams & Records office/);
    const grade = await actions.submitGrade(null, fd({ studentId: studentIds[1], courseId: C_CS, caScore: 10, examScore: 20 }));
    expect(grade.error).toMatch(/cannot enter grades/);
  });

  it("TEST 34 — governance flags Senate-approved results that are not FINAL until finalisation", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_PREREQ } });
    expect(target?.gradeStatus).toBe("SENATE_APPROVED");

    const before = await governanceExceptions();
    const beforeCount = before.find((e) => e.id === "results-senate-approved")?.count ?? 0;

    await as(fx.EXAM);
    const res = await actions.finaliseResult(null, fd({ id: target!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: target!.id } });
    expect(after?.gradeStatus).toBe("FINAL");

    const afterExceptions = await governanceExceptions();
    const afterCount = afterExceptions.find((e) => e.id === "results-senate-approved")?.count ?? 0;
    expect(afterCount).toBe(Math.max(0, beforeCount - 1));
  });

  it("TEST 35 — governance members can view results dashboards", async () => {
    expect(isGovernanceRole("GOVERNANCE_OVERSIGHT_MEMBER")).toBe(true);
    expect(can("GOVERNANCE_OVERSIGHT_MEMBER", "EXAMS_RECORDS", "R")).toBe(true);
    expect(can("GOVERNANCE_OVERSIGHT_MEMBER", "EXAMS_RECORDS", "A")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TESTS 36-38 — VC executive oversight
  // -------------------------------------------------------------------------

  it("TEST 36 — a non-VC role cannot reach the VC workspace", async () => {
    await as(fx.LEC_MAIN);
    await expect(requireVC()).rejects.toThrow("REDIRECT");
  });

  it("TEST 37 — the VC can view university-wide academic stats", async () => {
    await as(fx.VC);
    await expect(requireVC()).resolves.toBeTruthy();
    const stats = await getUniversityAcademicStats();
    expect(stats.academicSession).toBe(CURRENT_SESSION);
    expect(stats.semester).toBe(CURRENT_SEMESTER);
    expect(stats.students).toBeGreaterThan(0);
  });

  it("TEST 38 — the VC cannot mutate results", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_LEVEL } });
    await as(fx.VC);
    const approve = await actions.approveResult(null, fd({ id: target!.id }));
    expect(approve.error).toMatch(/cannot approve/);
    const finalise = await actions.finaliseResult(null, fd({ id: target!.id }));
    expect(finalise.error).toMatch(/Only the Exams & Records office/);
  });

  // -------------------------------------------------------------------------
  // TESTS 39-50 — full end-to-end scenario
  // -------------------------------------------------------------------------

  it("TEST 39 — E2E: HoD allocates the course and defines registrability", async () => {
    await as(fx.HOD_CS);
    const res = await actions.assignCourse(
      null,
      fd({ courseCode: fx.E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, lecturerId: userIds[1], coLecturerIds: userIds[2] }),
    );
    expect(res).toEqual({ ok: true });

    // CourseOffering is the registrability record, not the teaching allocation.
    await createOffering(C_E2E, { level: 300 });

    const offering = await prisma.courseOffering.findFirst({
      where: { courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(offering?.status).toBe("ACTIVE");
    expect(offering?.level).toBe(300);
  });

  it("TEST 40 — E2E: the student registers the offered course", async () => {
    await as(fx.STUDENT_E2E);
    const res = await actions.registerCourse(null, fd({ courseId: C_E2E }));
    expect(res).toEqual({ ok: true });
    const reg = await prisma.courseRegistration.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(reg?.status).toBe("ACTIVE");
  });

  it("TEST 41 — E2E: the main lecturer submits the grade", async () => {
    await as(fx.LEC_MAIN);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[2], courseId: C_E2E, caScore: 32, examScore: 45 }));
    expect(res).toEqual({ ok: true });
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.gradeStatus).toBe("SUBMITTED");
  });

  it("TEST 42 — E2E: the HoD approves the grade", async () => {
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    await as(fx.HOD_CS);
    const res = await actions.approveResult(null, fd({ id: result!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: result!.id } });
    expect(after?.gradeStatus).toBe("HOD_APPROVED");
  });

  it("TEST 43 — E2E: Exams & Records records the Senate approval", async () => {
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.gradeStatus).toBe("HOD_APPROVED");
    await as(fx.EXAM);
    const res = await actions.approveResult(null, fd({ id: result!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: result!.id } });
    expect(after?.gradeStatus).toBe("SENATE_APPROVED");
    expect(after?.published).toBe(true);
    expect(after?.approvedBy2Id).toBe(userIds[5]);
  });

  it("TEST 44 — E2E: the Dean exercises faculty oversight on a separate batch", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[2], courseId: C_CS2 } });
    expect(target?.gradeStatus).toBe("HOD_APPROVED");
    await as(fx.DEAN);
    const res = await actions.returnResult(null, fd({ id: target!.id, reason: "Coursework must be rechecked" }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: target!.id } });
    expect(after?.gradeStatus).toBe("SUBMITTED");
  });

  it("TEST 45 — E2E: Exams & Records finalises the Senate-approved result", async () => {
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.gradeStatus).toBe("SENATE_APPROVED");
    await as(fx.EXAM);
    const res = await actions.finaliseResult(null, fd({ id: result!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: result!.id } });
    expect(after?.gradeStatus).toBe("FINAL");
  });

  it("TEST 46 — E2E: a FINAL result is immutable (lecturer edit rejected)", async () => {
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.gradeStatus).toBe("FINAL");
    await as(fx.LEC_MAIN);
    const res = await actions.submitGrade(null, fd({ studentId: studentIds[2], courseId: C_E2E, caScore: 10, examScore: 10 }));
    expect(res.error).toMatch(/Final results cannot be edited/);
  });

  it("TEST 47 — E2E: the student can read their FINAL result", async () => {
    const results = await prisma.result.findMany({
      where: { userId: studentIds[2], gradeStatus: "FINAL" },
      include: { course: true },
    });
    const e2e = results.find((r) => r.course.code === fx.E2E);
    expect(e2e).toBeTruthy();
    expect(e2e!.grade).toBeTruthy();
    expect(e2e!.total).toBe(77);
  });

  it("TEST 48 — E2E: shared pipeline stats reflect the finalised result", async () => {
    const stats = await getResultPipelineStats({}, { course: { code: fx.E2E } });
    expect(stats.byStage.FINAL).toBe(1);
    expect(stats.byStage.SUBMITTED).toBe(0);
    expect(stats.byStage.HOD_APPROVED).toBe(0);
    expect(stats.byStage.SENATE_APPROVED).toBe(0);
    expect(stats.completionPct).toBe(100);

    const perCourse = await getCourseRegResultCounts([fx.E2E]);
    expect(perCourse.get(fx.E2E)?.registered).toBe(1);
    expect(perCourse.get(fx.E2E)?.submitted).toBe(1);
    expect(perCourse.get(fx.E2E)?.completionPct).toBe(100);

    const assignments = await getCourseAssignmentStats({}, "Computer Science");
    const e2eAssignment = assignments.assignments.find((a) => a.courseCode === fx.E2E);
    expect(e2eAssignment).toBeTruthy();
    expect(e2eAssignment!.registeredStudents).toBe(1);
  });

  it("TEST 49 — E2E: the hash-chained audit log remains intact", async () => {
    const chain = await verifyChain();
    expect(chain.intact).toBe(true);
    expect(chain.count).toBeGreaterThan(0);
  });

  it("TEST 50 — E2E: the full chain respects the stage order end to end", async () => {
    const result = await prisma.result.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result).toBeTruthy();
    expect(result!.gradeStatus).toBe("FINAL");
    expect(result!.submittedById).toBe(userIds[1]);
    expect(result!.approvedBy1Id).toBe(userIds[0]);
    expect(result!.approvedBy2Id).toBe(userIds[5]);
    expect(result!.published).toBe(true);

    // The audit log shows the exact transition history: the SUBMIT entry is
    // attributed to the course-registration row (the target before a result
    // row exists), the APPROVE/FINALIZE entries to the result itself.
    const reg = await prisma.courseRegistration.findFirst({
      where: { userId: studentIds[2], courseId: C_E2E, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    const submitAudit = await prisma.auditLog.findFirst({ where: { targetId: reg!.id, action: "SUBMIT" } });
    expect(submitAudit).toBeTruthy();
    const audit = await prisma.auditLog.findMany({
      where: { targetId: result!.id },
      orderBy: { createdAt: "asc" },
    });
    const actionsTaken = audit.map((a) => a.action);
    expect(actionsTaken).toContain("APPROVE");
    expect(actionsTaken).toContain("FINALIZE");

    // Shared stats across levels agree on the same pipeline.
    const uni = await getUniversityAcademicStats();
    expect(uni.pipeline.byStage.FINAL).toBeGreaterThanOrEqual(1);
    expect(uni.academicSession).toBe(CURRENT_SESSION);
  });

  // -------------------------------------------------------------------------
  // TESTS 51-57 — lecturer course delivery & result submission recovery
  // -------------------------------------------------------------------------

  function csvForm(courseCode: string, csv: string): FormData {
    const f = new FormData();
    f.append("courseCode", courseCode);
    f.append("session", CURRENT_SESSION);
    f.append("semester", String(CURRENT_SEMESTER));
    f.append("caMax", "30");
    f.append("contentType", "BOTH");
    f.append("file", new File([csv], "results.csv", { type: "text/csv" }));
    return f;
  }

  it("TEST 51 — a co-lecturer can post a CSV result batch for an assigned course", async () => {
    await as(fx.LEC_CO);
    const res = await lecturerActions.postResultsAction(
      null,
      csvForm(fx.CS, "MATRIC_NO,CA,EXAM\n23/ACW/0001,30,40\n23/ACW/0002,20,35\n"),
    );
    expect(res.success).toMatch(/posted for/);
    expect(res.summary).toMatchObject({ rowCount: 2, processed: 2, failed: 0 });

    const batch = await prisma.resultFile.findFirst({
      where: { lecturerId: userIds[2], courseCode: fx.CS, academicSession: CURRENT_SESSION },
      orderBy: { createdAt: "desc" },
    });
    expect(batch?.status).toBe("PROCESSED");
    expect(batch?.processedCount).toBe(2);

    const result = await prisma.result.findFirst({
      where: { userId: studentIds[0], courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    expect(result?.submittedById).toBe(userIds[2]);
    expect(result?.total).toBe(70);
  });

  it("TEST 52 — a lecturer with no assignment cannot post a CSV batch", async () => {
    await as(fx.LEC_NONE);
    const res = await lecturerActions.postResultsAction(
      null,
      csvForm(fx.CS, "MATRIC_NO,CA,EXAM\n23/ACW/0001,30,40\n"),
    );
    expect(res.error).toMatch(/not assigned/);
  });

  it("TEST 53 — a NORMAL CSV row for an unregistered student is rejected", async () => {
    await as(fx.LEC_MAIN);
    const res = await lecturerActions.postResultsAction(
      null,
      csvForm(fx.CS, "MATRIC_NO,CA,EXAM\n23/ACW/0001,28,42\n23/ACW/0004,25,30\n"),
    );
    expect(res.success).toMatch(/posted for/);
    expect(res.summary?.rowCount).toBe(2);
    expect(res.summary?.processed).toBe(1);
    expect(res.summary?.failed).toBe(1);
    expect(res.summary?.errors[0]).toMatch(/is not registered for/);

    const batch = await prisma.resultFile.findFirst({
      where: { lecturerId: userIds[1], courseCode: fx.CS, academicSession: CURRENT_SESSION },
      orderBy: { createdAt: "desc" },
    });
    expect(batch?.status).toBe("PARTIAL");
  });

  it("TEST 54 — a correction request for an unassigned course is rejected", async () => {
    await as(fx.LEC_NONE);
    const res = await lecturerActions.requestResultCorrection(
      null,
      fd({
        session: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
        courseCode: fx.CS,
        studentMatricNo: "23/ACW/0001",
        requestedChange: "Recheck the exam script",
        reason: "The candidate believes the exam script was mis-scored.",
      }),
    );
    expect(res.error).toMatch(/not assigned to/);
  });

  it("TEST 55 — a co-lecturer can request a correction for an assigned course", async () => {
    await as(fx.LEC_CO);
    const res = await lecturerActions.requestResultCorrection(
      null,
      fd({
        session: CURRENT_SESSION,
        semester: CURRENT_SEMESTER,
        courseCode: fx.CS,
        studentMatricNo: "23/ACW/0001",
        requestedChange: "Recheck the exam script",
        reason: "The candidate believes the exam script was mis-scored.",
      }),
    );
    expect(res.success).toMatch(/submitted to Exams & Records/);

    const request = await prisma.resultCorrectionRequest.findFirst({
      where: { requesterId: userIds[2], courseCode: fx.CS, academicSession: CURRENT_SESSION },
      orderBy: { createdAt: "desc" },
    });
    expect(request?.status).toBe("SUBMITTED");
    expect(request?.studentMatricNo).toBe("23/ACW/0001");
  });

  it("TEST 56 — HoD cannot add a co-lecturer from another department to an allocation", async () => {
    const assignment = await prisma.courseAssignment.findUnique({
      where: { courseCode_academicSession_semester: { courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } },
    });
    expect(assignment).toBeTruthy();
    await as(fx.HOD_CS);
    const res = await actions.addCourseTeamLecturer(null, fd({ courseAssignmentId: assignment!.id, lecturerId: userIds[3] }));
    expect(res.error).toMatch(/must belong to your department/);
  });

  it("TEST 57 — HoD can add a co-lecturer from their own department", async () => {
    const assignment = await prisma.courseAssignment.findUnique({
      where: { courseCode_academicSession_semester: { courseCode: fx.CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } },
    });
    expect(assignment).toBeTruthy();
    await as(fx.HOD_CS);
    const res = await actions.addCourseTeamLecturer(null, fd({ courseAssignmentId: assignment!.id, lecturerId: userIds[4] }));
    expect(res).toEqual({ ok: true });

    const member = await prisma.courseAssignmentMember.findFirst({
      where: { courseAssignmentId: assignment!.id, lecturerId: userIds[4] },
    });
    expect(member).toBeTruthy();
  });

  it("TEST 58 — session-scoped aggregation excludes results from other sessions", async () => {
    const before = await getResultPipelineStats({}, { course: { code: fx.CS } });

    const cross = await prisma.result.create({
      data: {
        userId: studentIds[0],
        courseId: C_CS,
        academicSession: "2024/2025",
        semester: 2,
        caScore: 30,
        examScore: 40,
        total: 70,
        grade: "B",
        gradeStatus: "SUBMITTED",
        submittedById: userIds[1],
      },
    });

    try {
      const raw = await prisma.result.groupBy({
        by: ["gradeStatus"],
        where: { courseId: C_CS, academicSession: "2024/2025", semester: 2 },
        _count: { _all: true },
      });
      expect(raw.find((r) => r.gradeStatus === "SUBMITTED")?._count._all ?? 0).toBe(1);

      const shared = await getResultPipelineStats({}, { course: { code: fx.CS } });
      expect(shared.byStage).toEqual(before.byStage);
      expect(shared.total).toBe(before.total);
    } finally {
      await prisma.result.delete({ where: { id: cross.id } });
    }
  });

  it("TEST 59 — resultsPipeline stays in lock-step with the shared pipeline helper", async () => {
    const fixed: ResultPipelineStats = {
      academicSession: CURRENT_SESSION,
      semester: CURRENT_SEMESTER,
      total: 42,
      byStage: { SUBMITTED: 10, HOD_APPROVED: 12, SENATE_APPROVED: 15, FINAL: 5 },
      finalised: 5,
      inProgress: 37,
      completionPct: 12,
    };
    vi.mocked(getResultPipelineStats).mockImplementationOnce(async () => fixed);

    const pipeline = await resultsPipeline(50);
    const stageCounts = Object.fromEntries(pipeline.stages.map((s) => [s.stage, s.count]));
    expect(stageCounts).toEqual(fixed.byStage);
    expect(pipeline.total).toBe(fixed.total);
  });

  it("TEST 60 — HOD can create and toggle a course offering; departmental scope is server-derived", async () => {
    await as(fx.HOD_CS);
    const created = await actions.createCourseOffering(
      null,
      fd({ courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, level: 200, status: "ACTIVE" }),
    );
    expect(created).toEqual({ ok: true });
    const offering = await prisma.courseOffering.findFirst({
      where: { courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, level: 200 },
    });
    expect(offering?.status).toBe("ACTIVE");
    offeringIds.push(offering!.id);

    const off = await actions.setCourseOfferingStatus(null, fd({ id: offering!.id, status: "INACTIVE" }));
    expect(off).toEqual({ ok: true });
    expect((await prisma.courseOffering.findUnique({ where: { id: offering!.id } }))?.status).toBe("INACTIVE");
    const on = await actions.setCourseOfferingStatus(null, fd({ id: offering!.id, status: "ACTIVE" }));
    expect(on).toEqual({ ok: true });
    expect((await prisma.courseOffering.findUnique({ where: { id: offering!.id } }))?.status).toBe("ACTIVE");

    await as(fx.LEC_MAIN);
    const lec = await actions.createCourseOffering(
      null,
      fd({ courseId: C_CS, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, level: 200, status: "ACTIVE" }),
    );
    expect(lec.error).toMatch(/Only Heads of Department/);

    await as(fx.HOD_CS);
    const eng = await actions.createCourseOffering(
      null,
      fd({ courseId: C_ENG, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, level: 200, status: "ACTIVE" }),
    );
    expect(eng.error).toMatch(/own department/);

    const engOffering = await prisma.courseOffering.create({
      data: { courseId: C_ENG, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, level: 300, status: "ACTIVE" },
    });
    offeringIds.push(engOffering.id);
    const engToggle = await actions.setCourseOfferingStatus(null, fd({ id: engOffering.id, status: "INACTIVE" }));
    expect(engToggle.error).toMatch(/own department/);
    expect((await prisma.courseOffering.findUnique({ where: { id: engOffering.id } }))?.status).toBe("ACTIVE");
  });

  it("TEST 61 — client-supplied session/semester cannot bypass result authorization", async () => {
    await as(fx.LEC_MAIN);
    const before = await prisma.result.count({ where: { courseId: C_CS } });

    const bogusSession = new FormData();
    bogusSession.append("courseCode", fx.CS);
    bogusSession.append("session", "1999/2000");
    bogusSession.append("semester", String(CURRENT_SEMESTER));
    bogusSession.append("caMax", "30");
    bogusSession.append("contentType", "BOTH");
    bogusSession.append("file", new File(["MATRIC_NO,CA,EXAM\n23/ACW/0001,30,40\n"], "results.csv", { type: "text/csv" }));
    const res1 = await lecturerActions.postResultsAction(null, bogusSession);
    expect(res1.error).toMatch(/not assigned/);

    const bogusSemester = new FormData();
    bogusSemester.append("courseCode", fx.CS);
    bogusSemester.append("session", CURRENT_SESSION);
    bogusSemester.append("semester", "9");
    bogusSemester.append("caMax", "30");
    bogusSemester.append("contentType", "BOTH");
    bogusSemester.append("file", new File(["MATRIC_NO,CA,EXAM\n23/ACW/0001,30,40\n"], "results.csv", { type: "text/csv" }));
    const res2 = await lecturerActions.postResultsAction(null, bogusSemester);
    expect(res2.error).toMatch(/Select a semester/);

    expect(await prisma.result.count({ where: { courseId: C_CS } })).toBe(before);
  });

  it("TEST 62 — an unauthorized or fully-invalid result batch writes zero results", async () => {
    const before = await prisma.result.count({ where: { courseId: C_CS } });

    await as(fx.LEC_ENG);
    const unauth = await lecturerActions.postResultsAction(
      null,
      csvForm(fx.CS, "MATRIC_NO,CA,EXAM\n23/ACW/0001,30,40\n"),
    );
    expect(unauth.error).toBeTruthy();
    expect(await prisma.result.count({ where: { courseId: C_CS } })).toBe(before);

    await as(fx.LEC_MAIN);
    const invalid = await lecturerActions.postResultsAction(
      null,
      csvForm(fx.CS, "MATRIC_NO,CA,EXAM\n99/ACW/9999,30,40\n00/ACW/0000,20,20\n"),
    );
    expect(invalid.summary?.processed).toBe(0);
    expect(invalid.summary?.failed).toBe(2);
    expect(await prisma.result.count({ where: { courseId: C_CS } })).toBe(before);
  });

  it("TEST 63 — an out-of-scope HOD approval attempt mutates nothing", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[0], courseId: C_ENG } });
    expect(target?.gradeStatus).toBe("HOD_APPROVED");
    const before = target!.gradeStatus;

    await as(fx.HOD_CS);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toBeTruthy();

    const after = await prisma.result.findUnique({ where: { id: target!.id } });
    expect(after?.gradeStatus).toBe(before);
    expect(after?.approvedBy1Id).toBeNull();
    const auditRows = await prisma.auditLog.findMany({ where: { targetId: target!.id, action: "APPROVE" } });
    expect(auditRows).toHaveLength(0);
  });

  it("TEST 64 — a governance-role user without an ACTIVE membership cannot reach the DVC workspace", async () => {
    await as(fx.GOV);
    await expect(requireGovernanceOversight()).rejects.toThrow("REDIRECT");

    const govUser = await prisma.user.findUnique({ where: { email: fx.GOV } });
    const membership = await prisma.committeeMembership.create({
      data: { committee: "GOVERNANCE_OVERSIGHT", userId: govUser!.id, designation: "MEMBER", status: "ACTIVE" },
    });
    try {
      const ok = await requireGovernanceOversight();
      expect(ok.session.user.role).toBe("GOVERNANCE_OVERSIGHT_MEMBER");
      expect(ok.membership).toBeTruthy();
    } finally {
      await prisma.committeeMembership.delete({ where: { id: membership.id } });
    }
  });

  it("TEST 65 — lock-step aggregation: department, faculty and university agree for a controlled dataset", async () => {
    const x = `ACW_LKX_${fx.suffix}`;
    const y = `ACW_LKY_${fx.suffix}`;
    const cX = await createCourse(x);
    const cY = await createCourse(y);
    await prisma.courseAssignment.create({
      data: { courseCode: x, courseTitle: `ACW ${x}`, faculty: "Faculty of Science", department: "Computer Science", lecturerId: userIds[1], assignedById: userIds[0], academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });
    await prisma.courseAssignment.create({
      data: { courseCode: y, courseTitle: `ACW ${y}`, faculty: "Faculty of Engineering", department: "Mechanical Engineering", lecturerId: userIds[3], assignedById: userIds[0], academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
    });

    const mk = (userId: string, courseId: string, gradeStatus: string, extra: Record<string, unknown> = {}) =>
      prisma.result.create({
        data: { userId, courseId, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, caScore: 30, examScore: 40, total: 70, grade: "B", gradeStatus, submittedById: userIds[1], ...extra },
      });
    const createdIds: string[] = [];
    const track = async (p: Promise<{ id: string }>) => {
      const row = await p;
      createdIds.push(row.id);
      return row;
    };
    try {
      await track(mk(studentIds[0], cX, "SUBMITTED"));
      await track(mk(studentIds[1], cX, "HOD_APPROVED"));
      await track(mk(studentIds[2], cX, "SENATE_APPROVED"));
      await track(mk(studentIds[3], cX, "FINAL"));
      await track(mk(studentIds[0], cX, "SUBMITTED", { academicSession: "2024/2025", semester: 2 }));
      await track(mk(studentIds[1], cY, "SUBMITTED"));

      const dept = await getResultPipelineStats({}, { course: { code: x } });
      expect(dept.academicSession).toBe(CURRENT_SESSION);
      expect(dept.semester).toBe(CURRENT_SEMESTER);
      expect(dept.total).toBe(4);
      expect(dept.byStage).toEqual({ SUBMITTED: 1, HOD_APPROVED: 1, SENATE_APPROVED: 1, FINAL: 1 });

      expect(await prisma.result.count({ where: { courseId: cX, academicSession: "2024/2025" } })).toBe(1);

      const sciCodes = await facultyCourseCodes("Faculty of Science", await facultyDepartments("Faculty of Science"));
      expect(sciCodes).toContain(x);
      expect(sciCodes).not.toContain(y);
      const engCodes = await facultyCourseCodes("Faculty of Engineering", await facultyDepartments("Faculty of Engineering"));
      expect(engCodes).toContain(y);
      expect(engCodes).not.toContain(x);

      const truth = await prisma.result.groupBy({
        by: ["gradeStatus"],
        where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, course: { code: { in: [x] } } },
        _count: { _all: true },
      });
      const truthMap = Object.fromEntries(truth.map((r) => [r.gradeStatus, r._count._all]));
      expect(truthMap).toEqual({ SUBMITTED: 1, HOD_APPROVED: 1, SENATE_APPROVED: 1, FINAL: 1 });

      const uniX = await getResultPipelineStats({}, { course: { code: x } });
      const uniY = await getResultPipelineStats({}, { course: { code: y } });
      expect(uniX.byStage).toEqual(dept.byStage);
      expect(uniY).toMatchObject({ total: 1, byStage: { SUBMITTED: 1 } });

      const pipeline = await resultsPipeline(500);
      const byStage = Object.fromEntries(pipeline.stages.map((s) => [s.stage, s.count]));
      expect(byStage.SUBMITTED).toBeGreaterThanOrEqual(uniX.byStage.SUBMITTED + uniY.byStage.SUBMITTED);
      expect(byStage.HOD_APPROVED).toBeGreaterThanOrEqual(1);
      expect(byStage.SENATE_APPROVED).toBeGreaterThanOrEqual(1);
      expect(byStage.FINAL).toBeGreaterThanOrEqual(1);
      expect(pipeline.total).toBeGreaterThanOrEqual(uniX.total + uniY.total);

      const gov = await governanceStats();
      expect(gov.results.submitted).toBeGreaterThanOrEqual(2);
      expect(gov.results.hodApproved).toBeGreaterThanOrEqual(1);
      expect(gov.results.senateApproved).toBeGreaterThanOrEqual(1);
      expect(gov.results.final).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.result.deleteMany({ where: { id: { in: createdIds } } });
      await prisma.courseAssignment.deleteMany({ where: { courseCode: { in: [x, y] } } });
    }
  });

  it("TEST 66 — the Dean cannot approve results (no new write authority at faculty level)", async () => {
    const target = await prisma.result.findFirst({ where: { userId: studentIds[2], courseId: C_CS2 } });
    expect(target?.gradeStatus).toBe("SUBMITTED");

    await as(fx.DEAN);
    const res = await actions.approveResult(null, fd({ id: target!.id }));
    expect(res.error).toBeTruthy();
    expect((await prisma.result.findUnique({ where: { id: target!.id } }))?.gradeStatus).toBe("SUBMITTED");
  });
});
