"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/constants";

export type AnnouncementResult = { error?: string; ok?: boolean };

const CATEGORIES = ["NEWS", "NOTICE", "DEADLINE", "ADMISSION", "GENERAL"];
const SCOPES = ["PUBLIC", "STUDENT", "STAFF", "ROLE"];

export async function createAnnouncement(
  _prev: AnnouncementResult | null,
  formData: FormData,
): Promise<AnnouncementResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "COMMUNICATIONS", "W")) {
    return { error: "Your role cannot publish announcements." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const scope = String(formData.get("scope") ?? "");

  if (!title || !body) {
    return { error: "Provide both a title and a message body." };
  }
  if (!CATEGORIES.includes(category)) return { error: "Select a category." };
  if (!SCOPES.includes(scope)) return { error: "Select a scope." };

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      category,
      scope,
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
    after: { title, category },
  });

  return { ok: true };
}
