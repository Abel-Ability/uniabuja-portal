import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE } from "./constants";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

const state = vi.hoisted(() => ({ token: "" as string }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? "127.0.0.1" : name === "user-agent" ? "vitest-smoke" : null,
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
const applyActions = await import("../app/(public)/apply/actions");
const loginHelpers = await import("../app/login/actions");
const verification = await import("../lib/verification");
import { validatePasswordPolicy } from "./password";

let studentId: string;
let alumniId: string;
let initial: {
  payments: string[];
  invoices: string[];
  paidInvoices: string[];
  transcriptRequests: string[];
  clearances: string[];
  feeBalanceCents: number;
  feeClearanceStatus: boolean;
};

async function makeTokenFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user ${email}`);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: "127.0.0.1",
      userAgent: "vitest-smoke",
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

describe("module actions (integration)", () => {
  beforeAll(async () => {
    const [stu, alumni] = await Promise.all([
      prisma.user.findUnique({ where: { email: "student@uniabuja.edu.ng" } }),
      prisma.user.findUnique({ where: { email: "alumni@uniabuja.edu.ng" } }),
    ]);
    if (!stu || !alumni) throw new Error("missing seed users");
    studentId = stu.id;
    alumniId = alumni.id;

    // snapshot state so afterAll can restore it (keeps the suite idempotent)
    const [payments, invoices, paidInvoices, transcriptRequests, clearances, feeAccount] = await Promise.all([
      prisma.payment.findMany({ where: { userId: studentId }, select: { id: true } }),
      prisma.invoice.findMany({ where: { userId: studentId }, select: { id: true } }),
      prisma.invoice.findMany({ where: { userId: studentId, status: "PAID" }, select: { id: true } }),
      prisma.transcriptRequest.findMany({ where: { userId: studentId }, select: { id: true } }),
      prisma.clearanceRequest.findMany({ where: { userId: alumniId }, select: { id: true } }),
      prisma.feeAccount.findUnique({ where: { userId: studentId }, select: { balanceCents: true, clearanceStatus: true } }),
    ]);
    initial = {
      payments: payments.map((p) => p.id),
      invoices: invoices.map((i) => i.id),
      paidInvoices: paidInvoices.map((i) => i.id),
      transcriptRequests: transcriptRequests.map((t) => t.id),
      clearances: clearances.map((c) => c.id),
      feeBalanceCents: feeAccount?.balanceCents ?? 0,
      feeClearanceStatus: feeAccount?.clearanceStatus ?? false,
    };
  });

  afterAll(async () => {
    const newClearances = await prisma.clearanceRequest.findMany({
      where: { userId: alumniId, id: { notIn: initial.clearances } },
      select: { id: true },
    });
    for (const c of newClearances) {
      const items = await prisma.clearanceItem.findMany({ where: { clearanceRequestId: c.id }, select: { id: true } });
      await prisma.clearanceItemApprovalLog.deleteMany({ where: { itemId: { in: items.map((i) => i.id) } } });
      await prisma.clearanceItem.deleteMany({ where: { clearanceRequestId: c.id } });
    }
    await prisma.clearanceRequest.deleteMany({
      where: { userId: alumniId, id: { notIn: initial.clearances } },
    });
    await prisma.transcriptRequest.deleteMany({
      where: { userId: studentId, id: { notIn: initial.transcriptRequests } },
    });
    await prisma.invoice.deleteMany({
      where: { userId: studentId, id: { notIn: initial.invoices } },
    });
    await prisma.payment.deleteMany({ where: { userId: studentId, id: { notIn: initial.payments } } });
    // restore any invoice my test marked PAID, and the fee account balance
    await prisma.invoice.updateMany({
      where: { userId: studentId, status: "PAID", id: { notIn: initial.paidInvoices } },
      data: { status: "OPEN" },
    });
    await prisma.feeAccount.update({
      where: { userId: studentId },
      data: { balanceCents: initial.feeBalanceCents, clearanceStatus: initial.feeClearanceStatus },
    });
    await prisma.session.deleteMany({ where: { userAgent: "vitest-smoke" } });
  });

  it("starts a clearance (fresh alumni user) with six department items", async () => {
    await as("alumni@uniabuja.edu.ng");
    const res = await actions.startClearance(null, fd({}));
    expect(res).toEqual({ ok: true });
    const request = await prisma.clearanceRequest.findFirst({
      where: { userId: alumniId },
      orderBy: { submittedAt: "desc" },
      include: { items: true },
    });
    expect(request).toBeTruthy();
    expect(request!.items).toHaveLength(6);
    expect(request!.items.map((i) => i.department).sort()).toEqual(
      ["BURSARY", "EXAMS", "HOSTEL", "LIBRARY", "SIWES", "SPORTS"],
    );
    expect(request!.status).toBe("IN_PROGRESS");
  });

  it("rejects a second clearance request", async () => {
    const res = await actions.startClearance(null, fd({}));
    expect(res.error).toMatch(/active clearance/);
  });

  it("pays an open invoice and marks it PAID", async () => {
    await as("student@uniabuja.edu.ng");
    const invoice = await prisma.invoice.findFirst({
      where: { userId: studentId, status: "OPEN" },
      include: { payments: true },
    });
    expect(invoice).toBeTruthy();
    const res = await actions.payInvoice(null, fd({ invoiceId: invoice!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.invoice.findUnique({
      where: { id: invoice!.id },
      include: { payments: true },
    });
    expect(after!.status).toBe("PAID");
    const paid = after!.payments.reduce((a, p) => a + p.amountCents, 0);
    expect(paid).toBe(after!.amountCents);
  });

  it("student cannot issue transcripts; exams cannot request or start clearance", async () => {
    await as("student@uniabuja.edu.ng");
    const issue = await actions.issueTranscript(null, fd({ id: "nope" }));
    expect(issue.error).toMatch(/permission/);
    await as("ss953@uniabuja.edu.ng");
    const t = await actions.requestTranscript(null, fd({ purpose: "JOB", copies: "1" }));
    expect(t.error).toMatch(/Only students/);
    const c = await actions.startClearance(null, fd({}));
    expect(c.error).toMatch(/Only students/);
  });

  it("hod signs off an EXAMS item on the alumni clearance", async () => {
    await as("alumni@uniabuja.edu.ng");
    const request = await prisma.clearanceRequest.findFirst({
      where: { userId: alumniId },
      orderBy: { submittedAt: "desc" },
    });
    const item = await prisma.clearanceItem.findFirst({
      where: { clearanceRequestId: request!.id, department: "EXAMS", status: "PENDING" },
    });
    expect(item).toBeTruthy();
    await as("aca140@uniabuja.edu.ng");
    const res = await actions.signOffClearance(null, fd({ itemId: item!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.clearanceItem.findUnique({ where: { id: item!.id } });
    expect(after!.status).toBe("SIGNED_OFF");
  });

  it("bursary signs off a BURSARY clearance item but not another department's", async () => {
    await as("alumni@uniabuja.edu.ng");
    const request = await prisma.clearanceRequest.findFirst({
      where: { userId: alumniId },
      orderBy: { submittedAt: "desc" },
    });
    let item = await prisma.clearanceItem.findFirst({
      where: { clearanceRequestId: request!.id, department: "BURSARY", status: "PENDING" },
    });
    let created = false;
    if (!item) {
      item = await prisma.clearanceItem.create({
        data: { clearanceRequestId: request!.id, department: "BURSARY", status: "PENDING" },
      });
      created = true;
    }
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.signOffClearance(null, fd({ itemId: item!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.clearanceItem.findUnique({ where: { id: item!.id } });
    expect(after!.status).toBe("SIGNED_OFF");
    if (created) {
      await prisma.clearanceItemApprovalLog.deleteMany({ where: { itemId: item!.id } });
      await prisma.clearanceItem.delete({ where: { id: item!.id } });
    }

    // Bursary still cannot sign off a department that is not its own.
    const other = await prisma.clearanceItem.findFirst({
      where: { clearanceRequestId: request!.id, department: "LIBRARY", status: "PENDING" },
    });
    if (other) {
      const denied = await actions.signOffClearance(null, fd({ itemId: other.id }));
      expect(denied.error).toMatch(/Item not found for your department/);
    }
  });

  it("requests a transcript, then exams issues it", async () => {
    await as("student@uniabuja.edu.ng");
    const req = await actions.requestTranscript(null, fd({
      purpose: "FURTHER_STUDY",
      destinationInstitution: "Test University",
      copies: "2",
      courier: "on",
      courierAddress: "1 Test St",
    }));
    expect(req).toEqual({ ok: true });
    const created = await prisma.transcriptRequest.findFirst({
      where: { userId: studentId, status: "QUEUED" },
      orderBy: { createdAt: "desc" },
    });
    expect(created).toBeTruthy();
    expect(created!.referenceNo).toMatch(/^TXN-\d{4}-\d{6}$/);
    await as("ss953@uniabuja.edu.ng");
    const res = await actions.issueTranscript(null, fd({ id: created!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.transcriptRequest.findUnique({ where: { id: created!.id } });
    expect(after!.status).toBe("ISSUED");
    expect(after!.issuedAt).toBeTruthy();
  }, 20_000);
});

describe("public application flow (no session)", () => {
  const email = `smoke-applicant-${Date.now()}@uniabuja.edu.ng`;
  const programmeId = "UG-SOCIOLOGY-BA";

  async function submit() {
    const ch = await applyActions.freshCaptchaChallenge();
    const digits = ch.question.match(/\d+/g) ?? ["0", "0"];
    const answer = String(Number(digits[0]) + Number(digits[1]));
    return applyActions.submitPublicApplication(null, fd({
      fullName: "Smoke Applicant",
      email,
      phone: "08000000000",
      dob: "2005-01-01",
      gender: "female",
      applicationType: "UTME",
      department: "Sociology",
      programmeId,
      programmeName: "B.A. Sociology",
      jambNo: "2026/99999999AB",
      jambScore: "240",
      parentConsent: "on",
      dataConsent: "on",
      captcha: ch.token,
      captchaAnswer: answer,
    }));
  }

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const appIds = (await prisma.application.findMany({
        where: { userId: user.id },
        select: { id: true },
      })).map((a) => a.id);
      await prisma.application.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: appIds } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("rejects a missing/bogus submission", async () => {
    const res = await applyActions.submitPublicApplication(null, fd({ website: "spam" }));
    expect(res.error).toMatch(/Invalid request/);
  });

  it("creates an applicant account and SUBMITTED application without a session", async () => {
    const res = await submit();
    expect(res.ok).toBe(true);
    expect(res.username).toBe(email.toUpperCase());
    expect(res.tempPassword).toBeTruthy();
    expect(validatePasswordPolicy(res.tempPassword!).ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    expect(user!.role).toBe("APPLICANT");
    expect(user!.mustChangePassword).toBe(true);
    expect(user!.username).toBe(email.toUpperCase());
    expect(user!.emailVerifiedAt).toBeNull();

    // Demo mode (no RESEND_API_KEY) returns the magic link to show on-screen.
    expect(res.verifyLink).toMatch(/\/verify-email\?token=/);
    const rawToken = new URLSearchParams(res.verifyLink!.split("?")[1]).get("token")!;
    const tokens = await prisma.emailVerificationToken.count({
      where: { userId: user!.id, usedAt: null },
    });
    expect(tokens).toBe(1);

    const v = await verification.verifyEmailToken(rawToken);
    expect(v.ok).toBe(true);
    const verified = await prisma.user.findUnique({ where: { email } });
    expect(verified!.emailVerifiedAt).toBeTruthy();

    const app = await prisma.application.findFirst({ where: { userId: user!.id } });
    expect(app).toBeTruthy();
    expect(app!.status).toBe("SUBMITTED");
    expect(app!.submittedAt).toBeTruthy();
  }, 30_000);

  it("rejects a second application from the same email", async () => {
    const res = await submit();
    expect(res.error).toMatch(/already have an application in progress/);
  });

  it("finds the seeded applicant via case-insensitive email fallback", async () => {
    const seeded = await prisma.user.findUnique({
      where: { email: "applicant@uniabuja.edu.ng" },
    });
    expect(seeded).toBeTruthy();
    const viaUpper = await loginHelpers.findUserByUsername("APPLICANT@UNIABUJA.EDU.NG");
    expect(viaUpper?.id).toBe(seeded!.id);
  });
});
