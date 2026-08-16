"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit, type AuditAction } from "@/lib/audit";
import {
  can,
  academicSessions,
  SEMESTER_LABELS,
  departmentLevels,
  departmentMaxLevel,
  INVOICE_MODULES,
  MAX_ISSUABLE_INVOICE_CENTS,
} from "@/lib/constants";
import { facultyDepartments } from "@/lib/faculty";
import { hashPassword } from "@/lib/password";
import { departmentProgrammeIds, courseInDepartmentCatalogue, departmentCourseCodes, isHodRole } from "@/lib/hod";
import {
  MIN_REGISTRATION_UNITS,
  studentRegistrationContext,
  eligibleOfferingForStudent,
} from "@/lib/student-registration";
import { nextRegistrationReference } from "@/lib/student-finalisation";
import { Prisma } from "@/generated/prisma/client";

export type ModuleActionResult = { error?: string; ok?: boolean; reference?: string };

const CLEARANCE_DEPTS: Record<string, string> = {
  BURSARY: "BURSARY",
  IT_ADMIN: "LIBRARY",
  STUDENT_AFFAIRS: "HOSTEL",
  HOD: "EXAMS",
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
    include: { course: true },
  });
  if (!registration) return { error: "Student is not registered for this course." };

  // Lecturers may only grade courses they are assigned to (Main or Co-lecturer)
  // for the exact session/semester of the registration. The Exams & Records
  // office remains the system-wide authority and is not scoped here.
  if (session.user.role === "LECTURER") {
    const assignment = await prisma.courseAssignment.findUnique({
      where: {
        courseCode_academicSession_semester: {
          courseCode: registration.course.code,
          academicSession: registration.academicSession,
          semester: registration.semester,
        },
      },
      select: { lecturerId: true, teamMembers: { select: { lecturerId: true } } },
    });
    const isAssigned =
      !!assignment &&
      (assignment.lecturerId === session.userId ||
        assignment.teamMembers.some((m) => m.lecturerId === session.userId));
    if (!isAssigned) {
      return { error: "You are not assigned to teach this course for this session." };
    }
  }

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
  const result = await prisma.result.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!result) return { error: "Result not found." };

  // A HoD may approve results ONLY for courses allocated to their own
  // department. The departmental boundary is derived from the session and the
  // course-allocation records (the same boundary the HoD approvals queue and
  // the shared results pipeline use), never from the client.
  if (isHodRole(session.user.role)) {
    if (!session.user.department) {
      return { error: "Your account has no department scope. Contact the exams unit." };
    }
    const deptCodes = await departmentCourseCodes(session.user.department);
    if (!deptCodes.includes(result.course.code)) {
      return { error: "You can only approve results for courses in your own department." };
    }
  }

  if (isHodRole(session.user.role) && result.gradeStatus === "SUBMITTED") {
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

  // Eligibility is derived server-side from the authenticated user's programme,
  // derived level, current session and current semester — never from the client.
  const ctx = studentRegistrationContext(session.user);
  if (ctx.level === null) {
    return { error: "Your academic level could not be determined. Contact your department." };
  }

  // Registration lock — once the student's registration for this session and
  // semester is finalised, no course can be added through the student interface.
  const lockedHeader = await prisma.registration.findFirst({
    where: { userId: session.userId, academicSession: ctx.academicSession, semester: ctx.semester },
    select: { registrationReference: true },
  });
  if (lockedHeader) {
    return {
      error: "Your course registration is finalised and locked. Contact your department to make changes.",
    };
  }

  const offering = await eligibleOfferingForStudent(session.user, courseId);
  if (!offering) {
    return {
      error: `${course.code} is not offered to you this session (no ACTIVE offering matches your programme, level and semester).`,
    };
  }

  const existing = await prisma.courseRegistration.findFirst({
    where: { userId: session.userId, courseId, academicSession: ctx.academicSession, semester: ctx.semester },
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
    // Preserve existing waitlist semantics: an over-capacity course waitlists
    // the student. Reuse the prior (e.g. DROPPED) row to stay within the unique
    // (userId, courseId, session, semester) constraint.
    if (existing) {
      const waitlisted = await prisma.courseRegistration.update({
        where: { id: existing.id },
        data: { status: "WAITLISTED" },
      });
      await audit("EXAMS_RECORDS", "UPDATE", "COURSE_REGISTRATION", waitlisted.id, session, { status: existing.status }, { status: "WAITLISTED" });
    } else {
      const waitlisted = await prisma.courseRegistration.create({
        data: { userId: session.userId, courseId, academicSession: ctx.academicSession, semester: ctx.semester, status: "WAITLISTED" },
      });
      await audit("EXAMS_RECORDS", "CREATE", "COURSE_REGISTRATION", waitlisted.id, session, undefined, { course: course.code, status: "WAITLISTED" });
    }
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

  const reg = existing
    ? await prisma.courseRegistration.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", lmsSynced: true },
      })
    : await prisma.courseRegistration.create({
        data: { userId: session.userId, courseId, academicSession: ctx.academicSession, semester: ctx.semester, status: "ACTIVE", lmsSynced: true },
      });
  await prisma.lmsSyncLog.create({
    data: { kind: "ENROLMENT", refType: "COURSE_REGISTRATION", refId: reg.id, status: "SYNCED", ranAt: new Date(), userId: session.userId },
  });
  await audit("EXAMS_RECORDS", "CREATE", "COURSE_REGISTRATION", reg.id, session, undefined, { course: course.code, status: "ACTIVE" });
  return { ok: true };
}

