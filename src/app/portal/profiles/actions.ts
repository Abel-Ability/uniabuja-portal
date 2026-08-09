"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/constants";
import type { ModuleActionResult } from "@/lib/module-actions";

export async function updateStaffProfile(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "PROFILES", "W")) {
    return { error: "Your role cannot update a staff profile." };
  }

  const designation = String(formData.get("designation") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const orcid = String(formData.get("orcid") ?? "").trim();

  const profile = await prisma.staffProfile.upsert({
    where: { userId: session.userId },
    update: {
      designation: designation || null,
      bio: bio || null,
      orcid: orcid || null,
    },
    create: {
      userId: session.userId,
      designation: designation || null,
      bio: bio || null,
      orcid: orcid || null,
    },
  });

  await writeAudit({
    action: "UPDATE",
    module: "PROFILES",
    targetType: "STAFF_PROFILE",
    targetId: profile.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { designation, orcid, bio },
  });

  return { ok: true };
}
