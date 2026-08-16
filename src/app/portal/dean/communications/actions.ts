"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export type FacultyAnnouncementResult = { error?: string; ok?: boolean };

const CATEGORIES = ["NEWS", "NOTICE", "DEADLINE", "ADMISSION", "GENERAL"];
// Faculty-targeted audiences. PUBLIC is deliberately excluded: a Dean may
// never publish a university-wide announcement.
const DEAN_SCOPES = ["FACULTY", "STUDENT", "STAFF", "ROLE"];
const ROLE_AUDIENCES = ["HOD", "LECTURER", "DEAN", "EXAMS_RECORDS", "PG_SCHOOL", "STUDENT_AFFAIRS"];

// Publish an announcement scoped to the Dean's own faculty. The faculty is
// always taken from the session server-side; a manipulated form field can
// never attach an announcement to another faculty. The model has no draft
// stage, so creating an announcement publishes it immediately (matching the
// existing communications console).
export async function createFacultyAnnouncement(
  _prev: FacultyAnnouncementResult | null,
  formData: FormData,
): Promise<FacultyAnnouncementResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") {
    return { error: "Only a Dean can publish faculty announcements." };
  }
  const faculty = session.user.faculty;
  if (!faculty) {
    return { error: "Your account is not linked to a faculty." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const scope = String(formData.get("scope") ?? "");

  if (!title || !body) {
    return { error: "Provide both a title and a message body." };
  }
  if (!CATEGORIES.includes(category)) return { error: "Select a category." };
  if (!DEAN_SCOPES.includes(scope)) return { error: "Select an audience." };

  let visibleToRoles: string[] | undefined;
  if (scope === "ROLE") {
    const raw = String(formData.get("roles") ?? "");
    const roles = raw
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter((r) => ROLE_AUDIENCES.includes(r));
    if (roles.length === 0) {
      return { error: "Select at least one role for a role-targeted announcement." };
    }
    visibleToRoles = roles;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      category,
      scope,
      ...(visibleToRoles ? { visibleToRoles } : {}),
      faculty,
      authorId: session.userId,
      publishedAt: new Date(),
    },
  });

  await writeAudit({
    action: "CREATE",
    module: "COMMUNICATIONS",
    targetType: "ANNOUNCEMENT",
    targetId: announcement.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { title, category, scope, faculty, ...(visibleToRoles ? { roles: visibleToRoles } : {}) },
  });

  return { ok: true };
}
