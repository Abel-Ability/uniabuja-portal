"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { metaFromHeaders } from "@/lib/session";
import { headers } from "next/headers";

export type TicketResult = { error?: string };

export async function openTicket(
  _prev: TicketResult | null,
  formData: FormData,
): Promise<TicketResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const priority = String(formData.get("priority") ?? "NORMAL");

  if (!subject || !body) return { error: "Provide both a subject and a description." };
  if (subject.length > 120) return { error: "Subject is too long (120 max)." };

  const ticket = await prisma.helpTicket.create({
    data: { userId: session.userId, subject, body, priority },
  });

  await writeAudit({
    action: "CREATE",
    module: "HELPDESK",
    targetType: "HELP_TICKET",
    targetId: ticket.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { priority },
  });

  return {};
}
