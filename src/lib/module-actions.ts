"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit, type AuditAction } from "@/lib/audit";
import { can } from "@/lib/constants";

export type ModuleActionResult = { error?: string; ok?: boolean };

const CLEARANCE_DEPTS: Record<string, string> = {
  BURSARY: "BURSARY",
  IT_ADMIN: "LIBRARY",
  STUDENT_AFFAIRS: "HOSTEL",
  HOD_DEAN: "EXAMS",
  SIWES: "SIWES",
  PG_SCHOOL: "SPORTS",
};

const TRANSCRIPT_COST_CENTS = 10000; // per copy
const COURIER_COST_CENTS = 2000;
const HOSTEL_FEE_CENTS = 7500000; // per session

// ---------------------------------------------------------------------------
// Fees: simulated payment against an invoice
// ---------------------------------------------------------------------------

export async function payInvoice(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { error: "Missing invoice." };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice || invoice.userId !== session.userId) {
    return { error: "Invoice not found." };
  }
  if (invoice.status === "PAID" || invoice.status === "WAIVED") {
    return { error: "This invoice is already settled." };
  }

  const paid = invoice.payments.reduce((a, p) => a + p.amountCents, 0);
  const remaining = invoice.amountCents - paid;
  if (remaining <= 0) {
    return { error: "No outstanding balance on this invoice." };
  }

  const reference = `RRR-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      userId: session.userId,
      module: invoice.module,
      reference,
      amountCents: remaining,
      channel: "REMITA",
      status: "RECONCILED",
      tsaSwept: true,
    },
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "PAID" },
  });

  const account = await prisma.feeAccount.findUnique({
    where: { userId: session.userId },
  });
  if (account) {
    await prisma.feeAccount.update({
      where: { id: account.id },
      data: {
        balanceCents: Math.max(0, account.balanceCents - remaining),
        clearanceStatus: account.balanceCents - remaining <= 0,
      },
    });
  }

  if (invoice.module === "HOSTEL") {
    const hostelApp = await prisma.hostelApplication.findFirst({
      where: { userId: session.userId },
    });
    if (hostelApp && !hostelApp.feeVerified) {
      await prisma.hostelApplication.update({
        where: { id: hostelApp.id },
        data: { feeVerified: true },
      });
    }
  }

  await writeAudit({
    action: "PAY",
    module: "FEES",
    targetType: "INVOICE",
    targetId: invoice.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { reference, amountCents: remaining, channel: "REMITA" },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transcripts: student request (creates a transcript invoice) + exams issue
// ---------------------------------------------------------------------------

export async function requestTranscript(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can request transcripts." };
  }

  const purpose = String(formData.get("purpose") ?? "");
  const destinationInstitution = String(formData.get("destinationInstitution") ?? "").trim();
  const copies = Math.max(1, Math.min(5, Number(formData.get("copies") ?? 1)));
  const courier = String(formData.get("courier") ?? "") === "on";

  if (!purpose) return { error: "Select a purpose." };
  if (purpose === "FURTHER_STUDY" && !destinationInstitution) {
    return { error: "Provide the destination institution." };
  }

  const count = await prisma.transcriptRequest.count();
  const referenceNo = `TXN-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;

  const amountCents = copies * TRANSCRIPT_COST_CENTS + (courier ? COURIER_COST_CENTS : 0);

  const request = await prisma.transcriptRequest.create({
    data: {
      userId: session.userId,
      purpose,
      destinationInstitution: destinationInstitution || null,
      copies,
      courier,
      courierAddress: courier ? (String(formData.get("courierAddress") ?? "").trim() || null) : null,
      status: "QUEUED",
      referenceNo,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      userId: session.userId,
      module: "TRANSCRIPT",
      description: `Transcript — ${copies} copy${copies > 1 ? "s" : ""}${courier ? " + courier" : ""} (${referenceNo})`,
      amountCents,
      dueOn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "OPEN",
    },
  });

  await writeAudit({
    action: "CREATE",
    module: "TRANSCRIPT",
    targetType: "TRANSCRIPT_REQUEST",
    targetId: request.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { referenceNo, invoiceId: invoice.id, amountCents },
  });

  return { ok: true, error: undefined };
}

