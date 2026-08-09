import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { writeAudit } from "@/lib/audit";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Compute the canonical app origin from the incoming request so email links
// point at the right environment (localhost, Vercel preview, production).
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IssueResult = {
  ok: boolean;
  error?: string;
  sent: boolean;
  link?: string;
};

// Create a one-time magic-link token for the user and (if an email provider is
// configured) email it. In demo mode the caller shows `link` directly.
export async function issueEmailVerification(user: {
  id: string;
  email: string;
  fullName: string;
}): Promise<IssueResult> {
  // Invalidate any previous pending tokens for this user.
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });

  const link = `${await appOrigin()}/verify-email?token=${token}`;
  const firstName = user.fullName.split(/\s+/)[0] ?? "there";

  if (!isEmailConfigured()) {
    return { ok: true, sent: false, link };
  }

  const res = await sendEmail({
    to: user.email,
    subject: "Verify your email — UniAbuja Portal",
    html: `
      <p>Hello ${firstName},</p>
      <p>Thanks for starting your application. Please verify your email address by clicking the button below:</p>
      <p><a href="${link}" style="background:#1e7a12;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Verify my email</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours. If you did not start an application, you can safely ignore this email.</p>
    `,
  });
  return { ok: res.ok, sent: res.ok, error: res.error, link: res.ok ? undefined : link };
}

export type VerifyResult = {
  ok: boolean;
  error?: string;
  fullName?: string;
};

// Validate a raw magic-link token and mark the user verified. Returns the
// user's full name on success so the confirmation page can personalise it.
export async function verifyEmailToken(rawToken: string): Promise<VerifyResult> {
  const hashed = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: hashed },
    include: { user: true },
  });
  if (!record) {
    return { ok: false, error: "This verification link is invalid." };
  }
  if (record.usedAt) {
    return { ok: false, error: "This verification link has already been used. Please sign in." };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This verification link has expired. Request a new one from the sign-in screen." };
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  await writeAudit({
    action: "VERIFY",
    module: "AUTH",
    targetType: "USER",
    targetId: record.userId,
    meta: null,
    actorUserId: record.userId,
    actorUsername: record.user.username,
    actorRole: record.user.role,
    after: { emailVerifiedAt: new Date().toISOString() },
  }).catch(() => {});

  return { ok: true, fullName: record.user.fullName };
}
