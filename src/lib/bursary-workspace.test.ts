// Bursary workspace integration tests (milestone: Bursary Financial Recovery).
//
// Covers the Phase-15 acceptance matrix for the restored Bursary workspace:
//   - unauthenticated callers are redirected away from Bursary-only actions
//   - non-Bursary roles are blocked from every Bursary-only action
//   - Bursary can issue invoices (and a tuition invoice re-blocks fee clearance)
//   - invalid student / invalid amount on invoice issuance is rejected
//   - payment state cannot be changed by the student (reconcile is Bursary-only)
//   - reconciliation requires Bursary, is audited, and never touches
//     PENDING/FAILED or already-reconciled payments
//   - waiver approval applies the percentage to the invoice (100% -> WAIVED and
//     fee-cleared; <100% -> PARTIAL with a reduced balance); rejection leaves
//     the invoice untouched
//   - scholarship approval/rejection records the decision with a note
//   - Bursary sign-off of a clearance item is authorized and audited
//
// Registration finalisation, HOD course-offering gating and the fee-clearance
// invariant are covered by their own suites (registration-finalisation.test.ts,
// student-registration.test.ts) and remain intact — this suite adds the new
// Bursary behaviours on top and asserts the RBAC boundary via
// constants.test.ts.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SESSION_COOKIE } from "./constants";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

