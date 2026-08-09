"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, validatePasswordPolicy } from "@/lib/password";
import {
  createSession,
  getCurrentSession,
  revokeAllSessions,
  revokeSession,
  metaFromHeaders,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MS,
  PASSWORD_POLICY,
  normaliseIdentifier,
  MAX_CONCURRENT_SESSIONS,
} from "@/lib/constants";

export type AuthResult = { error?: string };

// Usernames that are email addresses are matched case-insensitively so accounts
// created with a lowercase email (e.g. the public application form) can sign in
// regardless of how the identifier is typed.
export async function findUserByUsername(username: string) {
  let user = await prisma.user.findUnique({ where: { username } });
  if (!user && username.includes("@")) {
    user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }
  return user;
}

async function meta() {
  return metaFromHeaders(await headers());
}

export async function login(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const m = await meta();
  const ip = m.ip ?? "unknown";

  const lim = rateLimit(`login:${ip}`, 20, 60_000);
  if (!lim.allowed) {
    return { error: `Too many attempts. Try again in ${lim.retryAfterSeconds}s.` };
  }

  const username = normaliseIdentifier(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const website = String(formData.get("website") ?? ""); // honeypot
  if (website) return { error: "Invalid request." };
  if (!username || !password) return { error: "Enter both username and password." };

  const captchaToken = String(formData.get("captcha") ?? "");
  const captchaAnswer = String(formData.get("captchaAnswer") ?? "");
  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return { error: "Incorrect CAPTCHA answer. Try again." };
  }

  const user = await findUserByUsername(username);
  if (!user) {
    await writeAudit({
      action: "AUTH_FAIL",
      module: "AUTH",
      targetType: "USERNAME",
      targetId: username,
      meta: m,
      actorUsername: username,
    });
    return { error: "Invalid username or password." };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { error: "Account temporarily locked. Try again later." };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedAttempts + 1;
    const lockUntil =
      failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: failed, lockedUntil: lockUntil },
    });
    await writeAudit({
      action: "AUTH_FAIL",
      module: "AUTH",
      targetType: "USER",
      targetId: user.id,
      meta: m,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      after: { failedAttempts: failed },
    });
    return lockUntil
      ? { error: "Too many failed attempts. Account locked for 15 minutes." }
      : { error: "Invalid username or password." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  // Concurrent session cap: evict the oldest active sessions beyond the limit.
  const activeSessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const excess = activeSessions.slice(0, Math.max(0, activeSessions.length - MAX_CONCURRENT_SESSIONS + 1));
  if (excess.length > 0) {
    await prisma.session.updateMany({
      where: { id: { in: excess.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      action: "REVOKE",
      module: "AUTH",
      targetType: "SESSION",
      targetId: user.id,
      meta: m,
      actorUserId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      after: { evicted: excess.length, limit: MAX_CONCURRENT_SESSIONS },
    });
  }

  await createSession(user.id, m, !user.mfaEnabled);
  await writeAudit({
    action: "LOGIN",
    module: "AUTH",
    targetType: "USER",
    targetId: user.id,
    meta: m,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
  });

  if (user.mustChangePassword) redirect("/login/change-password");
  if (user.mfaEnabled) redirect("/login/mfa");
  redirect("/portal/dashboard");
}

export async function changePassword(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const m = await meta();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next !== confirm) return { error: "New passwords do not match." };
  const policy = validatePasswordPolicy(next);
  if (!policy.ok) {
    return { error: `Password must include: ${policy.reasons.join("; ")}.` };
  }

  const session = await getCurrentSession();
  if (!session) return { error: "Session not found. Please sign in again." };
  const user = session.user;

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  // Password history: reject reuse of any of the last `history` passwords.
  const history = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: PASSWORD_POLICY.history,
  });
  for (const h of history) {
    if (await verifyPassword(next, h.passwordHash)) {
      return { error: "That password was used recently. Choose a different one." };
    }
  }

  const nextHash = await hashPassword(next);
  const allHistory = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const keep = PASSWORD_POLICY.history - 1;
  if (allHistory.length >= keep) {
    const dropIds = allHistory.slice(keep).map((h) => h.id);
    if (dropIds.length > 0) {
      await prisma.passwordHistory.deleteMany({ where: { id: { in: dropIds } } });
    }
  }
  await prisma.passwordHistory.create({
    data: { userId: user.id, passwordHash: user.passwordHash },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: nextHash, mustChangePassword: false },
  });
  await writeAudit({
    action: "CONFIG",
    module: "AUTH",
    targetType: "USER",
    targetId: user.id,
    before: { mustChangePassword: true },
    after: { passwordChanged: true },
    meta: m,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    sessionId: session.id,
  });
  redirect("/portal/dashboard");
}

export async function logout(): Promise<void> {
  const m = await meta();
  const session = await getCurrentSession();
  if (session) {
    await writeAudit({
      action: "LOGOUT",
      module: "AUTH",
      targetType: "SESSION",
      targetId: session.id,
      meta: m,
      actorUserId: session.userId,
      actorUsername: session.user.username,
      actorRole: session.user.role,
      sessionId: session.id,
    });
    await revokeSession(session.id);
  }
  redirect("/");
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const m = await meta();
  const current = await getCurrentSession();
  if (!current) return;
  const revokeId = String(formData.get("revokeId") ?? "");
  if (revokeId) {
    await prisma.session.update({
      where: { id: revokeId },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      action: "REVOKE",
      module: "AUTH",
      targetType: "SESSION",
      targetId: revokeId,
      meta: m,
      actorUserId: current.userId,
      actorUsername: current.user.username,
      actorRole: current.user.role,
      sessionId: current.id,
    });
  }
}

export async function revokeAllSessionsAction(): Promise<void> {
  const m = await meta();
  const current = await getCurrentSession();
  if (!current) return;
  await revokeAllSessions(current.userId);
  await writeAudit({
    action: "REVOKE",
    module: "AUTH",
    targetType: "USER",
    targetId: current.userId,
    meta: m,
    actorUserId: current.userId,
    actorUsername: current.user.username,
    actorRole: current.user.role,
    sessionId: current.id,
  });
}