export async function submitCourseRegistration(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "STUDENT") {
    return { error: "Only students can register for courses." };
  }

  const courseIds = [...new Set(
    formData
      .getAll("courseId")
      .map((v) => String(v).trim())
      .filter(Boolean),
  )];
  if (courseIds.length === 0) return { error: "Select at least one course." };

  const ctx = studentRegistrationContext(session.user);
  if (ctx.level === null) {
    return { error: "Your academic level could not be determined. Contact your department." };
  }

  // Registration lock — a finalised/locked registration for this session and
  // semester cannot be re-submitted or modified through the student interface.
  const existingHeader = await prisma.registration.findFirst({
    where: { userId: session.userId, academicSession: ctx.academicSession, semester: ctx.semester },
    select: { registrationReference: true },
  });
  if (existingHeader) {
    return {
      error: `Your course registration for ${ctx.academicSession} has already been completed (${existingHeader.registrationReference}).`,
    };
  }

  // Fee clearance applies once for the whole submission.
  const unpaid = await prisma.invoice.count({
    where: { userId: session.userId, status: { in: ["OPEN", "OVERDUE", "PARTIAL"] }, module: { in: ["TUITION", "ACCEPTANCE"] } },
  });
  const feeAccount = await prisma.feeAccount.findUnique({ where: { userId: session.userId } });
  if (!(unpaid === 0 && (feeAccount?.clearanceStatus ?? true))) {
    return { error: "Fee clearance is required before course registration." };
  }

  // PHASE 1 — validate EVERY selected course. Any failure aborts the whole
  // submission before any row is written, so a valid+invalid+valid selection
  // registers nothing.
  let totalUnits = 0;

  for (const courseId of courseIds) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return { error: "One of the selected courses is invalid." };

    const offering = await eligibleOfferingForStudent(session.user, courseId);
    if (!offering) {
      return {
        error: `${course.code} is not offered to you this session (no ACTIVE offering matches your programme, level and semester).`,
      };
    }

    const prior = await prisma.courseRegistration.findFirst({
      where: { userId: session.userId, courseId, academicSession: ctx.academicSession, semester: ctx.semester },
    });
    if (prior) {
      if (prior.status === "ACTIVE") return { error: `You are already registered for ${course.code}.` };
      if (prior.status === "WAITLISTED") return { error: `You are on the waitlist for ${course.code}.` };
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

    const enrolled = await prisma.courseRegistration.count({ where: { courseId, status: "ACTIVE" } });
    if (enrolled >= course.capacity) {
      return { error: `${course.code} is at capacity. Remove it or contact your department.` };
    }

    totalUnits += course.units;
  }

  // Minimum credit units must be enforced from Course.units in the database.
  if (totalUnits < MIN_REGISTRATION_UNITS) {
    return { error: `A minimum of ${MIN_REGISTRATION_UNITS} credit units is required. You selected ${totalUnits}.` };
  }

  // PHASE 2 — atomic finalisation. One transaction performs: duplicate check,
  // reference generation, header creation, course-row creation/reactivation,
  // total-units calculation and the final status/lock. Either everything is
  // committed (finalised + locked) or nothing is. The reference and the
  // per-student-per-semester unique constraints make concurrent submissions safe:
  // the retry loop re-runs on a reference collision and turns a duplicate header
  // into a controlled "already completed" response.
  const attempts = 6;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const dup = await tx.registration.findFirst({
          where: { userId: session.userId, academicSession: ctx.academicSession, semester: ctx.semester },
          select: { registrationReference: true },
        });
        if (dup) return { duplicate: dup.registrationReference };

        const reference = await nextRegistrationReference(tx, ctx.academicSession);
        const now = new Date();

        // Adopt existing ACTIVE rows (e.g. courses registered via the LMS) plus
        // the submitted selection; DROPPED rows in the selection are reactivated.
        const existingRows = await tx.courseRegistration.findMany({
          where: { userId: session.userId, academicSession: ctx.academicSession, semester: ctx.semester },
          select: { id: true, courseId: true, status: true },
        });
        const existingByCourse = new Map(existingRows.map((r) => [r.courseId, r]));
        const fullSet = new Map<string, string>(); // courseId -> row id ("" when new)
        for (const id of courseIds) fullSet.set(id, existingByCourse.get(id)?.id ?? "");
        for (const row of existingRows) {
          if (row.status === "ACTIVE") fullSet.set(row.courseId, row.id);
        }

        const courses = await tx.course.findMany({
          where: { id: { in: [...fullSet.keys()] } },
          select: { id: true, units: true },
        });
        const unitsByCourse = new Map(courses.map((c) => [c.id, c.units]));
        let finalTotal = 0;
        for (const id of fullSet.keys()) finalTotal += unitsByCourse.get(id) ?? 0;
        if (finalTotal < MIN_REGISTRATION_UNITS) {
          throw new Error(`REGISTRATION_TOTAL_BELOW_MINIMUM:${finalTotal}`);
        }

        const header = await tx.registration.create({
          data: {
            userId: session.userId,
            registrationReference: reference,
            academicSession: ctx.academicSession,
            semester: ctx.semester,
            totalUnits: finalTotal,
            status: "FINALIZED",
            submittedAt: now,
            finalisedAt: now,
            lockedAt: now,
          },
        });

        const rowOps: Prisma.PrismaPromise<unknown>[] = [];
        for (const [courseId, rowId] of fullSet.entries()) {
          if (rowId) {
            rowOps.push(
              tx.courseRegistration.update({
                where: { id: rowId },
                data: { registrationId: header.id, status: "ACTIVE", lmsSynced: true },
              }),
            );
          } else {
            rowOps.push(
              tx.courseRegistration.create({
                data: {
                  userId: session.userId,
                  courseId,
                  academicSession: ctx.academicSession,
                  semester: ctx.semester,
                  status: "ACTIVE",
                  lmsSynced: true,
                  registrationId: header.id,
                },
              }),
            );
          }
        }
        for (const op of rowOps) await op;

        return {
          header,
          reference,
          totalUnits: finalTotal,
          courseIds: [...fullSet.keys()],
        };
      });

      if ("duplicate" in outcome) {
        return {
          error: `Your course registration for ${ctx.academicSession} has already been completed (${outcome.duplicate}).`,
        };
      }

      // Post-commit side effects (matching the existing LMS-sync + audit pattern):
      // if these fail the registration is already finalised, so the duplicate and
      // lock checks prevent any further modification attempts.
      const rows = await prisma.courseRegistration.findMany({
        where: { userId: session.userId, registrationId: outcome.header.id },
        select: { id: true },
      });
      for (const reg of rows) {
        await prisma.lmsSyncLog.create({
          data: { kind: "ENROLMENT", refType: "COURSE_REGISTRATION", refId: reg.id, status: "SYNCED", ranAt: new Date(), userId: session.userId },
        });
      }
      await audit("EXAMS_RECORDS", "CREATE", "REGISTRATION", outcome.header.id, session, undefined, {
        reference: outcome.reference,
        academicSession: ctx.academicSession,
        semester: ctx.semester,
        courses: outcome.courseIds,
        totalUnits: outcome.totalUnits,
        status: "FINALIZED",
      });
      await audit("EXAMS_RECORDS", "FINALIZE", "REGISTRATION", outcome.header.id, session, undefined, {
        reference: outcome.reference,
        totalUnits: outcome.totalUnits,
        finalisedAt: outcome.header.finalisedAt?.toISOString(),
      });
      await audit("EXAMS_RECORDS", "LOCK", "REGISTRATION", outcome.header.id, session, undefined, {
        reference: outcome.reference,
        lockedAt: outcome.header.lockedAt?.toISOString(),
      });
      return { ok: true, reference: outcome.reference };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (Array.isArray(err.meta?.target) ? err.meta.target : [err.meta?.target])
          .map((t) => String(t))
          .join(",")
          .toLowerCase();
        if (target.includes("registrationreference")) continue; // concurrent reference collision → retry
        if (target.includes("userid") && target.includes("academicsession") && target.includes("semester")) {
          return {
            error: `Your course registration for ${ctx.academicSession} has already been completed.`,
          };
        }
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        continue; // concurrent transaction conflict → retry
      }
      throw err;
    }
  }

  return { error: "Your registration could not be finalised right now. Please try again." };
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

  // Registration lock — after finalisation the student cannot drop courses; any
  // post-registration add/drop is an administrative workflow for the department.
  const lockedHeader = await prisma.registration.findFirst({
    where: { userId: session.userId, academicSession: reg.academicSession, semester: reg.semester },
    select: { id: true },
  });
  if (lockedHeader || reg.registrationId) {
    return { error: "Your course registration is finalised and locked. Course changes must go through your department." };
  }

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
  const appeal = await prisma.appeal.findUnique({
    where: { id },
    include: { user: { select: { department: true } } },
  });
  if (!appeal) return { error: "Appeal not found." };

  // A HoD may review appeals filed by students in their own department only;
  // the Exams & Records unit retains the full register.
  if (isHodRole(session.user.role) && appeal.user.department !== session.user.department) {
    return { error: "You can only review appeals from students in your own department." };
  }

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
  if (!["STUDENT_AFFAIRS", "HOD", "EXAMS_RECORDS"].includes(session.user.role)) {
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
  if (!["STUDENT_AFFAIRS", "HOD", "EXAMS_RECORDS"].includes(session.user.role)) {
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

// ---------------------------------------------------------------------------
// HoD: course allocation (assign / unassign / co-lecturers)
// ---------------------------------------------------------------------------

export async function assignCourse(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can allocate courses." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const courseCode = String(formData.get("courseCode") ?? "").trim();
  const academicSession = String(formData.get("academicSession") ?? "").trim();
  const semester = Number(formData.get("semester") ?? "0");
  const lecturerId = String(formData.get("lecturerId") ?? "");
  const coLecturerIds = String(formData.get("coLecturerIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!courseCode) return { error: "Select a course." };
  if (!lecturerId) return { error: "Select the main lecturer." };
  if (!academicSession || ![1, 2].includes(semester)) {
    return { error: "Select a session and semester." };
  }

  // Faculty/department are derived from the authenticated HoD session — never
  // from the client. A HoD can only allocate courses in their own department.
  const faculty = session.user.faculty;
  const department = session.user.department;
  if (!faculty || !department) {
    return { error: "Your account has no department scope. Contact the registry." };
  }

  // The course must exist AND belong to this HoD's department catalogue.
  const course = await prisma.course.findUnique({ where: { code: courseCode } });
  if (!course) return { error: "Select a valid course." };
  if (!(await courseInDepartmentCatalogue(faculty, department, course.code))) {
    return { error: "You can only allocate courses in your own department." };
  }

  // The main lecturer must be a LECTURER in this department.
  const main = await prisma.user.findUnique({ where: { id: lecturerId } });
  if (!main || main.role !== "LECTURER") return { error: "Select a valid lecturer." };
  if (main.department !== department) {
    return { error: "The main lecturer must belong to your department." };
  }

  // Co-lecturers must be distinct, valid LECTURERs in this department.
  const teamIds = [...new Set(coLecturerIds)].filter((id) => id && id !== lecturerId);
  if (teamIds.length) {
    const coList = await prisma.user.findMany({ where: { id: { in: teamIds } } });
    if (coList.length !== teamIds.length) return { error: "One or more co-lecturers are invalid." };
    for (const co of coList) {
      if (co.role !== "LECTURER") return { error: "Co-lecturers must be lecturers." };
      if (co.department !== department) {
        return { error: "Co-lecturers must belong to your department." };
      }
    }
  }

  const assignment = await prisma.courseAssignment.upsert({
    where: { courseCode_academicSession_semester: { courseCode, academicSession, semester } },
    create: {
      courseId: course.id,
      courseCode,
      courseTitle: course.title,
      faculty,
      department,
      lecturerId,
      assignedById: session.userId,
      academicSession,
      semester,
    },
    update: {
      courseId: course.id,
      courseTitle: course.title,
      faculty,
      department,
      lecturerId,
      assignedById: session.userId,
    },
  });

  await prisma.courseAssignmentMember.deleteMany({
    where: { courseAssignmentId: assignment.id },
  });
  for (const memberId of teamIds) {
    await prisma.courseAssignmentMember.create({
      data: { courseAssignmentId: assignment.id, lecturerId: memberId },
    });
  }

  await audit("EXAMS_RECORDS", "CREATE", "COURSE_ASSIGNMENT", assignment.id, session, undefined, {
    courseCode,
    academicSession,
    semester,
    lecturerId,
    teamIds,
  });
  return { ok: true };
}

export async function unassignCourse(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can remove allocations." };
  }
  const id = String(formData.get("id") ?? "");
  const assignment = await prisma.courseAssignment.findUnique({ where: { id } });
  if (!assignment) return { error: "Allocation not found." };
  if (assignment.department !== session.user.department) {
    return { error: "You can only remove allocations for your own department." };
  }
  await prisma.courseAssignmentMember.deleteMany({ where: { courseAssignmentId: id } });
  await prisma.courseAssignment.delete({ where: { id } });
  await audit("EXAMS_RECORDS", "DELETE", "COURSE_ASSIGNMENT", id, session, { courseCode: assignment.courseCode });
  return { ok: true };
}

export async function addCourseTeamLecturer(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can add co-lecturers." };
  }
  const courseAssignmentId = String(formData.get("courseAssignmentId") ?? "");
  const lecturerId = String(formData.get("lecturerId") ?? "");
  if (!courseAssignmentId || !lecturerId) return { error: "Select an allocation and a lecturer." };

  const assignment = await prisma.courseAssignment.findUnique({
    where: { id: courseAssignmentId },
    include: { teamMembers: true },
  });
  if (!assignment) return { error: "Allocation not found." };
  if (assignment.department !== session.user.department) {
    return { error: "You can only add co-lecturers to your own department's allocations." };
  }
  const lecturer = await prisma.user.findUnique({ where: { id: lecturerId } });
  if (!lecturer || lecturer.role !== "LECTURER") return { error: "Select a lecturer." };
  if (lecturer.department !== assignment.department) {
    return { error: "Co-lecturers must belong to your department." };
  }
  if (assignment.lecturerId === lecturerId) return { error: "That lecturer already holds the course." };
  if (assignment.teamMembers.some((m) => m.lecturerId === lecturerId)) {
    return { error: "That lecturer is already a co-lecturer." };
  }

  const member = await prisma.courseAssignmentMember.create({
    data: { courseAssignmentId, lecturerId },
  });
  await audit("EXAMS_RECORDS", "CREATE", "COURSE_ASSIGNMENT_MEMBER", member.id, session, undefined, {
    courseCode: assignment.courseCode,
    lecturerId,
  });
  return { ok: true };
}

export async function removeCourseTeamLecturer(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can remove co-lecturers." };
  }
  const id = String(formData.get("id") ?? "");
  const member = await prisma.courseAssignmentMember.findUnique({
    where: { id },
    include: { courseAssignment: true },
  });
  if (!member) return { error: "Co-lecturer record not found." };
  if (member.courseAssignment.department !== session.user.department) {
    return { error: "You can only remove co-lecturers from your own department's allocations." };
  }
  await prisma.courseAssignmentMember.delete({ where: { id } });
  await audit("EXAMS_RECORDS", "DELETE", "COURSE_ASSIGNMENT_MEMBER", id, session, { lecturerId: member.lecturerId });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HoD: course offerings (restored application layer)
// ---------------------------------------------------------------------------
// CourseOffering decides which programme/level/session/semester a course is
// offered to students. It is intentionally separate from CourseAssignment
// (lecturer teaching/workload allocation). All inputs below are re-validated
// against the database and the master Courses_UG catalogue; nothing from the
// client (course code/title, department, faculty, programme, role) is trusted.

const OFFERING_STATUSES = ["ACTIVE", "INACTIVE"];

export async function createCourseOffering(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can create course offerings." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const faculty = session.user.faculty;
  const department = session.user.department;
  if (!faculty || !department) {
    return { error: "Your account has no faculty/department scope assigned. Contact the IT administrator." };
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const academicSession = String(formData.get("academicSession") ?? "").trim();
  const semester = Number(formData.get("semester") ?? "0");
  const programmeId = String(formData.get("programmeId") ?? "").trim() || null;
  const level = Number(formData.get("level") ?? "0");
  const status = String(formData.get("status") ?? "ACTIVE");

  // Course must exist in the database and belong to this HoD's department.
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Select a valid course." };
  if (!(await courseInDepartmentCatalogue(faculty, department, course.code))) {
    return { error: "You can only create offerings for courses in your own department." };
  }

  // Academic session: existing application list (past sessions + current).
  if (!academicSessions().includes(academicSession)) {
    return { error: "Select a valid academic session." };
  }

  // Semester must be valid and agree with the course's designated semester.
  if (![1, 2].includes(semester)) return { error: "Select a valid semester." };
  if (semester !== course.semester) {
    const expected = SEMESTER_LABELS[course.semester] ?? `Semester ${course.semester}`;
    return { error: `Course ${course.code} is designated as ${expected}; pick that semester.` };
  }

  // Level must be one of the department's valid levels.
  const levels = departmentLevels(departmentMaxLevel(department));
  if (!levels.includes(level)) {
    return { error: `Select a valid level for this department (${levels.join(", ")}).` };
  }

  // Programme (optional) must belong to this HoD's department.
  if (programmeId) {
    const programme = await prisma.programme.findUnique({ where: { id: programmeId } });
    if (!programme) return { error: "Select a valid programme." };
    const scoped = await departmentProgrammeIds(department);
    if (!scoped.includes(programmeId)) {
      return { error: "You can only create offerings for programmes in your own department." };
    }
  }

  // Status must be one of the supported values.
  if (!OFFERING_STATUSES.includes(status)) return { error: "Select a valid offering status." };

  // Duplicate prevention: pre-check (covers the nullable-programmeId case that
  // Postgres treats as distinct in the unique index) + unique-constraint guard.
  const existing = await prisma.courseOffering.findFirst({
    where: { courseId, programmeId, academicSession, semester, level },
  });
  if (existing) {
    return { error: "An offering for this course, programme, session, semester and level already exists." };
  }

  let offering;
  try {
    offering = await prisma.courseOffering.create({
      data: { courseId, programmeId, academicSession, semester, level, status },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "An offering for this course, programme, session, semester and level already exists." };
    }
    throw err;
  }

  await audit("COURSE_OFFERINGS", "CREATE", "COURSE_OFFERING", offering.id, session, undefined, {
    courseId,
    courseCode: course.code,
    programmeId,
    academicSession,
    semester,
    level,
    status,
  });
  return { ok: true };
}

export async function setCourseOfferingStatus(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can manage course offerings." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!OFFERING_STATUSES.includes(status)) return { error: "Invalid offering status." };

  const offering = await prisma.courseOffering.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!offering) return { error: "Offering not found." };
  if (offering.status === status) {
    return { error: `This offering is already ${status}.` };
  }

  // The offering must belong to this HoD's department.
  if (!(await courseInDepartmentCatalogue(session.user.faculty, session.user.department, offering.course.code))) {
    return { error: "You can only manage offerings for your own department." };
  }

  const updated = await prisma.courseOffering.update({ where: { id }, data: { status } });
  await audit("COURSE_OFFERINGS", "UPDATE", "COURSE_OFFERING", updated.id, session, { status: offering.status }, { status });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HoD: level advisers & coordinators
// ---------------------------------------------------------------------------

export async function assignLevelAdviser(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can assign level advisers." };
  }
  const level = Number(formData.get("level") ?? "0");
  const academicSession = String(formData.get("academicSession") ?? "").trim();
  const programmeId = String(formData.get("programmeId") ?? "").trim() || null;
  const adviserId = String(formData.get("adviserId") ?? "");
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const department = session.user.department;
  if (!department) return { error: "Your profile is missing a department." };
  if (level < 100 || level % 100 !== 0) return { error: "Pick a valid level." };
  if (!academicSession) return { error: "Select an academic session." };
  if (!adviserId) return { error: "Select an adviser." };

  const adviser = await prisma.user.findUnique({ where: { id: adviserId } });
  if (!adviser || adviser.role !== "LECTURER") return { error: "Select a lecturer." };
  const startDate = startDateRaw ? new Date(startDateRaw) : null;

  const existingRow = await prisma.levelAdvisorAssignment.findFirst({
    where: { department, academicSession, level, programmeId },
  });
  const row = existingRow
    ? await prisma.levelAdvisorAssignment.update({
        where: { id: existingRow.id },
        data: {
          adviserId,
          assignedById: session.userId,
          status: "ACTIVE",
          startDate,
          notes,
        },
      })
    : await prisma.levelAdvisorAssignment.create({
        data: {
          academicSession,
          faculty: session.user.faculty || null,
          department,
          programmeId,
          level,
          adviserId,
          assignedById: session.userId,
          status: "ACTIVE",
          startDate,
          notes,
        },
      });
  await audit("EXAMS_RECORDS", "CREATE", "LEVEL_ADVISER_ASSIGNMENT", row.id, session, undefined, {
    department,
    academicSession,
    level,
    programmeId,
    adviserId,
  });
  return { ok: true };
}

export async function deactivateLevelAdviser(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can deactivate level advisers." };
  }
  const id = String(formData.get("id") ?? "");
  const row = await prisma.levelAdvisorAssignment.findUnique({ where: { id } });
  if (!row) return { error: "Assignment not found." };
  if (row.department !== session.user.department) {
    return { error: "You can only deactivate advisers in your own department." };
  }
  await prisma.levelAdvisorAssignment.update({
    where: { id },
    data: { status: "INACTIVE", endDate: new Date() },
  });
  await audit("EXAMS_RECORDS", "UPDATE", "LEVEL_ADVISER_ASSIGNMENT", id, session, { status: row.status });
  return { ok: true };
}

export async function assignLevelCoordinator(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can assign level coordinators." };
  }
  const level = Number(formData.get("level") ?? "0");
  const academicSession = String(formData.get("academicSession") ?? "").trim();
  const coordinatorId = String(formData.get("coordinatorId") ?? "");
  const department = session.user.department;
  if (!department) return { error: "Your profile is missing a department." };
  if (level < 100 || level % 100 !== 0) return { error: "Pick a valid level." };
  if (!academicSession) return { error: "Select an academic session." };
  if (!coordinatorId) return { error: "Select a coordinator." };

  const coordinator = await prisma.user.findUnique({ where: { id: coordinatorId } });
  if (!coordinator || coordinator.role !== "LECTURER") return { error: "Select a lecturer." };

  const row = await prisma.levelCoordinator.upsert({
    where: { level_department_academicSession: { level, department, academicSession } },
    create: {
      level,
      department,
      academicSession,
      coordinatorId,
      assignedById: session.userId,
    },
    update: { coordinatorId, assignedById: session.userId },
  });
  await audit("EXAMS_RECORDS", "CREATE", "LEVEL_COORDINATOR", row.id, session, undefined, {
    department,
    academicSession,
    level,
    coordinatorId,
  });
  return { ok: true };
}