const state = vi.hoisted(() => ({ token: "" as string }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? "127.0.0.1" : name === "user-agent" ? "vitest-bursary" : null,
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

let studentId: string;
let bursaryId: string;
let alumniId: string;
let seedInvoiceId: string;
let createdIds: string[];
let createdClearanceId: string | null = null;
let initialFeeAccount: { balanceCents: number; clearanceStatus: boolean };
let initialSeedInvoiceStatus: string;

const STUDENT_REG_NO = "12/345ABC/678";

async function makeTokenFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user ${email}`);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: "127.0.0.1",
      userAgent: "vitest-bursary",
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

describe("bursary workspace (integration)", () => {
  beforeAll(async () => {
    const [student, bursary, alumni] = await Promise.all([
      prisma.user.findUnique({ where: { email: "student@uniabuja.edu.ng" } }),
      prisma.user.findUnique({ where: { email: "ss5762@uniabuja.edu.ng" } }),
      prisma.user.findUnique({ where: { email: "alumni@uniabuja.edu.ng" } }),
    ]);
    if (!student || !bursary || !alumni) throw new Error("missing seed users");
    studentId = student.id;
    bursaryId = bursary.id;
    alumniId = alumni.id;
    const seedInvoice = await prisma.invoice.findFirst({
      where: { userId: studentId, module: "TUITION" },
      orderBy: { createdAt: "asc" },
    });
    if (!seedInvoice) throw new Error("missing seed tuition invoice");
    seedInvoiceId = seedInvoice.id;
    initialSeedInvoiceStatus = seedInvoice.status;
    const feeAccount = await prisma.feeAccount.findUnique({ where: { userId: studentId } });
    initialFeeAccount = {
      balanceCents: feeAccount?.balanceCents ?? 0,
      clearanceStatus: feeAccount?.clearanceStatus ?? false,
    };
    createdIds = [];
  });

  afterAll(async () => {
    // Remove every object this suite created, its audit trail, and restore the
    // seed rows we touched so the suite stays idempotent.
    if (createdClearanceId) {
      const cid = createdClearanceId;
      const items = await prisma.clearanceItem.findMany({ where: { clearanceRequestId: cid }, select: { id: true } });
      const itemIds = items.map((i) => i.id);
      await prisma.clearanceItemApprovalLog.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: itemIds } } });
      await prisma.clearanceItem.deleteMany({ where: { clearanceRequestId: cid } });
      await prisma.auditLog.deleteMany({ where: { targetId: cid } });
      await prisma.clearanceRequest.delete({ where: { id: cid } });
    }
    await prisma.auditLog.deleteMany({ where: { targetId: { in: createdIds } } });
    await prisma.waiver.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.scholarship.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.invoice.update({
      where: { id: seedInvoiceId },
      data: { status: initialSeedInvoiceStatus },
    });
    await prisma.feeAccount.update({
      where: { userId: studentId },
      data: { balanceCents: initialFeeAccount.balanceCents, clearanceStatus: initialFeeAccount.clearanceStatus },
    });
    await prisma.session.deleteMany({ where: { userAgent: "vitest-bursary" } });
  });

  it("TEST 1: unauthenticated callers are redirected away from Bursary actions", async () => {
    state.token = "";
    await expect(
      actions.issueInvoice(null, fd({ registrationNo: STUDENT_REG_NO, module: "TUITION", amountNaira: "1000", dueOn: "2026-12-31", description: "t" })),
    ).rejects.toThrow("REDIRECT");
    await expect(actions.reconcilePayment(null, fd({ paymentId: "nope" }))).rejects.toThrow("REDIRECT");
  });

  it("TEST 2: non-Bursary roles are blocked from every Bursary-only action", async () => {
    await as("student@uniabuja.edu.ng");
    const inv = await actions.issueInvoice(null, fd({ registrationNo: STUDENT_REG_NO, module: "TUITION", amountNaira: "1000", dueOn: "2026-12-31", description: "t" }));
    expect(inv.error).toMatch(/Only the Bursary/);
    const rec = await actions.reconcilePayment(null, fd({ paymentId: "nope" }));
    expect(rec.error).toMatch(/Only the Bursary/);
    const aw = await actions.approveWaiver(null, fd({ waiverId: "nope" }));
    expect(aw.error).toMatch(/Only the Bursary/);
    const rw = await actions.rejectWaiver(null, fd({ waiverId: "nope" }));
    expect(rw.error).toMatch(/Only the Bursary/);
    const ap = await actions.approveScholarship(null, fd({ scholarshipId: "nope" }));
    expect(ap.error).toMatch(/Only the Bursary/);
    const rp = await actions.rejectScholarship(null, fd({ scholarshipId: "nope" }));
    expect(rp.error).toMatch(/Only the Bursary/);
  });

  it("TEST 3: bursary issues a tuition invoice which re-blocks fee clearance", async () => {
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.issueInvoice(null, fd({
      registrationNo: STUDENT_REG_NO,
      module: "TUITION",
      amountNaira: "15000",
      dueOn: "2026-12-31",
      description: "Test tuition invoice",
    }));
    expect(res).toEqual({ ok: true });
    const invoice = await prisma.invoice.findFirst({
      where: { userId: studentId, module: "TUITION", status: "OPEN", description: "Test tuition invoice" },
      orderBy: { createdAt: "desc" },
    });
    expect(invoice).toBeTruthy();
    expect(invoice!.amountCents).toBe(1500000);
    createdIds.push(invoice!.id);
    const feeAccount = await prisma.feeAccount.findUnique({ where: { userId: studentId } });
    expect(feeAccount!.clearanceStatus).toBe(false);
    const audit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "CREATE", targetType: "INVOICE", targetId: invoice!.id, actorUserId: bursaryId },
    });
    expect(audit).toBeTruthy();
    expect(audit!.after && (audit!.after as Record<string, unknown>).amountCents).toBe(1500000);
  });

  it("TEST 4: issuing an invoice to an unknown registration number is rejected", async () => {
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.issueInvoice(null, fd({
      registrationNo: "99/999999/999",
      module: "TUITION",
      amountNaira: "1000",
      dueOn: "2026-12-31",
      description: "x",
    }));
    expect(res.error).toMatch(/No student with that registration number/);
  });

  it("TEST 5: issuing an invoice with an invalid amount is rejected", async () => {
    await as("ss5762@uniabuja.edu.ng");
    for (const amountNaira of ["0", "-5", "abc"]) {
      const res = await actions.issueInvoice(null, fd({
        registrationNo: STUDENT_REG_NO,
        module: "TUITION",
        amountNaira,
        dueOn: "2026-12-31",
        description: "x",
      }));
      expect(res.error).toMatch(/valid amount/i);
    }
    const over = await actions.issueInvoice(null, fd({
      registrationNo: STUDENT_REG_NO,
      module: "TUITION",
      amountNaira: "6000000000",
      dueOn: "2026-12-31",
      description: "x",
    }));
    expect(over.error).toMatch(/maximum/i);
  });

  it("TEST 6: the student cannot change payment state (reconcile is Bursary-only)", async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: studentId,
        module: "TUITION",
        reference: `TT-${Date.now()}-pending`,
        amountCents: 50000,
        channel: "TRANSFER",
        status: "PENDING",
      },
    });
    createdIds.push(payment.id);
    await as("student@uniabuja.edu.ng");
    const res = await actions.reconcilePayment(null, fd({ paymentId: payment.id }));
    expect(res.error).toMatch(/Only the Bursary/);
    const after = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(after!.status).toBe("PENDING");
  });

  it("TEST 7: reconciliation requires Bursary, clears the invoice and is audited", async () => {
    await as("ss5762@uniabuja.edu.ng");
    const payment = await prisma.payment.create({
      data: {
        invoiceId: seedInvoiceId,
        userId: studentId,
        module: "TUITION",
        reference: `TT-${Date.now()}-success`,
        amountCents: 2500000,
        channel: "REMITA",
        status: "SUCCESS",
      },
    });
    createdIds.push(payment.id);
    const res = await actions.reconcilePayment(null, fd({ paymentId: payment.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(after!.status).toBe("RECONCILED");
    expect(after!.tsaSwept).toBe(true);
    const invoice = await prisma.invoice.findUnique({ where: { id: seedInvoiceId } });
    expect(invoice!.status).toBe("PAID");
    const feeAccount = await prisma.feeAccount.findUnique({ where: { userId: studentId } });
    expect(feeAccount!.clearanceStatus).toBe(true);
    const audit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "RECONCILE", targetType: "PAYMENT", targetId: payment.id, actorUserId: bursaryId },
    });
    expect(audit).toBeTruthy();
    expect(audit!.before && (audit!.before as Record<string, unknown>).status).toBe("SUCCESS");
    expect(audit!.after && (audit!.after as Record<string, unknown>).status).toBe("RECONCILED");
  });

  it("TEST 8: reconciliation never moves PENDING or FAILED payments", async () => {
    const pending = await prisma.payment.create({
      data: {
        userId: studentId,
        module: "TUITION",
        reference: `TT-${Date.now()}-never`,
        amountCents: 50000,
        channel: "TRANSFER",
        status: "PENDING",
      },
    });
    const failed = await prisma.payment.create({
      data: {
        userId: studentId,
        module: "TUITION",
        reference: `TT-${Date.now()}-failed`,
        amountCents: 50000,
        channel: "CARD",
        status: "FAILED",
      },
    });
    createdIds.push(pending.id, failed.id);
    await as("ss5762@uniabuja.edu.ng");
    const r1 = await actions.reconcilePayment(null, fd({ paymentId: pending.id }));
    expect(r1.error).toMatch(/Only successful payments/);
    const r2 = await actions.reconcilePayment(null, fd({ paymentId: failed.id }));
    expect(r2.error).toMatch(/Only successful payments/);
    expect((await prisma.payment.findUnique({ where: { id: pending.id } }))!.status).toBe("PENDING");
    expect((await prisma.payment.findUnique({ where: { id: failed.id } }))!.status).toBe("FAILED");
  });

  it("TEST 9: reconciliation refuses an already-reconciled payment", async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: studentId,
        module: "TUITION",
        reference: `TT-${Date.now()}-done`,
        amountCents: 50000,
        channel: "REMITA",
        status: "RECONCILED",
        tsaSwept: true,
      },
    });
    createdIds.push(payment.id);
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.reconcilePayment(null, fd({ paymentId: payment.id }));
    expect(res.error).toMatch(/already reconciled/);
  });

  it("TEST 10: a 100% waiver approval waives the invoice and fee-clears the student", async () => {
    const invoice = await prisma.invoice.create({
      data: {
        userId: studentId,
        module: "TUITION",
        description: "Waiver fixture 100%",
        amountCents: 5000000,
        dueOn: new Date("2026-12-31"),
        status: "OPEN",
      },
    });
    const waiver = await prisma.waiver.create({
      data: { userId: studentId, invoiceId: invoice.id, title: "Full fee waiver", percent: 100, status: "PENDING" },
    });
    createdIds.push(invoice.id, waiver.id);
    await prisma.feeAccount.update({ where: { userId: studentId }, data: { clearanceStatus: false } });
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.approveWaiver(null, fd({ waiverId: waiver.id, decisionNote: "Approved 100%" }));
    expect(res).toEqual({ ok: true });
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } }))!.status).toBe("WAIVED");
    expect((await prisma.feeAccount.findUnique({ where: { userId: studentId } }))!.clearanceStatus).toBe(true);
    const w = await prisma.waiver.findUnique({ where: { id: waiver.id } });
    expect(w!.status).toBe("APPROVED");
    expect(w!.approvedById).toBe(bursaryId);
    const audit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "APPROVE", targetType: "WAIVER", targetId: waiver.id, actorUserId: bursaryId },
    });
    expect(audit).toBeTruthy();
    expect(audit!.after && (audit!.after as Record<string, unknown>).invoiceStatus).toBe("WAIVED");
  });

  it("TEST 11: a partial waiver approval reduces the invoice to a PARTIAL balance", async () => {
    const invoice = await prisma.invoice.create({
      data: {
        userId: studentId,
        module: "TUITION",
        description: "Waiver fixture 30%",
        amountCents: 100000,
        dueOn: new Date("2026-12-31"),
        status: "OPEN",
      },
    });
    const waiver = await prisma.waiver.create({
      data: { userId: studentId, invoiceId: invoice.id, title: "Partial waiver", percent: 30, status: "PENDING" },
    });
    createdIds.push(invoice.id, waiver.id);
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.approveWaiver(null, fd({ waiverId: waiver.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(after!.status).toBe("PARTIAL");
    expect(after!.amountCents).toBe(70000);
  });

  it("TEST 12: waiver rejection leaves the invoice untouched", async () => {
    const invoice = await prisma.invoice.create({
      data: {
        userId: studentId,
        module: "HOSTEL",
        description: "Waiver fixture rejected",
        amountCents: 200000,
        dueOn: new Date("2026-12-31"),
        status: "OPEN",
      },
    });
    const waiver = await prisma.waiver.create({
      data: { userId: studentId, invoiceId: invoice.id, title: "Denied waiver", percent: 50, status: "PENDING" },
    });
    createdIds.push(invoice.id, waiver.id);
    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.rejectWaiver(null, fd({ waiverId: waiver.id, decisionNote: "Not eligible" }));
    expect(res).toEqual({ ok: true });
    expect((await prisma.waiver.findUnique({ where: { id: waiver.id } }))!.status).toBe("REJECTED");
    const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(after!.status).toBe("OPEN");
    expect(after!.amountCents).toBe(200000);
    const audit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "UPDATE", targetType: "WAIVER", targetId: waiver.id },
    });
    expect(audit).toBeTruthy();
  });

  it("TEST 13: scholarship approval and rejection record decisions with notes", async () => {
    const approved = await prisma.scholarship.create({
      data: { userId: studentId, title: "Merit scholarship", amountCents: 500000, status: "PENDING" },
    });
    const rejected = await prisma.scholarship.create({
      data: { userId: studentId, title: "Need scholarship", amountCents: 300000, status: "PENDING" },
    });
    createdIds.push(approved.id, rejected.id);
    await as("ss5762@uniabuja.edu.ng");
    const r1 = await actions.approveScholarship(null, fd({ scholarshipId: approved.id, decisionNote: "Merit-based" }));
    expect(r1).toEqual({ ok: true });
    const r2 = await actions.rejectScholarship(null, fd({ scholarshipId: rejected.id, decisionNote: "No evidence" }));
    expect(r2).toEqual({ ok: true });
    const a = await prisma.scholarship.findUnique({ where: { id: approved.id } });
    expect(a!.status).toBe("APPROVED");
    expect(a!.approvedById).toBe(bursaryId);
    expect(a!.decisionNote).toBe("Merit-based");
    const r = await prisma.scholarship.findUnique({ where: { id: rejected.id } });
    expect(r!.status).toBe("REJECTED");
    expect(r!.decisionNote).toBe("No evidence");
    const approveAudit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "APPROVE", targetType: "SCHOLARSHIP", targetId: approved.id },
    });
    expect(approveAudit).toBeTruthy();
    const rejectAudit = await prisma.auditLog.findFirst({
      where: { module: "FEES", action: "UPDATE", targetType: "SCHOLARSHIP", targetId: rejected.id },
    });
    expect(rejectAudit).toBeTruthy();
  });

  it("TEST 14: Bursary sign-off of a clearance item is authorized and audited", async () => {
    await as("alumni@uniabuja.edu.ng");
    const start = await actions.startClearance(null, fd({}));
    expect(start).toEqual({ ok: true });
    const request = await prisma.clearanceRequest.findFirst({
      where: { userId: alumniId, clearanceType: "GRADUATION", status: "IN_PROGRESS" },
      orderBy: { submittedAt: "desc" },
      include: { items: true },
    });
    expect(request).toBeTruthy();
    const bursaryItem = request!.items.find((i) => i.department === "BURSARY");
    expect(bursaryItem).toBeTruthy();
    createdClearanceId = request!.id;

    await as("ss5762@uniabuja.edu.ng");
    const res = await actions.signOffClearance(null, fd({ itemId: bursaryItem!.id }));
    expect(res).toEqual({ ok: true });
    const after = await prisma.clearanceItem.findUnique({ where: { id: bursaryItem!.id } });
    expect(after!.status).toBe("SIGNED_OFF");
    const log = await prisma.clearanceItemApprovalLog.findFirst({
      where: { itemId: bursaryItem!.id, approverId: bursaryId },
    });
    expect(log).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({
      where: { module: "GRAD_CLEARANCE", action: "APPROVE", targetType: "CLEARANCE_ITEM", targetId: bursaryItem!.id, actorUserId: bursaryId },
    });
    expect(audit).toBeTruthy();
  });
});
