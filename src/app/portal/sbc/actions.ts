"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/constants";
import {
  MATTER_CATEGORIES,
  RESOLUTIONS,
  canRecordDecision,
  canScreen,
  canWithdraw,
  nextMatterReference,
} from "@/lib/senate";

export type SbcActionResult = { error?: string; ok?: boolean };

// Roles that may create the official Senate agenda. The SBC Chairman is
// deliberately absent: agenda preparation belongs to the Senate registrar.
const AGENDA_CREATOR_ROLES = ["REGISTRY", "EXAMS_RECORDS"];

// Announcement audiences the SBC Chairman may publish to. PUBLIC is excluded
// so Senate communications stay within the institution, never on the homepage.
const SBC_SCOPES = ["STAFF", "ROLE"];
const SBC_ROLE_AUDIENCES = [
  "SBC_CHAIRMAN",
  "DEAN",
  "HOD",
  "EXAMS_RECORDS",
  "REGISTRY",
  "DVC_OVERSIGHT",
  "VC",
];

async function sessionOrRedirect() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

async function auditSbc(
  session: { userId: string; user: { username: string; role: string }; id: string },
  action: "CREATE" | "APPROVE" | "UPDATE",
  targetType: string,
  targetId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
) {
  await writeAudit({
    action,
    module: "SENATE",
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

// Raise a new matter for Senate consideration (status SUBMITTED).
export async function submitMatter(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!can(session.user.role, "SENATE", "W")) {
    return { error: "Your role cannot raise matters for Senate consideration." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!title || !summary) {
    return { error: "Provide both a matter title and a summary." };
  }
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };
  if (!(MATTER_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Select a valid matter category." };
  }

  const reference = await nextMatterReference();
  const matter = await prisma.senateMatter.create({
    data: { reference, title, summary, category, submittedById: session.userId },
  });

  await auditSbc(session, "CREATE", "SENATE_MATTER", matter.id, undefined, {
    reference,
    title,
    category,
    status: matter.status,
  });
  return { ok: true };
}

// Screen a submitted matter for Senate consideration (SUBMITTED → SCREENED).
export async function screenMatter(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!can(session.user.role, "SENATE", "A")) {
    return { error: "Your role cannot screen matters." };
  }

  const id = String(formData.get("id") ?? "");
  const matter = await prisma.senateMatter.findUnique({ where: { id } });
  if (!matter) return { error: "Matter not found." };
  if (!canScreen(matter.status)) {
    return { error: `This matter is not awaiting screening (current stage: ${matter.status}).` };
  }

  const before = { status: matter.status };
  const after = { status: "SCREENED" as const };
  await prisma.senateMatter.update({
    where: { id },
    data: { status: "SCREENED", screenedById: session.userId, screenedAt: new Date() },
  });

  await auditSbc(session, "APPROVE", "SENATE_MATTER", id, before, after);
  return { ok: true };
}

// Record a Senate decision on a matter. The only path to a decision is through
// the workflow: the matter must already be SCREENED, and recording atomically
// moves it to DECIDED. There is no direct insert of a SenateDecision row.
export async function recordSenateDecision(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!can(session.user.role, "SENATE", "A")) {
    return { error: "Your role cannot record Senate decisions." };
  }

  const id = String(formData.get("id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();
  const decisionBody = String(formData.get("decisionBody") ?? "").trim();

  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) {
    return { error: "Select a valid resolution." };
  }
  if (!decisionBody) {
    return { error: "A decision body is required." };
  }

  const matter = await prisma.senateMatter.findUnique({
    where: { id },
    include: { decision: true },
  });
  if (!matter) return { error: "Matter not found." };
  if (matter.decision) {
    return { error: "This matter already has a recorded decision." };
  }
  if (!canRecordDecision(matter.status)) {
    return {
      error: `A decision can only be recorded through the workflow once the matter has been screened (current stage: ${matter.status}).`,
    };
  }

  const before = { status: matter.status };
  const after = { status: "DECIDED" as const, resolution };
  const decision = await prisma.$transaction(async (tx) => {
    const created = await tx.senateDecision.create({
      data: { matterId: id, resolution, decisionBody, recordedById: session.userId },
    });
    await tx.senateMatter.update({ where: { id }, data: { status: "DECIDED" } });
    return created;
  });

  await auditSbc(session, "CREATE", "SENATE_DECISION", decision.id, before, {
    ...after,
    matterId: id,
  });
  return { ok: true };
}

// Withdraw a matter that has not yet been screened.
export async function withdrawMatter(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!can(session.user.role, "SENATE", "W")) {
    return { error: "Your role cannot withdraw matters." };
  }

  const id = String(formData.get("id") ?? "");
  const matter = await prisma.senateMatter.findUnique({ where: { id } });
  if (!matter) return { error: "Matter not found." };
  if (!canWithdraw(matter.status)) {
    return { error: `This matter cannot be withdrawn (current stage: ${matter.status}).` };
  }

  const before = { status: matter.status };
  const after = { status: "WITHDRAWN" as const };
  await prisma.senateMatter.update({ where: { id }, data: { status: "WITHDRAWN" } });

  await auditSbc(session, "UPDATE", "SENATE_MATTER", id, before, after);
  return { ok: true };
}

// Publish a Senate announcement (institution-scoped; never PUBLIC).
export async function createSenateAnnouncement(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!can(session.user.role, "COMMUNICATIONS", "W")) {
    return { error: "Your role cannot publish Senate announcements." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim();

  if (!title || !body) {
    return { error: "Provide both a title and a message body." };
  }
  if (!SBC_SCOPES.includes(scope)) {
    return { error: "Select an audience for the announcement." };
  }

  let visibleToRoles: string[] | undefined;
  if (scope === "ROLE") {
    const raw = String(formData.get("roles") ?? "");
    const roles = raw
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter((r) => SBC_ROLE_AUDIENCES.includes(r));
    if (roles.length === 0) {
      return { error: "Select at least one role for a role-targeted announcement." };
    }
    visibleToRoles = roles;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      category: "NOTICE",
      scope,
      ...(visibleToRoles ? { visibleToRoles } : {}),
      authorId: session.userId,
      publishedAt: new Date(),
    },
  });

  await auditSbc(session, "CREATE", "ANNOUNCEMENT", announcement.id, undefined, {
    title,
    category: "NOTICE",
    scope,
    ...(visibleToRoles ? { roles: visibleToRoles } : {}),
  });
  return { ok: true };
}