export async function issueTranscript(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "TRANSCRIPT", "A")) {
    return { error: "You do not have permission to issue transcripts." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const tr = await prisma.transcriptRequest.findUnique({ where: { id } });
  if (!tr) return { error: "Request not found." };

  await prisma.transcriptRequest.update({
    where: { id: tr.id },
    data: { status: "ISSUED", issuedAt: new Date() },
  });
  await writeAudit({
    action: "APPROVE",
    module: "TRANSCRIPT",
    targetType: "TRANSCRIPT_REQUEST",
    targetId: tr.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: tr.status },
    after: { status: "ISSUED" },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Graduation: start clearance + departmental sign-off workflow
// ---------------------------------------------------------------------------

export async function startClearance(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can start clearance." };
  }

  const existing = await prisma.clearanceRequest.findFirst({
    where: { userId: session.userId },
  });
  if (existing) return { error: "You already have an active clearance request." };

  const clearance = await prisma.clearanceRequest.create({
    data: { userId: session.userId, clearanceType: "GRADUATION", status: "IN_PROGRESS" },
  });
  const departments = ["BURSARY", "LIBRARY", "HOSTEL", "SPORTS", "EXAMS", "SIWES"];
  for (const dept of departments) {
    await prisma.clearanceItem.create({
      data: { clearanceRequestId: clearance.id, department: dept, status: "PENDING" },
    });
  }

  await writeAudit({
    action: "CREATE",
    module: "GRAD_CLEARANCE",
    targetType: "CLEARANCE_REQUEST",
    targetId: clearance.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { departments },
  });
  return { ok: true };
}

export async function signOffClearance(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (!can(role, "GRAD_CLEARANCE", "A")) {
    return { error: "Your role cannot sign off clearance items." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const dept = CLEARANCE_DEPTS[role];
  if (!dept) return { error: "Your role has no clearance department." };

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.clearanceItem.findUnique({
    where: { id: itemId },
    include: { clearanceRequest: true },
  });
  if (!item || item.department !== dept) {
    return { error: "Item not found for your department." };
  }
  if (item.status === "SIGNED_OFF") return { error: "Already signed off." };

  await prisma.clearanceItem.update({
    where: { id: item.id },
    data: { status: "SIGNED_OFF", signedOffById: session.userId, signedOffAt: new Date() },
  });
  await prisma.clearanceItemApprovalLog.create({
    data: {
      itemId: item.id,
      department: dept,
      approverId: session.userId,
      requestId: item.clearanceRequestId,
    },
  });
  await writeAudit({
    action: "APPROVE",
    module: "GRAD_CLEARANCE",
    targetType: "CLEARANCE_ITEM",
    targetId: item.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: role,
    sessionId: session.id,
    after: { department: dept, status: "SIGNED_OFF" },
  });

  // complete the request when every item is signed off
  const remaining = await prisma.clearanceItem.count({
    where: { clearanceRequestId: item.clearanceRequestId, status: { not: "SIGNED_OFF" } },
  });
  if (remaining === 0) {
    await prisma.clearanceRequest.update({
      where: { id: item.clearanceRequestId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// High-assurance step-up check for sensitive actions
// ---------------------------------------------------------------------------

const STEP_UP_WINDOW_MS = 30 * 60 * 1000;

// When MFA is enabled, sensitive actions require a step-up in the last 30 min.
// Users without MFA enabled are treated as verified (demo posture).
export async function requireStepUp(
  user: { mfaEnabled: boolean },
  session: { stepUpUntil?: Date | null; mfaVerifiedAt?: Date | null },
): Promise<string | null> {
  if (!user.mfaEnabled) return null;
  const verified =
    session.stepUpUntil && session.stepUpUntil.getTime() > Date.now();
  if (verified) return null;
  if (session.mfaVerifiedAt) {
    const fresh = session.mfaVerifiedAt.getTime() + STEP_UP_WINDOW_MS > Date.now();
    if (fresh) return null;
  }
  return "Step-up authentication required. Verify a code on the Account page first.";
}

type SessionLike = {
  user: { mfaEnabled: boolean };
  stepUpUntil?: Date | null;
  mfaVerifiedAt?: Date | null;
};

async function stepUpGuard(session: SessionLike): Promise<string | null> {
  return requireStepUp(session.user, session);
}

// ---------------------------------------------------------------------------
// Accommodation (hostels)
// ---------------------------------------------------------------------------

export async function applyHostel(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ACCOMMODATION", "W")) {
    return { error: "Your role cannot apply for accommodation." };
  }

  const academicSession = String(formData.get("academicSession") ?? "2025/2026");
  const hostelId = String(formData.get("hostelId") ?? "");
  const roomType = String(formData.get("roomType") ?? "shared");

  const existing = await prisma.hostelApplication.findFirst({ where: { userId: session.userId } });
  if (existing) return { error: "You already have a hostel application on file." };

  const hostel = await prisma.hostel.findUnique({ where: { id: hostelId } });
  if (!hostel) return { error: "Select a hostel." };

  const app = await prisma.hostelApplication.create({
    data: {
      userId: session.userId,
      academicSession,
      hostelId: hostel.id,
      preference: { roomType, block: "" },
      status: "PENDING",
    },
  });
  await writeAudit({
    action: "CREATE",
    module: "ACCOMMODATION",
    targetType: "HOSTEL_APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { hostel: hostel.code, academicSession, roomType },
  });
  return { ok: true };
}

export async function allocateBed(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ACCOMMODATION", "A")) {
    return { error: "Your role cannot allocate beds." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const app = await prisma.hostelApplication.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { hostel: true },
  });
  if (!app) return { error: "No pending applications." };
  if (!app.hostelId) return { error: "Application has no hostel." };

  const bed = await prisma.bedSpace.findFirst({
    where: { hostelId: app.hostelId, status: "FREE" },
  });
  if (!bed) {
    await prisma.hostelApplication.update({
      where: { id: app.id },
      data: { status: "WAITLISTED" },
    });
    await writeAudit({
      action: "UPDATE",
      module: "ACCOMMODATION",
      targetType: "HOSTEL_APPLICATION",
      targetId: app.id,
      meta: metaFromHeaders(await headers()),
      actorUserId: session.userId,
      actorUsername: session.user.username,
      actorRole: session.user.role,
      sessionId: session.id,
      before: { status: "PENDING" },
      after: { status: "WAITLISTED", reason: "no free beds" },
    });
    return { error: `No free beds in ${app.hostel?.name ?? "hostel"} — applicant waitlisted.` };
  }

  await prisma.$transaction([
    prisma.hostelApplication.update({
      where: { id: app.id },
      data: { status: "ALLOCATED", allocatedBedId: bed.id, allocatedAt: new Date() },
    }),
    prisma.bedSpace.update({ where: { id: bed.id }, data: { status: "ALLOCATED" } }),
    prisma.hostel.update({ where: { id: app.hostelId }, data: { bedsAvailable: { decrement: 1 } } }),
  ]);

  const existingHostelInvoice = await prisma.invoice.findFirst({
    where: { userId: app.userId, module: "HOSTEL", status: { not: "WAIVED" } },
  });
  if (!existingHostelInvoice) {
    await prisma.invoice.create({
      data: {
        userId: app.userId,
        module: "HOSTEL",
        description: `Hostel accommodation — ${app.hostel?.name ?? "Hostel"} (${app.academicSession})`,
        amountCents: HOSTEL_FEE_CENTS,
        dueOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "OPEN",
      },
    });
  }

  await writeAudit({
    action: "UPDATE",
    module: "ACCOMMODATION",
    targetType: "HOSTEL_APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: "PENDING" },
    after: { status: "ALLOCATED", bedId: bed.id, room: bed.room, invoiceRaised: true },
  });
  return { ok: true };
}

export async function generateHostelInvoice(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ACCOMMODATION", "W")) {
    return { error: "Your role cannot request an accommodation invoice." };
  }

  const app = await prisma.hostelApplication.findFirst({
    where: { userId: session.userId },
    include: { hostel: true },
  });
  if (!app || app.status !== "ALLOCATED") {
    return { error: "No allocated bed to bill." };
  }
  if (app.feeVerified) return { error: "Accommodation fee already verified." };

  const existing = await prisma.invoice.findFirst({
    where: { userId: session.userId, module: "HOSTEL", status: { not: "WAIVED" } },
  });
  if (existing) {
    return existing.status === "PAID"
      ? { error: "Accommodation fee already paid." }
      : { error: "An accommodation invoice already exists." };
  }

  await prisma.invoice.create({
    data: {
      userId: session.userId,
      module: "HOSTEL",
      description: `Hostel accommodation — ${app.hostel?.name ?? "Hostel"} (${app.academicSession})`,
      amountCents: HOSTEL_FEE_CENTS,
      dueOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "OPEN",
    },
  });
  await writeAudit({
    action: "CREATE",
    module: "ACCOMMODATION",
    targetType: "HOSTEL_APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { invoice: "HOSTEL", amountCents: HOSTEL_FEE_CENTS },
  });
  return { ok: true };
}

export async function raiseMaintenance(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ACCOMMODATION", "W")) {
    return { error: "Your role cannot raise maintenance requests." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title || !description) return { error: "Enter a title and description." };

  const app = await prisma.hostelApplication.findFirst({ where: { userId: session.userId } });
  const req = await prisma.maintenanceRequest.create({
    data: { userId: session.userId, hostelId: app?.hostelId ?? null, title, description },
  });
  await writeAudit({
    action: "CREATE",
    module: "ACCOMMODATION",
    targetType: "MAINTENANCE_REQUEST",
    targetId: req.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { title },
  });
  return { ok: true };
}

export async function resolveMaintenance(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ACCOMMODATION", "A")) {
    return { error: "Your role cannot resolve maintenance requests." };
  }

  const id = String(formData.get("id") ?? "");
  const req = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!req) return { error: "Request not found." };

  await prisma.maintenanceRequest.update({
    where: { id: req.id },
    data: { status: "RESOLVED" },
  });
  await writeAudit({
    action: "UPDATE",
    module: "ACCOMMODATION",
    targetType: "MAINTENANCE_REQUEST",
    targetId: req.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: req.status },
    after: { status: "RESOLVED" },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SIWES / Industrial Training
// ---------------------------------------------------------------------------

export async function addLogbookEntry(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "SIWES", "W")) {
    return { error: "Your role cannot add logbook entries." };
  }

  const weekNo = Math.max(1, Math.min(52, Number(formData.get("weekNo") ?? 1)));
  const activities = String(formData.get("activities") ?? "").trim();
  if (!activities) return { error: "Describe the week's activities." };

  const record = await prisma.sIWESRecord.findFirst({
    where: { userId: session.userId, status: { in: ["ACTIVE", "SUBMITTED"] } },
    orderBy: { id: "desc" },
  });
  if (!record) return { error: "No active SIWES placement." };

  const entry = await prisma.logbookEntry.create({
    data: { siwesRecordId: record.id, weekNo, activities },
  });
  await writeAudit({
    action: "CREATE",
    module: "SIWES",
    targetType: "LOGBOOK_ENTRY",
    targetId: entry.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { weekNo, recordId: record.id },
  });
  return { ok: true };
}

export async function submitSiwesRecord(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "SIWES", "W")) {
    return { error: "Your role cannot submit a SIWES record." };
  }

  const record = await prisma.sIWESRecord.findFirst({
    where: { userId: session.userId, status: "ACTIVE" },
    orderBy: { id: "desc" },
  });
  if (!record) return { error: "No active placement to submit." };

  await prisma.sIWESRecord.update({ where: { id: record.id }, data: { status: "SUBMITTED" } });
  await writeAudit({
    action: "SUBMIT",
    module: "SIWES",
    targetType: "SIWES_RECORD",
    targetId: record.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: "ACTIVE" },
    after: { status: "SUBMITTED" },
  });
  return { ok: true };
}

export async function signOffSiwesRecord(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "SIWES", "A")) {
    return { error: "Your role cannot sign off SIWES records." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const record = await prisma.sIWESRecord.findUnique({
    where: { id },
    include: { logbookEntries: true },
  });
  if (!record) return { error: "Record not found." };
  if (record.logbookEntries.length === 0) {
    return { error: "Cannot sign off a record with no logbook entries." };
  }

  await prisma.sIWESRecord.update({ where: { id: record.id }, data: { status: "SIGNED_OFF" } });
  await writeAudit({
    action: "APPROVE",
    module: "SIWES",
    targetType: "SIWES_RECORD",
    targetId: record.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: record.status },
    after: { status: "SIGNED_OFF" },
  });
  return { ok: true };
}

