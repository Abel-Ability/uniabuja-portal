"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { generateMfaSecret, verifyTotp, currentTotp } from "@/lib/totp";

export type MfaResult = { ok?: boolean; error?: string; secret?: string; code?: string };

async function meta() {
  return metaFromHeaders(await headers());
}

export async function enableMfa(): Promise<MfaResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const m = await meta();

  if (session.user.mfaEnabled && session.user.mfaSecret) {
    return { ok: true, secret: session.user.mfaSecret, code: currentTotp(session.user.mfaSecret) };
  }

  const { base32 } = generateMfaSecret();
  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaSecret: base32, mfaEnabled: true },
  });
  await writeAudit({
    action: "CONFIG",
    module: "AUTH",
    targetType: "USER",
    targetId: session.userId,
    before: { mfaEnabled: false },
    after: { mfaEnabled: true },
    meta: m,
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
  });
  return { ok: true, secret: base32, code: currentTotp(base32) };
}

export async function disableMfa(): Promise<MfaResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const m = await meta();

  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaSecret: null, mfaEnabled: false },
  });
  await writeAudit({
    action: "CONFIG",
    module: "AUTH",
    targetType: "USER",
    targetId: session.userId,
    before: { mfaEnabled: true },
    after: { mfaEnabled: false },
    meta: m,
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
  });
  return { ok: true };
}

export async function verifyStepUp(
  _prev: MfaResult | null,
  formData: FormData,
): Promise<MfaResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const m = await meta();

  if (!session.user.mfaEnabled || !session.user.mfaSecret) {
    return { error: "MFA is not enabled on this account." };
  }

  const code = String(formData.get("code") ?? "");
  if (!verifyTotp(session.user.mfaSecret, code)) {
    return { error: "Invalid code." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { stepUpUntil: new Date(Date.now() + 30 * 60 * 1000), mfaVerifiedAt: new Date() },
  });
  await writeAudit({
    action: "STEP_UP",
    module: "AUTH",
    targetType: "SESSION",
    targetId: session.id,
    meta: m,
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { stepUp: true },
  });
  return { ok: true };
}