export async function unassignLevelCoordinator(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) {
    return { error: "Only Heads of Department can remove coordinators." };
  }
  const id = String(formData.get("id") ?? "");
  const row = await prisma.levelCoordinator.findUnique({ where: { id } });
  if (!row) return { error: "Coordinator not found." };
  if (row.department !== session.user.department) {
    return { error: "You can only remove coordinators in your own department." };
  }
  await prisma.levelCoordinator.delete({ where: { id } });
  await audit("EXAMS_RECORDS", "DELETE", "LEVEL_COORDINATOR", id, session, { level: row.level });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Governance: appointment lifecycle
// ---------------------------------------------------------------------------

const PROPOSABLE_BY_DEAN = ["HOD"];
const PROPOSABLE_BY_DVC = ["DEAN", "DIRECTOR_ACADEMIC_PLANNING"];

export async function proposeAppointment(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role !== "DEAN" && role !== "DVC_OVERSIGHT") {
    return { error: "Only Deans and the DVC can propose appointments." };
  }
  const appointeeId = String(formData.get("appointeeId") ?? "");
  const targetRole = String(formData.get("role") ?? "");
  const unit = String(formData.get("unit") ?? "").trim();
  const academicSession = String(formData.get("academicSession") ?? "").trim();
  if (!appointeeId || !targetRole || !unit) return { error: "Fill in the appointee, role and unit." };
  if (!academicSession) return { error: "Select an academic session." };

  const allowed = role === "DEAN" ? PROPOSABLE_BY_DEAN : PROPOSABLE_BY_DVC;
  if (!allowed.includes(targetRole)) {
    return { error: "Your role cannot propose that target role." };
  }
  const appointee = await prisma.user.findUnique({ where: { id: appointeeId } });
  if (!appointee || appointee.status !== "ACTIVE") return { error: "Select an active staff member." };

  const duplicate = await prisma.appointment.findFirst({
    where: { appointeeId, role: targetRole, academicSession, status: { in: ["PROPOSED", "APPROVED"] } },
  });
  if (duplicate) return { error: "That person already has a pending or approved appointment for this role." };

  const row = await prisma.appointment.create({
    data: {
      role: targetRole,
      unit,
      appointeeId,
      proposerId: session.userId,
      status: "PROPOSED",
      academicSession,
    },
  });
  await audit("ADMIN_SYSTEM", "CREATE", "APPOINTMENT", row.id, session, undefined, {
    role: targetRole,
    unit,
    appointeeId,
  });
  return { ok: true };
}

