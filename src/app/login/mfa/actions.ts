"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";
import { landingForRole } from "@/lib/constants";

export type MfaLoginResult = { error?: string };

async function meta() {
  return metaFromHeaders(await headers());
}

export async function verifyMfaCode(
  _prev: MfaLoginResult | null,
  formData: FormData,
): Promise<MfaLoginResult> {
  const m = await meta();
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!session.user.mfaEnabled) redirect(landingForRole(session.user.role));

  const ip = m.ip ?? "unknown";
  const lim = rateLimit(`mfa:${session.userId}:${ip}`, 10, 60_000);
  if (!lim.allowed) {
    return { error: `Too many attempts. Try again in ${lim.retryAfterSeconds}s.` };
  }

  const code = String(formData.get("code") ?? "");
  if (!session.user.mfaSecret || !verifyTotp(session.user.mfaSecret, code)) {
    await writeAudit({
      action: "MFA_FAIL",
      module: "AUTH",
      targetType: "USER",
      targetId: session.userId,
      meta: m,
      actorUserId: session.userId,
      actorUsername: session.user.username,
      actorRole: session.user.role,
      sessionId: session.id,
    });
    return { error: "Invalid code." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { mfaVerifiedAt: new Date(), stepUpUntil: new Date(Date.now() + 30 * 60 * 1000) },
  });
  await writeAudit({
    action: "LOGIN",
    module: "AUTH",
    targetType: "USER",
    targetId: session.userId,
    meta: m,
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { mfa: true },
  });

  redirect(landingForRole(session.user.role));
}
