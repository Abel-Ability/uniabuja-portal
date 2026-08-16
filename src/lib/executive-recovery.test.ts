import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { SESSION_COOKIE } from "./constants";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const AGENT = "vitest-exec-recovery";
const SESSION = "2025/2026";

const state = vi.hoisted(() => ({ token: "" as string }));

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

const actions = await import("./module-actions");
const { hodPendingResultRows, hodScopedAppeals } = await import("./hod");
const vcExport = await import("../app/portal/vc/reports/export/route");
const dvcExport = await import("../app/portal/dvc/reports/export/route");

let hodId: string;
let lecturerId: string;
let ownStudentId: string;
let otherStudentId: string;

let courseOwnId: string;
let courseOtherId: string;
let courseUnallocatedId: string;
let coursePendingId: string;

let resOwnId: string;
let resOtherId: string;
let resUnallocatedId: string;
let resPendingId: string;

let appealOwnId: string;
let appealOtherId: string;

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

function fd(entries: Record<string, string | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) if (v !== undefined) f.append(k, v);
  return f;
}

function routeReq(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers({ "x-forwarded-for": "127.0.0.1", "user-agent": AGENT }),
  } as unknown as NextRequest;
}

describe("executive governance RED defect remediation (integration)", () => {
  beforeAll(async () => {
    const [hod, lecturer, student] = await Promise.all([
      prisma.user.findUnique({ where: { email: "aca140@uniabuja.edu.ng" } }),
      prisma.user.findUnique({ where: { email: "aca3879@uniabuja.edu.ng" } }),
      prisma.user.findUnique({ where: { email: "student@uniabuja.edu.ng" } }),
    ]);
    if (!hod || !lecturer || !student) throw new Error("missing seed users");
    hodId = hod.id;
    lecturerId = lecturer.id;

    const [own, other] = await Promise.all([
      prisma.user.create({
        data: {
          username: "EXEC-HOD-OWN", email: `exec-hod-own@uniabuja.local`,
          passwordHash: "x", role: "STUDENT", firstName: "Own", lastName: "Student",
          fullName: "Own Dept Student",
          department: "Computer Science", programmeId: student.programmeId,
        },
      }),
      prisma.user.create({
        data: {
          username: "EXEC-HOD-OTHER", email: `exec-hod-other@uniabuja.local`,
          passwordHash: "x", role: "STUDENT", firstName: "Other", lastName: "Student",
          fullName: "Other Dept Student",
          department: "Engineering", programmeId: student.programmeId,
        },
      }),
    ]);
    ownStudentId = own.id;
    otherStudentId = other.id;

    const [co, cx, cu, cp] = await Promise.all([
      prisma.course.create({ data: { code: "TESTHOD001", title: "HoD Scope Own", units: 3, level: 200, semester: 1 } }),
      prisma.course.create({ data: { code: "TESTHOD002", title: "HoD Scope Other", units: 3, level: 200, semester: 1 } }),
      prisma.course.create({ data: { code: "TESTHOD003", title: "HoD Scope Unallocated", units: 3, level: 200, semester: 1 } }),
      prisma.course.create({ data: { code: "TESTHOD004", title: "HoD Scope Pending", units: 3, level: 200, semester: 1 } }),
    ]);
    courseOwnId = co.id;
    courseOtherId = cx.id;
    courseUnallocatedId = cu.id;
    coursePendingId = cp.id;

    await Promise.all([
      prisma.courseAssignment.create({
        data: {
          courseId: courseOwnId, courseCode: "TESTHOD001", courseTitle: co.title,
          department: "Computer Science", lecturerId, assignedById: hodId,
          academicSession: SESSION, semester: 1,
        },
      }),
      prisma.courseAssignment.create({
        data: {
          courseId: courseOtherId, courseCode: "TESTHOD002", courseTitle: cx.title,
          department: "Engineering", lecturerId, assignedById: hodId,
          academicSession: SESSION, semester: 1,
        },
      }),
      prisma.courseAssignment.create({
        data: {
          courseId: coursePendingId, courseCode: "TESTHOD004", courseTitle: cp.title,
          department: "Computer Science", lecturerId, assignedById: hodId,
          academicSession: SESSION, semester: 1,
        },
      }),
    ]);

    const [ro, rx, ru, rp] = await Promise.all([
      prisma.result.create({
        data: {
          userId: ownStudentId, courseId: courseOwnId, academicSession: SESSION, semester: 1,
          caScore: 35, examScore: 40, total: 75, grade: "B", gradeStatus: "SUBMITTED", submittedById: lecturerId,
        },
      }),
      prisma.result.create({
        data: {
          userId: otherStudentId, courseId: courseOtherId, academicSession: SESSION, semester: 1,
          caScore: 30, examScore: 30, total: 60, grade: "C", gradeStatus: "SUBMITTED", submittedById: lecturerId,
        },
      }),
      prisma.result.create({
        data: {
          userId: ownStudentId, courseId: courseUnallocatedId, academicSession: SESSION, semester: 1,
          caScore: 20, examScore: 20, total: 40, grade: "D", gradeStatus: "SUBMITTED", submittedById: lecturerId,
        },
      }),
      prisma.result.create({
        data: {
          userId: otherStudentId, courseId: coursePendingId, academicSession: SESSION, semester: 1,
          caScore: 33, examScore: 38, total: 71, grade: "B", gradeStatus: "SUBMITTED", submittedById: lecturerId,
        },
      }),
    ]);
    resOwnId = ro.id;
    resOtherId = rx.id;
    resUnallocatedId = ru.id;
    resPendingId = rp.id;
  });

  afterAll(async () => {
    const sessions = await prisma.session.findMany({ where: { userAgent: AGENT }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } });

    await prisma.result.deleteMany({ where: { id: { in: [resOwnId, resOtherId, resUnallocatedId, resPendingId] } } });
    await prisma.appeal.deleteMany({ where: { userId: { in: [ownStudentId, otherStudentId] } } });
    await prisma.courseAssignment.deleteMany({
      where: { courseCode: { in: ["TESTHOD001", "TESTHOD002", "TESTHOD004"] } },
    });
    await prisma.course.deleteMany({ where: { id: { in: [courseOwnId, courseOtherId, courseUnallocatedId, coursePendingId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownStudentId, otherStudentId] } } });
    await prisma.session.deleteMany({ where: { userAgent: AGENT } });
  });

  it("TEST 1 — HOD approves a SUBMITTED result for a course in their own department", async () => {
    await as("aca140@uniabuja.edu.ng");
    const res = await actions.approveResult(null, fd({ id: resOwnId }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: resOwnId } });
    expect(after!.gradeStatus).toBe("HOD_APPROVED");
    expect(after!.approvedBy1Id).toBe(hodId);
    expect(after!.approvedAt1).toBeTruthy();
  });

  it("TEST 2 — HOD cross-department approval is rejected (no mutation, no success audit)", async () => {
    const auditBefore = await prisma.auditLog.count({
      where: { targetId: resOtherId, action: "APPROVE", module: "EXAMS_RECORDS" },
    });
    await as("aca140@uniabuja.edu.ng");
    const res = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(res.error).toMatch(/own department/);
    const after = await prisma.result.findUnique({ where: { id: resOtherId } });
    expect(after!.gradeStatus).toBe("SUBMITTED");
    const auditAfter = await prisma.auditLog.count({
      where: { targetId: resOtherId, action: "APPROVE", module: "EXAMS_RECORDS" },
    });
    expect(auditAfter).toBe(auditBefore);
  });

  it("TEST 3 — direct server-action invocation of cross-department approval is rejected", async () => {
    await as("aca140@uniabuja.edu.ng");
    const res = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(res.error).toMatch(/own department/);
  });

  it("TEST 4 — non-HOD roles cannot approve results", async () => {
    await as("aca3879@uniabuja.edu.ng");
    const lec = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(lec.error).toMatch(/cannot approve/);
    await as("aca8614@uniabuja.edu.ng");
    const dean = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(dean.error).toMatch(/cannot approve/);
    await as("student@uniabuja.edu.ng");
    const stu = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(stu.error).toMatch(/cannot approve/);
  });

  it("TEST 5 — HOD pending pipeline lists only own-department SUBMITTED results", async () => {
    const rows = await hodPendingResultRows({ department: "Computer Science" }, { take: 100 });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(resPendingId);
    expect(ids).not.toContain(resOtherId);
    expect(ids).not.toContain(resUnallocatedId);
    expect(ids).not.toContain(resOwnId);
    expect(rows.every((r) => r.gradeStatus === "SUBMITTED")).toBe(true);
  });

  it("TEST 6 — course/result identifier manipulation cannot bypass the departmental scope", async () => {
    await as("aca140@uniabuja.edu.ng");
    const unallocated = await actions.approveResult(null, fd({ id: resUnallocatedId }));
    expect(unallocated.error).toMatch(/own department/);
    const other = await actions.approveResult(null, fd({ id: resOtherId }));
    expect(other.error).toMatch(/own department/);
    const [u, o] = await Promise.all([
      prisma.result.findUnique({ where: { id: resUnallocatedId } }),
      prisma.result.findUnique({ where: { id: resOtherId } }),
    ]);
    expect(u!.gradeStatus).toBe("SUBMITTED");
    expect(o!.gradeStatus).toBe("SUBMITTED");
  });

  it("TEST 7 — pipeline stage transitions stay intact (SUBMITTED→HOD_APPROVED→SENATE_APPROVED)", async () => {
    await as("aca140@uniabuja.edu.ng");
    const double = await actions.approveResult(null, fd({ id: resOwnId }));
    expect(double.error).toMatch(/Not ready for your approval/);
    const before = await prisma.result.findUnique({ where: { id: resOwnId } });
    expect(before!.gradeStatus).toBe("HOD_APPROVED");
    expect(before!.published).toBe(false);

    await as("ss953@uniabuja.edu.ng");
    const exams = await actions.approveResult(null, fd({ id: resOwnId }));
    expect(exams).toEqual({ ok: true });
    const after = await prisma.result.findUnique({ where: { id: resOwnId } });
    expect(after!.gradeStatus).toBe("SENATE_APPROVED");
    expect(after!.published).toBe(true);
    expect(after!.approvedBy2Id).toBeTruthy();
  });

  it("TEST 8 — HOD appeal queue and review are scoped to own-department students", async () => {
    await as(`exec-hod-own@uniabuja.local`);
    const own = await actions.fileAppeal(null, fd({ caseType: "GRADE", grounds: "Regression fixture" }));
    expect(own).toEqual({ ok: true });
    await as(`exec-hod-other@uniabuja.local`);
    const other = await actions.fileAppeal(null, fd({ caseType: "GRADE", grounds: "Regression fixture" }));
    expect(other).toEqual({ ok: true });

    const ownAppeal = await prisma.appeal.findFirstOrThrow({
      where: { userId: ownStudentId, caseType: "GRADE" },
      orderBy: { createdAt: "desc" },
    });
    const otherAppeal = await prisma.appeal.findFirstOrThrow({
      where: { userId: otherStudentId, caseType: "GRADE" },
      orderBy: { createdAt: "desc" },
    });
    appealOwnId = ownAppeal.id;
    appealOtherId = otherAppeal.id;

    const visible = await hodScopedAppeals({ department: "Computer Science" }, { take: 100 });
    const visibleIds = visible.map((a) => a.id);
    expect(visibleIds).toContain(appealOwnId);
    expect(visibleIds).not.toContain(appealOtherId);

    await as("aca140@uniabuja.edu.ng");
    const cross = await actions.reviewAppeal(null, fd({ id: appealOtherId, decision: "APPROVED" }));
    expect(cross.error).toMatch(/own department/);
    const crossAfter = await prisma.appeal.findUnique({ where: { id: appealOtherId } });
    expect(crossAfter!.status).toBe("SUBMITTED");

    const ownOk = await actions.reviewAppeal(null, fd({ id: appealOwnId, decision: "APPROVED" }));
    expect(ownOk).toEqual({ ok: true });
    const ownAfter = await prisma.appeal.findUnique({ where: { id: appealOwnId } });
    expect(ownAfter!.status).toBe("UNDER_REVIEW");

    await as("ss953@uniabuja.edu.ng");
    const examsOk = await actions.reviewAppeal(null, fd({ id: appealOtherId, decision: "APPROVED" }));
    expect(examsOk).toEqual({ ok: true });
    const examsAfter = await prisma.appeal.findUnique({ where: { id: appealOtherId } });
    expect(examsAfter!.status).toBe("UNDER_REVIEW");
  });

  it("TEST 9 — VC CSV export returns 200 with CSV payload and audits the export", async () => {
    await as("aca3998@uniabuja.edu.ng");
    const res = await vcExport.GET(routeReq("http://localhost/portal/vc/reports/export?report=students-register"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const body = await res.text();
    expect(body.split("\n")[0]).toContain("Registration No");
    const audits = await prisma.auditLog.count({
      where: { action: "EXPORT", module: "GOVERNANCE", targetType: "REPORT", targetId: "students-register" },
    });
    expect(audits).toBeGreaterThan(0);
  });

  it("TEST 10 — non-VC roles cannot export VC reports (403)", async () => {
    await as("aca8614@uniabuja.edu.ng");
    const dean = await vcExport.GET(routeReq("http://localhost/portal/vc/reports/export?report=students-register"));
    expect(dean.status).toBe(403);
    await as("sbc@uniabuja.edu.ng");
    const sbc = await vcExport.GET(routeReq("http://localhost/portal/vc/reports/export?report=students-register"));
    expect(sbc.status).toBe(403);
  });

  it("TEST 11 — unknown report slug on the VC export returns 404", async () => {
    await as("aca3998@uniabuja.edu.ng");
    const res = await vcExport.GET(routeReq("http://localhost/portal/vc/reports/export?report=no-such-report"));
    expect(res.status).toBe(404);
  });

  it("TEST 12 — DVC governance export still works (membership-gated) and blocks outsiders", async () => {
    await as("gov@uniabuja.edu.ng");
    const ok = await dvcExport.GET(routeReq("http://localhost/portal/dvc/reports/export?report=staff-register"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toMatch(/text\/csv/);
    const body = await ok.text();
    expect(body.split("\n")[0]).toContain("Staff No");

    await as("ss5762@uniabuja.edu.ng");
    const denied = await dvcExport.GET(routeReq("http://localhost/portal/dvc/reports/export?report=staff-register"));
    expect(denied.status).toBe(403);
  });
});