async function appointmentApprover(
  session: { userId: string; user: { role: string } },
  appointment: { role: string; status: string },
): Promise<string | null> {
  if (appointment.role === "HOD") {
    return session.user.role === "DVC_OVERSIGHT" ? session.userId : null;
  }
  return session.user.role === "VC" ? session.userId : null;
}

export async function approveAppointment(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: "Appointment not found." };
  const approverId = await appointmentApprover(session, appointment);
  if (!approverId) return { error: "Your role cannot approve this appointment." };
  if (appointment.status !== "PROPOSED") {
    return { error: "Only proposed appointments can be approved." };
  }
  await prisma.appointment.update({
    where: { id },
    data: { status: "APPROVED", approverId },
  });
  await audit("ADMIN_SYSTEM", "APPROVE", "APPOINTMENT", id, session, { status: appointment.status });
  return { ok: true };
}

export async function rejectAppointment(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: "Appointment not found." };
  const approverId = await appointmentApprover(session, appointment);
  if (!approverId) return { error: "Your role cannot reject this appointment." };
  if (appointment.status !== "PROPOSED") {
    return { error: "Only proposed appointments can be rejected." };
  }
  await prisma.appointment.update({
    where: { id },
    data: { status: "REJECTED", approverId },
  });
  await audit("ADMIN_SYSTEM", "UPDATE", "APPOINTMENT", id, session, { status: appointment.status }, { status: "REJECTED" });
  return { ok: true };
}