// Create the official Senate agenda. Restricted to the Senate registrar roles;
// the SBC Chairman cannot create it (enforced here and by the access matrix).
export async function createSenateAgenda(
  _prev: SbcActionResult | null,
  formData: FormData,
): Promise<SbcActionResult> {
  const session = await sessionOrRedirect();
  if (!AGENDA_CREATOR_ROLES.includes(session.user.role)) {
    return { error: "Only Registry / Exams & Records may create the official Senate agenda." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const meetingDateRaw = String(formData.get("meetingDate") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "").trim();

  if (!title) return { error: "An agenda title is required." };
  const meetingDate = new Date(meetingDateRaw);
  if (Number.isNaN(meetingDate.getTime())) {
    return { error: "A valid meeting date is required." };
  }
  const items = itemsRaw
    .split("\n")
    .map((i) => i.trim())
    .filter(Boolean);
  if (items.length === 0) return { error: "Add at least one agenda item." };

  const agenda = await prisma.senateAgenda.create({
    data: {
      title,
      meetingDate,
      items,
      status: "SCHEDULED",
      createdById: session.userId,
    },
  });

  await auditSbc(session, "CREATE", "SENATE_AGENDA", agenda.id, undefined, {
    title,
    meetingDate: meetingDate.toISOString(),
    itemCount: items.length,
  });
  return { ok: true };
}