export async function addVisitationReport(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "SIWES", "A")) {
    return { error: "Your role cannot add visitation reports." };
  }

  const recordId = String(formData.get("recordId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const record = await prisma.sIWESRecord.findUnique({ where: { id: recordId } });
  if (!record) return { error: "Placement not found." };
  if (!notes) return { error: "Enter visitation notes." };

  const report = await prisma.visitationReport.create({
    data: {
      siwesRecordId: record.id,
      coordinatorUserId: session.userId,
      visitedAt: new Date(),
      notes,
    },
  });
  await writeAudit({
    action: "CREATE",
    module: "SIWES",
    targetType: "VISITATION_REPORT",
    targetId: report.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { recordId: record.id },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admissions (applications)
// ---------------------------------------------------------------------------

export async function submitApplication(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "APPLICANT") {
    return { error: "Only applicants can submit applications." };
  }

  const active = await prisma.application.findFirst({
    where: { userId: session.userId, status: { in: ["DRAFT", "SUBMITTED", "SCREENING", "PENDING_CAPS"] } },
  });
  if (active) return { error: "You already have an application in progress." };

  const programmeId = String(formData.get("programmeId") ?? "");
  const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
  if (!programme) return { error: "Select a programme." };

  const jambNo = String(formData.get("jambNo") ?? "").trim() || session.user.jambNo || null;
  const eligibility = {
    totalScore: 287,
    utme: 242,
    oLevel: "8 points",
    eligible: true,
  };

  const app = await prisma.application.create({
    data: {
      userId: session.userId,
      programmeId: programme.id,
      jambNo,
      status: "SUBMITTED",
      eligibility,
      nipedsStatus: "UNVERIFIED",
      submittedAt: new Date(),
    },
  });
  await writeAudit({
    action: "SUBMIT",
    module: "ADMISSIONS",
    targetType: "APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { programmeId: programme.code, eligibility },
  });
  return { ok: true };
}

export async function uploadDocument(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMISSIONS", "W")) {
    return { error: "Your role cannot upload documents." };
  }

  const kind = String(formData.get("kind") ?? "");
  const fileName = String(formData.get("fileName") ?? "").trim();
  if (!["RESULT_SLIP", "CERTIFICATE", "PASSPORT", "EVIDENCE", "REFEREE"].includes(kind)) {
    return { error: "Select a document type." };
  }
  if (!fileName) return { error: "Provide a file name." };

  const application = await prisma.application.findFirst({
    where: { userId: session.userId, status: { in: ["DRAFT", "SUBMITTED", "SCREENING"] } },
    orderBy: { createdAt: "desc" },
  });

  const doc = await prisma.documentUpload.create({
    data: {
      applicationId: application?.id ?? null,
      userId: session.userId,
      kind,
      fileName,
      mimeType: "application/pdf",
      sizeBytes: Math.floor(Math.random() * 200000) + 10000,
      checksum: `sha256:demo-${Math.random().toString(16).slice(2)}`,
      storageRef: `uploads/${session.userId}/${fileName}`,
    },
  });
  await writeAudit({
    action: "CREATE",
    module: "ADMISSIONS",
    targetType: "DOCUMENT_UPLOAD",
    targetId: doc.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { kind, fileName },
  });
  return { ok: true };
}

export async function advanceApplication(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMISSIONS", "A")) {
    return { error: "Your role cannot process applications." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return { error: "Application not found." };

  const next: Record<string, string> = {
    SUBMITTED: "SCREENING",
    SCREENING: "PENDING_CAPS",
    PENDING_CAPS: "ADMITTED",
  };
  const target = next[app.status];
  if (!target) return { error: `Cannot advance from ${app.status}.` };

  await prisma.application.update({ where: { id: app.id }, data: { status: target } });
  if (target === "ADMITTED") {
    await prisma.admissionOffer.create({
      data: { applicationId: app.id, programmeId: app.programmeId },
    });
  }
  await writeAudit({
    action: "UPDATE",
    module: "ADMISSIONS",
    targetType: "APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: app.status },
    after: { status: target },
  });
  return { ok: true };
}

export async function verifyDocument(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMISSIONS", "A")) {
    return { error: "Your role cannot verify documents." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const doc = await prisma.documentUpload.findUnique({ where: { id } });
  if (!doc) return { error: "Document not found." };

  await prisma.documentUpload.update({
    where: { id: doc.id },
    data: { verificationStatus: "VERIFIED" },
  });
  await writeAudit({
    action: "APPROVE",
    module: "ADMISSIONS",
    targetType: "DOCUMENT_UPLOAD",
    targetId: doc.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { verificationStatus: doc.verificationStatus },
    after: { verificationStatus: "VERIFIED" },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Postgraduate
// ---------------------------------------------------------------------------

export async function applyPg(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can apply to postgraduate programmes." };
  }

  const existing = await prisma.pGApplication.findFirst({ where: { userId: session.userId } });
  if (existing) return { error: "You already have a postgraduate application." };

  const programmeId = String(formData.get("programmeId") ?? "");
  const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
  if (!programme) return { error: "Select a postgraduate programme." };

  const referee1Name = String(formData.get("referee1Name") ?? "").trim();
  const referee1Email = String(formData.get("referee1Email") ?? "").trim();
  if (!referee1Name || !referee1Email) return { error: "Add at least one referee." };

  const app = await prisma.pGApplication.create({
    data: {
      userId: session.userId,
      programmeId: programme.id,
      referee1Name,
      referee1Email,
      referee2Name: String(formData.get("referee2Name") ?? "").trim() || null,
      referee2Email: String(formData.get("referee2Email") ?? "").trim() || null,
      screeningStatus: "SUBMITTED",
    },
  });
  await writeAudit({
    action: "SUBMIT",
    module: "PG_RESEARCH",
    targetType: "PG_APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { programme: programme.code },
  });
  return { ok: true };
}

export async function advancePgApplication(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "PG_RESEARCH", "A")) {
    return { error: "Your role cannot process PG applications." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const app = await prisma.pGApplication.findUnique({ where: { id } });
  if (!app) return { error: "Application not found." };

  const next: Record<string, string> = {
    SUBMITTED: "SCREENING",
    SCREENING: "INTERVIEW",
    INTERVIEW: "ADMITTED",
  };
  const target = next[app.screeningStatus];
  if (!target) return { error: `Cannot advance from ${app.screeningStatus}.` };

  await prisma.pGApplication.update({
    where: { id: app.id },
    data: {
      screeningStatus: target,
      interviewAt: target === "INTERVIEW" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : app.interviewAt,
    },
  });
  await writeAudit({
    action: "UPDATE",
    module: "PG_RESEARCH",
    targetType: "PG_APPLICATION",
    targetId: app.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { screeningStatus: app.screeningStatus },
    after: { screeningStatus: target },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin / System
// ---------------------------------------------------------------------------

export async function setUserStatus(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot manage users." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
    return { error: "Invalid status." };
  }
  if (id === session.userId) return { error: "You cannot change your own status." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({ where: { id: target.id }, data: { status } });
  await writeAudit({
    action: "UPDATE",
    module: "ADMIN_SYSTEM",
    targetType: "USER",
    targetId: target.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: target.status },
    after: { status },
  });
  return { ok: true };
}

export async function toggleFeatureFlag(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot change feature flags." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const flag = await prisma.featureFlag.findUnique({ where: { id } });
  if (!flag) return { error: "Flag not found." };

  await prisma.featureFlag.update({
    where: { id: flag.id },
    data: { enabled: !flag.enabled },
  });
  await writeAudit({
    action: "CONFIG",
    module: "ADMIN_SYSTEM",
    targetType: "FEATURE_FLAG",
    targetId: flag.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { enabled: flag.enabled },
    after: { enabled: !flag.enabled },
  });
  return { ok: true };
}

export async function revokeApiCredential(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot revoke credentials." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const cred = await prisma.apiCredential.findUnique({ where: { id } });
  if (!cred) return { error: "Credential not found." };
  if (cred.revokedAt) return { error: "Already revoked." };

  await prisma.apiCredential.update({
    where: { id: cred.id },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    action: "REVOKE",
    module: "ADMIN_SYSTEM",
    targetType: "API_CREDENTIAL",
    targetId: cred.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { revoked: true },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shared audit helper for the workflows below
// ---------------------------------------------------------------------------

const CURRENT_SESSION = "2025/2026";

async function audit(
  module: string,
  action: AuditAction,
  targetType: string,
  targetId: string,
  session: { userId: string; user: { username: string; role: string }; id: string },
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
) {
  await writeAudit({
    action,
    module,
    targetType,
    targetId,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before,
    after,
  });
}

// ---------------------------------------------------------------------------
// Exams & Records: grade entry, approval chain, appeals, misconduct
// ---------------------------------------------------------------------------

const GRADE_BANDS: [number, string][] = [
  [70, "A"],
  [60, "B"],
  [50, "C"],
  [45, "D"],
  [40, "E"],
  [0, "F"],
];

function gradeFor(total: number): string {
  for (const [threshold, grade] of GRADE_BANDS) {
    if (total >= threshold) return grade;
  }
  return "F";
}

export async function submitGrade(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "EXAMS_RECORDS", "S")) {
    return { error: "Your role cannot enter grades." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const ca = Number(formData.get("caScore") ?? "0");
  const exam = Number(formData.get("examScore") ?? "0");
  if (!studentId || !courseId) return { error: "Select a student and course." };
  if (Number.isNaN(ca) || Number.isNaN(exam) || ca < 0 || exam < 0 || ca > 40 || exam > 60) {
    return { error: "CA must be 0–40 and exam 0–60." };
  }

  const registration = await prisma.courseRegistration.findFirst({
    where: { userId: studentId, courseId, status: "ACTIVE" },
  });
  if (!registration) return { error: "Student is not registered for this course." };

  const total = ca + exam;
  const grade = gradeFor(total);
  const existing = await prisma.result.findFirst({
    where: {
      userId: studentId,
      courseId,
      academicSession: registration.academicSession,
      semester: registration.semester,
    },
  });

  if (existing) {
    if (existing.gradeStatus === "FINAL") {
      return { error: "Final results cannot be edited." };
    }
    await prisma.result.update({
      where: { id: existing.id },
      data: { caScore: ca, examScore: exam, total, grade, gradeStatus: "SUBMITTED", submittedById: session.userId },
    });
  } else {
    await prisma.result.create({
      data: {
        userId: studentId,
        courseId,
        academicSession: registration.academicSession,
        semester: registration.semester,
        caScore: ca,
        examScore: exam,
        total,
        grade,
        gradeStatus: "SUBMITTED",
        submittedById: session.userId,
      },
    });
  }

  await audit("EXAMS_RECORDS", "SUBMIT", "RESULT", existing?.id ?? registration.id, session, undefined, {
    courseId,
    total,
    grade,
  });
  return { ok: true };
}

export async function approveResult(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "EXAMS_RECORDS", "A")) {
    return { error: "Your role cannot approve results." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const result = await prisma.result.findUnique({ where: { id } });
  if (!result) return { error: "Result not found." };

  if (session.user.role === "HOD_DEAN" && result.gradeStatus === "SUBMITTED") {
    await prisma.result.update({
      where: { id: result.id },
      data: { gradeStatus: "HOD_APPROVED", approvedBy1Id: session.userId, approvedAt1: new Date() },
    });
  } else if (session.user.role === "EXAMS_RECORDS" && result.gradeStatus === "HOD_APPROVED") {
    await prisma.result.update({
      where: { id: result.id },
      data: { gradeStatus: "SENATE_APPROVED", published: true, approvedBy2Id: session.userId, approvedAt2: new Date() },
    });
  } else {
    return { error: `Not ready for your approval (current stage: ${result.gradeStatus}).` };
  }

  await audit("EXAMS_RECORDS", "APPROVE", "RESULT", result.id, session, { gradeStatus: result.gradeStatus });
  return { ok: true };
}

export async function registerCourse(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can register for courses." };
  }

  const courseId = String(formData.get("courseId") ?? "");
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Select a course." };

  const existing = await prisma.courseRegistration.findFirst({
    where: { userId: session.userId, courseId, academicSession: CURRENT_SESSION, semester: course.semester },
  });
  if (existing) {
    if (existing.status === "ACTIVE") return { error: "You are already registered for this course." };
    if (existing.status === "WAITLISTED") return { error: "You are on the waitlist for this course." };
  }

  const unpaid = await prisma.invoice.count({
    where: { userId: session.userId, status: { in: ["OPEN", "OVERDUE", "PARTIAL"] }, module: { in: ["TUITION", "ACCEPTANCE"] } },
  });
  const feeAccount = await prisma.feeAccount.findUnique({ where: { userId: session.userId } });
  const feeClear = unpaid === 0 && (feeAccount?.clearanceStatus ?? true);
  if (!feeClear) return { error: "Fee clearance is required before course registration." };

  const enrolled = await prisma.courseRegistration.count({
    where: { courseId, status: "ACTIVE" },
  });
  if (enrolled >= course.capacity) {
    const waitlist = await prisma.courseRegistration.create({
      data: { userId: session.userId, courseId, academicSession: CURRENT_SESSION, semester: course.semester, status: "WAITLISTED" },
    });
    await audit("EXAMS_RECORDS", "CREATE", "COURSE_REGISTRATION", waitlist.id, session, undefined, { course: course.code, status: "WAITLISTED" });
    return { error: "Course is at capacity — you have been waitlisted." };
  }

  const prereqs = Array.isArray(course.prerequisites) ? (course.prerequisites as string[]) : [];
  for (const code of prereqs) {
    const pre = await prisma.course.findFirst({ where: { code } });
    if (!pre) continue;
    const pass = await prisma.result.findFirst({
      where: { userId: session.userId, courseId: pre.id, published: true, grade: { not: "F" } },
    });
    if (!pass) return { error: `Prerequisite ${code} has not been passed.` };
  }

  const reg = await prisma.courseRegistration.create({
    data: { userId: session.userId, courseId, academicSession: CURRENT_SESSION, semester: course.semester, status: "ACTIVE", lmsSynced: true },
  });
  await prisma.lmsSyncLog.create({
    data: { kind: "ENROLMENT", refType: "COURSE_REGISTRATION", refId: reg.id, status: "SYNCED", ranAt: new Date(), userId: session.userId },
  });
  await audit("EXAMS_RECORDS", "CREATE", "COURSE_REGISTRATION", reg.id, session, undefined, { course: course.code, status: "ACTIVE" });
  return { ok: true };
}

export async function dropCourse(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can drop courses." };
  }

  const id = String(formData.get("id") ?? "");
  const reg = await prisma.courseRegistration.findUnique({ where: { id } });
  if (!reg || reg.userId !== session.userId) return { error: "Registration not found." };
  if (reg.status !== "ACTIVE") return { error: "This registration is not active." };

  await prisma.courseRegistration.update({ where: { id: reg.id }, data: { status: "DROPPED", lmsSynced: false } });
  await prisma.lmsSyncLog.create({
    data: { kind: "UNENROLMENT", refType: "COURSE_REGISTRATION", refId: reg.id, status: "SYNCED", ranAt: new Date(), userId: session.userId },
  });
  await audit("EXAMS_RECORDS", "UPDATE", "COURSE_REGISTRATION", reg.id, session, { status: reg.status }, { status: "DROPPED" });
  return { ok: true };
}

export async function fileAppeal(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can file appeals." };
  }

  const caseType = String(formData.get("caseType") ?? "");
  const caseRef = String(formData.get("caseRef") ?? "").trim() || null;
  const grounds = String(formData.get("grounds") ?? "").trim();
  if (!["GRADE", "MISCONDUCT"].includes(caseType)) return { error: "Select an appeal type." };
  if (!grounds) return { error: "State the grounds for your appeal." };

  const appeal = await prisma.appeal.create({
    data: { userId: session.userId, caseType, caseRef, grounds, status: "SUBMITTED" },
  });
  await audit("EXAMS_RECORDS", "SUBMIT", "APPEAL", appeal.id, session, undefined, { caseType, caseRef });
  return { ok: true };
}

export async function reviewAppeal(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "EXAMS_RECORDS", "A")) {
    return { error: "Your role cannot review appeals." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const appeal = await prisma.appeal.findUnique({ where: { id } });
  if (!appeal) return { error: "Appeal not found." };

  let status = appeal.status;
  if (appeal.status === "SUBMITTED") status = "UNDER_REVIEW";
  else if (decision === "APPROVED") status = "APPROVED";
  else if (decision === "REJECTED") status = "REJECTED";
  else return { error: "Select an outcome." };

  await prisma.appeal.update({ where: { id: appeal.id }, data: { status } });
  await audit("EXAMS_RECORDS", "UPDATE", "APPEAL", appeal.id, session, { status: appeal.status }, { status });
  return { ok: true };
}

export async function logMisconductCase(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!["STUDENT_AFFAIRS", "HOD_DEAN", "EXAMS_RECORDS"].includes(session.user.role)) {
    return { error: "Your role cannot log misconduct cases." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const evidenceRef = String(formData.get("evidenceRef") ?? "").trim() || null;
  if (!studentId || !title) return { error: "Select a student and enter a case title." };

  const c = await prisma.misconductCase.create({
    data: { studentId, title, evidenceRef, status: "OPEN" },
  });
  await audit("EXAMS_RECORDS", "CREATE", "MISCONDUCT_CASE", c.id, session, undefined, { title });
  return { ok: true };
}

export async function advanceMisconductCase(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!["STUDENT_AFFAIRS", "HOD_DEAN", "EXAMS_RECORDS"].includes(session.user.role)) {
    return { error: "Your role cannot process misconduct cases." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const c = await prisma.misconductCase.findUnique({ where: { id } });
  if (!c) return { error: "Case not found." };

  const next: Record<string, string> = {
    OPEN: "INVESTIGATION",
    INVESTIGATION: "HEARING",
    HEARING: "DECISION",
    DECISION: "CLOSED",
  };
  const target = next[c.status];
  if (!target) return { error: `Cannot advance from ${c.status}.` };

  await prisma.misconductCase.update({
    where: { id: c.id },
    data: { status: target, decidedById: target === "DECISION" ? session.userId : c.decidedById },
  });
  await audit("EXAMS_RECORDS", "UPDATE", "MISCONDUCT_CASE", c.id, session, { status: c.status }, { status: target });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DPO: data-subject requests, FOI, breach log
// ---------------------------------------------------------------------------

export async function submitDataSubjectRequest(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const requestType = String(formData.get("requestType") ?? "");
  const detail = String(formData.get("detail") ?? "").trim() || null;
  if (!["ACCESS", "RECTIFY", "ERASE", "PORTABILITY"].includes(requestType)) {
    return { error: "Select a request type." };
  }

  const req = await prisma.dataSubjectRequest.create({
    data: { userId: session.userId, requestType, detail, status: "SUBMITTED" },
  });
  await audit("DPO", "SUBMIT", "DATA_SUBJECT_REQUEST", req.id, session, undefined, { requestType });
  return { ok: true };
}

export async function advanceDataSubjectRequest(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "DPO", "R")) {
    return { error: "Your role cannot process data-subject requests." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const req = await prisma.dataSubjectRequest.findUnique({ where: { id } });
  if (!req) return { error: "Request not found." };
  if (req.status === "COMPLETED" || req.status === "REJECTED") return { error: "Request already resolved." };

  const status = req.status === "SUBMITTED" ? "PROCESSING" : outcome === "REJECTED" ? "REJECTED" : "COMPLETED";
  await prisma.dataSubjectRequest.update({
    where: { id: req.id },
    data: { status, resolvedAt: status === "COMPLETED" || status === "REJECTED" ? new Date() : null },
  });
  await audit("DPO", "UPDATE", "DATA_SUBJECT_REQUEST", req.id, session, { status: req.status }, { status });
  return { ok: true };
}

export async function respondFoiRequest(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "DPO", "R")) {
    return { error: "Your role cannot respond to FOI requests." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const req = await prisma.fOIRequest.findUnique({ where: { id } });
  if (!req) return { error: "Request not found." };
  if (req.status === "COMPLETED" || req.status === "REJECTED") return { error: "Request already resolved." };

  const status = req.status === "SUBMITTED" ? "PROCESSING" : outcome === "REJECTED" ? "REJECTED" : "COMPLETED";
  await prisma.fOIRequest.update({
    where: { id: req.id },
    data: { status, responseAt: status === "COMPLETED" || status === "REJECTED" ? new Date() : null },
  });
  await audit("DPO", "UPDATE", "FOI_REQUEST", req.id, session, { status: req.status }, { status });
  return { ok: true };
}

export async function resolveBreach(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "DPO", "R")) {
    return { error: "Your role cannot update breach records." };
  }

  const id = String(formData.get("id") ?? "");
  const breach = await prisma.breachLog.findUnique({ where: { id } });
  if (!breach) return { error: "Breach record not found." };

  await prisma.breachLog.update({ where: { id: breach.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  await audit("DPO", "UPDATE", "BREACH_LOG", breach.id, session, { status: breach.status }, { status: "RESOLVED" });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// NYSC mobilisation
// ---------------------------------------------------------------------------

export async function submitNyscRecord(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can submit NYSC intent." };
  }

  const batch = await prisma.nYSCBatch.findFirst({ where: { status: "OPEN" } });
  if (!batch) return { error: "No open mobilisation batch." };

  const existing = await prisma.nYSCRecord.findFirst({ where: { userId: session.userId, batchId: batch.id } });
  if (existing && existing.status !== "PENDING") return { error: "You have already submitted for this batch." };

  const record = existing
    ? await prisma.nYSCRecord.update({ where: { id: existing.id }, data: { status: "SUBMITTED", submittedAt: new Date() } })
    : await prisma.nYSCRecord.create({ data: { userId: session.userId, batchId: batch.id, status: "SUBMITTED", submittedAt: new Date() } });
  await audit("GRAD_CLEARANCE", "SUBMIT", "NYSC_RECORD", record.id, session, undefined, { batch: batch.code });
  return { ok: true };
}

export async function advanceNyscRecord(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!["STUDENT_AFFAIRS", "REGISTRY"].includes(session.user.role)) {
    return { error: "Your role cannot process NYSC records." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const record = await prisma.nYSCRecord.findUnique({ where: { id } });
  if (!record) return { error: "Record not found." };

  const status = outcome === "QUERIED" ? "QUERIED" : "ACCEPTED";
  await prisma.nYSCRecord.update({
    where: { id: record.id },
    data: { status, remark: String(formData.get("remark") ?? "").trim() || record.remark },
  });
  await audit("GRAD_CLEARANCE", "UPDATE", "NYSC_RECORD", record.id, session, { status: record.status }, { status });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Digital ID cards
// ---------------------------------------------------------------------------

export async function requestIdCard(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const kind = session.user.role === "STUDENT" ? "STUDENT" : "STAFF";
  const prefix = kind === "STUDENT" ? "STU" : "STF";

  const existing = await prisma.idCard.findFirst({ where: { userId: session.userId, revokedAt: null } });
  if (existing) return { error: "A card is already issued to you." };

  const qrRef = `UAID-${prefix}-${session.user.username}-${randomInt(1000, 9999)}`;
  const card = await prisma.idCard.create({
    data: { userId: session.userId, qrRef, kind },
  });
  await audit("ADMIN_SYSTEM", "CREATE", "ID_CARD", card.id, session, undefined, { qrRef, kind });
  return { ok: true };
}

export async function revokeIdCard(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot revoke ID cards." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const card = await prisma.idCard.findUnique({ where: { id } });
  if (!card) return { error: "Card not found." };

  await prisma.idCard.update({ where: { id: card.id }, data: { revokedAt: new Date() } });
  await audit("ADMIN_SYSTEM", "REVOKE", "ID_CARD", card.id, session, undefined, { revoked: true });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: issue API credentials
// ---------------------------------------------------------------------------

export async function issueApiCredential(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot issue credentials." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const provider = String(formData.get("provider") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const providers = ["JAMB", "WAEC", "NIPEDS", "REMITA", "NIBSS", "GIFMIS", "ITEX", "NYSC"];
  if (!providers.includes(provider)) return { error: "Select a provider." };
  if (!label) return { error: "Provide a label." };

  const secret = `key_${randomInt(100000000, 999999999)}`;
  const cred = await prisma.apiCredential.create({
    data: {
      provider,
      label,
      keyHash: createHash("sha256").update(secret).digest("hex"),
      issuedById: session.userId,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  await audit("ADMIN_SYSTEM", "CREATE", "API_CREDENTIAL", cred.id, session, undefined, { provider });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Communication preferences (NDPA consent)
// ---------------------------------------------------------------------------

export async function updateNotificationPreferences(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const prefs = {
    allowEmail: formData.get("allowEmail") === "on",
    allowSms: formData.get("allowSms") === "on",
    allowInApp: formData.get("allowInApp") === "on",
    allowPromotional: formData.get("allowPromotional") === "on",
  };
  await prisma.notificationPreference.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...prefs },
    update: prefs,
  });
  await audit("COMMUNICATIONS", "UPDATE", "NOTIFICATION_PREFERENCE", session.userId, session, undefined, prefs);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Timetabling & venue booking (clash-aware)
// ---------------------------------------------------------------------------

export async function bookVenue(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "TIMETABLE_VENUE", "W")) {
    return { error: "Your role cannot book venues." };
  }

  const venueId = String(formData.get("venueId") ?? "");
  const purpose = String(formData.get("purpose") ?? "");
  const day = String(formData.get("day") ?? "").toUpperCase();
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const courseId = String(formData.get("courseId") ?? "") || null;
  if (!venueId || !["LECTURE", "EXAM", "EVENT"].includes(purpose)) return { error: "Select a venue and purpose." };
  if (!day || !startTime || !endTime || startTime >= endTime) return { error: "Provide a valid day and time window." };

  const clash = await prisma.venueBooking.findFirst({
    where: { venueId, status: { not: "CANCELLED" }, day, AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }] },
  });
  if (clash) return { error: "Clash: this venue is already booked in that window." };

  const booking = await prisma.venueBooking.create({
    data: { venueId, purpose, courseId, day, startTime, endTime, status: "CONFIRMED", bookerUserId: session.userId },
  });
  await audit("TIMETABLE_VENUE", "CREATE", "VENUE_BOOKING", booking.id, session, undefined, { venueId, purpose, day, startTime, endTime });
  return { ok: true };
}