export async function recordAppointment(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "REGISTRY") {
    return { error: "Only the Registry can record appointments." };
  }
  const id = String(formData.get("id") ?? "");
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: "Appointment not found." };
  if (appointment.status !== "APPROVED") {
    return { error: "Only approved appointments can be recorded." };
  }
  await prisma.appointment.update({
    where: { id },
    data: { status: "RECORDED", recorderId: session.userId, issuedAt: new Date() },
  });
  await audit("ADMIN_SYSTEM", "UPDATE", "APPOINTMENT", id, session, { status: appointment.status }, { status: "RECORDED" });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dean: return results to the department
// ---------------------------------------------------------------------------

export async function returnResult(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") {
    return { error: "Only Deans can return results." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for returning this result." };

  const result = await prisma.result.findUnique({ where: { id }, include: { course: true } });
  if (!result) return { error: "Result not found." };
  if (result.gradeStatus !== "HOD_APPROVED") {
    return { error: `Only HoD-approved results can be returned (current stage: ${result.gradeStatus}).` };
  }
  const faculty = session.user.faculty;
  if (!faculty) {
    return { error: "Your account has no faculty scope. Contact the registry." };
  }
  const departments = await facultyDepartments(faculty);
  const inFaculty = await prisma.courseAssignment.count({
    where: { courseCode: result.course.code, department: { in: departments } },
  });
  if (inFaculty === 0) return { error: "This result does not belong to your faculty." };

  await prisma.result.update({
    where: { id },
    data: { gradeStatus: "SUBMITTED", approvedBy1Id: null, approvedAt1: null },
  });
  await audit("EXAMS_RECORDS", "UPDATE", "RESULT", id, session, { gradeStatus: result.gradeStatus }, {
    gradeStatus: "SUBMITTED",
    reason,
  });
  return { ok: true };
}

// Senate-approved results (SENATE_APPROVED) that are not yet FINAL are a
// pipeline dead-end: no action in the codebase moves them to FINAL, which the
// governance monitor flags as "results-senate-approved". The Exams & Records
// office is the Senate-authorized finaliser — it records the Senate's
// ratification, which makes the result permanent (FINAL rows are immutable).
export async function finaliseResult(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "EXAMS_RECORDS") {
    return { error: "Only the Exams & Records office can finalise results." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Select a result to finalise." };

  const result = await prisma.result.findUnique({ where: { id } });
  if (!result) return { error: "Result not found." };
  if (result.gradeStatus !== "SENATE_APPROVED") {
    return { error: `Only Senate-approved results can be finalised (current stage: ${result.gradeStatus}).` };
  }

  await prisma.result.update({
    where: { id },
    data: { gradeStatus: "FINAL" },
  });
  await audit("EXAMS_RECORDS", "FINALIZE", "RESULT", id, session, { gradeStatus: "SENATE_APPROVED" }, {
    gradeStatus: "FINAL",
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: password resets
// ---------------------------------------------------------------------------

const DEFAULT_DEMO_PASSWORD = "UniAbuja@2026";

export async function resetUserPassword(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot reset passwords." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const id = String(formData.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found." };

  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await hashPassword(DEFAULT_DEMO_PASSWORD),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  await audit("ADMIN_SYSTEM", "UPDATE", "USER", target.id, session, undefined, { resetPassword: true });
  return { ok: true };
}

export async function resetAllPasswords(
  _prev: ModuleActionResult | null,
  _formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "ADMIN_SYSTEM", "A")) {
    return { error: "Your role cannot reset passwords." };
  }
  const stepUp = await stepUpGuard(session);
  if (stepUp) return { error: stepUp };

  const hash = await hashPassword(DEFAULT_DEMO_PASSWORD);
  await prisma.user.updateMany({
    where: { id: { not: session.userId } },
    data: { passwordHash: hash, mustChangePassword: true, failedAttempts: 0, lockedUntil: null },
  });
  await audit("ADMIN_SYSTEM", "UPDATE", "USER", session.userId, session, undefined, {
    resetAllPasswords: true,
    exclude: session.userId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bursary workspace: invoice issuance
// ---------------------------------------------------------------------------

// Returns the acting bursary session or an error string for Bursary-only actions.
async function bursarySession(
  session: Awaited<ReturnType<typeof getCurrentSession>>,
): Promise<string | null> {
  if (!session) return null;
  if (session.user.role !== "BURSARY") {
    return "Only the Bursary can perform this action.";
  }
  const stepUp = await stepUpGuard(session);
  return stepUp;
}

export async function issueInvoice(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const registrationNo = String(formData.get("registrationNo") ?? "").trim();
  const invoiceModule = String(formData.get("module") ?? "").trim();
  const amountNaira = String(formData.get("amountNaira") ?? "").trim();
  const dueOnRaw = String(formData.get("dueOn") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!registrationNo) return { error: "Registration number is required." };
  if (!INVOICE_MODULES.includes(invoiceModule as (typeof INVOICE_MODULES)[number])) {
    return { error: "Select a valid fee module." };
  }
  const amountCents = Math.round(Number(amountNaira) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Enter a valid amount greater than zero." };
  }
  if (amountCents > MAX_ISSUABLE_INVOICE_CENTS) {
    return { error: "Amount exceeds the maximum allowed for a single invoice." };
  }
  const dueOn = new Date(dueOnRaw);
  if (Number.isNaN(dueOn.getTime())) {
    return { error: "Select a valid due date." };
  }
  if (!description) return { error: "Description is required." };
  if (description.length > 300) return { error: "Description is too long (300 characters max)." };

  const student = await prisma.user.findUnique({ where: { registrationNo } });
  if (!student || student.role !== "STUDENT") {
    return { error: "No student with that registration number was found." };
  }

  // Ensure the student has a fee account so clearance status is explicit.
  // Tuition/acceptance obligations block course-registration finalisation, so
  // issuing one must revoke fee clearance until it is paid or waived.
  await prisma.feeAccount.upsert({
    where: { userId: student.id },
    create: { userId: student.id, balanceCents: 0, clearanceStatus: false },
    update:
      invoiceModule === "TUITION" || invoiceModule === "ACCEPTANCE" ? { clearanceStatus: false } : {},
  });

  const invoice = await prisma.invoice.create({
    data: {
      userId: student.id,
      module: invoiceModule,
      description,
      amountCents,
      dueOn,
      status: "OPEN",
    },
  });

  await audit("FEES", "CREATE", "INVOICE", invoice.id, session, undefined, {
    registrationNo,
    module: invoiceModule,
    description,
    amountCents,
    dueOn: dueOnRaw,
    status: "OPEN",
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bursary workspace: manual payment reconciliation
// ---------------------------------------------------------------------------

export async function reconcilePayment(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: "Missing payment." };

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found." };
  if (payment.status === "RECONCILED") {
    return { error: "This payment is already reconciled." };
  }
  // Manual reconciliation confirms an already-successful gateway payment
  // against the TSA sweep. It never moves PENDING or FAILED payments.
  if (payment.status !== "SUCCESS") {
    return { error: "Only successful payments can be reconciled." };
  }

  const before = {
    status: payment.status,
    tsaSwept: payment.tsaSwept,
    reference: payment.reference,
    amountCents: payment.amountCents,
  };
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "RECONCILED", tsaSwept: true },
  });

  // Keep the linked invoice state consistent with the reconciled payment.
  if (payment.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (invoice && (invoice.status === "OPEN" || invoice.status === "OVERDUE" || invoice.status === "PARTIAL")) {
      const paid = await prisma.payment.aggregate({
        where: { invoiceId: invoice.id, status: { in: ["SUCCESS", "RECONCILED"] } },
        _sum: { amountCents: true },
      });
      const paidCents = paid._sum.amountCents ?? 0;
      if (paidCents >= invoice.amountCents) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" },
        });
        const account = await prisma.feeAccount.findUnique({ where: { userId: invoice.userId } });
        if (account) {
          await prisma.feeAccount.update({
            where: { id: account.id },
            data: { clearanceStatus: true },
          });
        }
      }
    }
  }

  await audit("FEES", "RECONCILE", "PAYMENT", payment.id, session, before, {
    status: "RECONCILED",
    tsaSwept: true,
    reference: payment.reference,
    amountCents: payment.amountCents,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bursary workspace: waivers (approval applies the percentage to the invoice)
// ---------------------------------------------------------------------------

export async function approveWaiver(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const waiverId = String(formData.get("waiverId") ?? "");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim().slice(0, 500);
  if (!waiverId) return { error: "Missing waiver." };

  const waiver = await prisma.waiver.findUnique({
    where: { id: waiverId },
    include: { invoice: true },
  });
  if (!waiver) return { error: "Waiver not found." };
  if (waiver.status !== "PENDING") return { error: "Only pending waivers can be approved." };

  const before = {
    status: waiver.status,
    percent: waiver.percent,
    invoiceId: waiver.invoiceId,
    invoiceStatus: waiver.invoice?.status,
    invoiceAmountCents: waiver.invoice?.amountCents,
  };

  const applied: { invoiceStatus?: string; invoiceAmountCents?: number } = {};

  // Apply the concession to the linked invoice (approved balance edit, audited).
  const invoice = waiver.invoice;
  if (invoice && (invoice.status === "OPEN" || invoice.status === "OVERDUE" || invoice.status === "PARTIAL")) {
    const pct = Math.max(0, Math.min(100, waiver.percent));
    if (pct >= 100) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "WAIVED" } });
      applied.invoiceStatus = "WAIVED";
      const account = await prisma.feeAccount.findUnique({ where: { userId: invoice.userId } });
      if (account) {
        await prisma.feeAccount.update({
          where: { id: account.id },
          data: { clearanceStatus: true },
        });
      }
    } else {
      const waivedAmount = Math.round((invoice.amountCents * pct) / 100);
      const newAmount = Math.max(0, invoice.amountCents - waivedAmount);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { amountCents: newAmount, status: "PARTIAL" },
      });
      applied.invoiceStatus = "PARTIAL";
      applied.invoiceAmountCents = newAmount;
    }
  }

  await prisma.waiver.update({
    where: { id: waiver.id },
    data: { status: "APPROVED", approvedById: session.userId },
  });

  await audit("FEES", "APPROVE", "WAIVER", waiver.id, session, before, {
    status: "APPROVED",
    approvedById: session.userId,
    decisionNote: decisionNote || null,
    ...applied,
  });
  return { ok: true };
}

export async function rejectWaiver(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const waiverId = String(formData.get("waiverId") ?? "");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim().slice(0, 500);
  if (!waiverId) return { error: "Missing waiver." };

  const waiver = await prisma.waiver.findUnique({ where: { id: waiverId } });
  if (!waiver) return { error: "Waiver not found." };
  if (waiver.status !== "PENDING") return { error: "Only pending waivers can be rejected." };

  await prisma.waiver.update({
    where: { id: waiver.id },
    data: { status: "REJECTED", approvedById: session.userId },
  });
  await audit("FEES", "UPDATE", "WAIVER", waiver.id, session, { status: waiver.status }, {
    status: "REJECTED",
    approvedById: session.userId,
    decisionNote: decisionNote || null,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bursary workspace: scholarships (approval/rejection; no invoice link exists)
// ---------------------------------------------------------------------------

export async function approveScholarship(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const scholarshipId = String(formData.get("scholarshipId") ?? "");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim().slice(0, 500);
  if (!scholarshipId) return { error: "Missing scholarship." };

  const scholarship = await prisma.scholarship.findUnique({ where: { id: scholarshipId } });
  if (!scholarship) return { error: "Scholarship not found." };
  if (scholarship.status !== "PENDING") return { error: "Only pending scholarships can be approved." };

  await prisma.scholarship.update({
    where: { id: scholarship.id },
    data: { status: "APPROVED", approvedById: session.userId, decisionNote: decisionNote || null },
  });
  await audit("FEES", "APPROVE", "SCHOLARSHIP", scholarship.id, session, { status: scholarship.status }, {
    status: "APPROVED",
    approvedById: session.userId,
    decisionNote: decisionNote || null,
  });
  return { ok: true };
}

export async function rejectScholarship(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const deny = await bursarySession(session);
  if (deny) return { error: deny };

  const scholarshipId = String(formData.get("scholarshipId") ?? "");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim().slice(0, 500);
  if (!scholarshipId) return { error: "Missing scholarship." };

  const scholarship = await prisma.scholarship.findUnique({ where: { id: scholarshipId } });
  if (!scholarship) return { error: "Scholarship not found." };
  if (scholarship.status !== "PENDING") return { error: "Only pending scholarships can be rejected." };

  await prisma.scholarship.update({
    where: { id: scholarship.id },
    data: { status: "REJECTED", approvedById: session.userId, decisionNote: decisionNote || null },
  });
  await audit("FEES", "UPDATE", "SCHOLARSHIP", scholarship.id, session, { status: scholarship.status }, {
    status: "REJECTED",
    approvedById: session.userId,
    decisionNote: decisionNote || null,
  });
  return { ok: true };
}


