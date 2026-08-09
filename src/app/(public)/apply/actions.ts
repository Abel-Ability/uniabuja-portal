"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { metaFromHeaders } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { generateCaptcha, verifyCaptcha, type CaptchaChallenge } from "@/lib/captcha";
import { issueEmailVerification } from "@/lib/verification";

export type ApplyResult = {
  ok?: boolean;
  error?: string;
  username?: string;
  tempPassword?: string;
  fullName?: string;
  programme?: string;
  reference?: string;
  verifySent?: boolean;
  verifyLink?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_TYPES = ["UTME", "DIRECT_ENTRY", "PG", "DISTANCE_LEARNING"];

// Generates a password that satisfies the portal policy (≥10 chars, upper,
// lower, digit, special) so the applicant can sign in on their first attempt.
function generateTempPassword(): string {
  const groups = [
    "ABCDEFGHJKMNPQRSTUVWXYZ",
    "abcdefghijkmnpqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];
  const pick = (set: string, n: number) =>
    Array.from(
      { length: n },
      () => set[Math.floor(Math.random() * set.length)],
    ).join("");
  return groups.map((g) => pick(g, 3)).join("");
}

// Fresh CAPTCHA challenge for the "Refresh" affordance on the public form.
export async function freshCaptchaChallenge(): Promise<CaptchaChallenge> {
  return generateCaptcha();
}

export async function submitPublicApplication(
  _prev: ApplyResult | null,
  formData: FormData,
): Promise<ApplyResult> {
  const meta = metaFromHeaders(await headers());
  const ip = meta.ip ?? "unknown";

  const lim = rateLimit(`apply:${ip}`, 5, 60_000);
  if (!lim.allowed) {
    return { error: `Too many attempts. Try again in ${lim.retryAfterSeconds}s.` };
  }

  // Honeypot + CAPTCHA guard the public form against bots.
  const website = String(formData.get("website") ?? "");
  if (website) return { error: "Invalid request." };
  if (!verifyCaptcha(
    String(formData.get("captcha") ?? ""),
    String(formData.get("captchaAnswer") ?? ""),
  )) {
    return { error: "Incorrect CAPTCHA answer. Try again." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const applicationType = String(formData.get("applicationType") ?? "").toUpperCase();
  const department = String(formData.get("department") ?? "").trim();
  const programmeCode = String(formData.get("programmeId") ?? "").trim();
  const programmeName = String(formData.get("programmeName") ?? "").trim();
  const jambNo = String(formData.get("jambNo") ?? "").trim();
  const jambScore = String(formData.get("jambScore") ?? "").trim();
  const dob = String(formData.get("dob") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const parentConsent = formData.get("parentConsent") === "on";
  const dataConsent = formData.get("dataConsent") === "on";

  const parts = fullName.split(/\s+/);
  if (parts.length < 2) return { error: "Enter your full name (first and last)." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!phone) return { error: "Enter a phone number." };
  if (!APPLICATION_TYPES.includes(applicationType)) {
    return { error: "Select an application type." };
  }
  if (!department) return { error: "Select a department." };
  if (!programmeCode) return { error: "Select a programme." };
  if (!dataConsent) {
    return { error: "Accept the data protection notice to submit." };
  }

  // Programme rows for department-derived programmes may not exist yet, so
  // upsert by the deterministic code (e.g. UG-SOCIOLOGY-BA -> "B.A. Sociology").
  const programme = await prisma.programme.upsert({
    where: { code: programmeCode },
    create: {
      code: programmeCode,
      name: programmeName || programmeCode,
      programmeType: applicationType,
      durationYears: applicationType === "PG" ? 2 : 4,
      tuitionCents: 0,
      capacity: 200,
    },
    update: {},
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "APPLICANT") {
      return { error: "This email is already registered in the portal. Please sign in instead." };
    }
    const active = await prisma.application.findFirst({
      where: { userId: existing.id, status: { in: ["DRAFT", "SUBMITTED", "SCREENING", "PENDING_CAPS"] } },
    });
    if (active) {
      return { error: "You already have an application in progress. Sign in to continue it." };
    }
  }

  const tempPassword = generateTempPassword();
  const username = email.toUpperCase(); // matches the login normalisation

  const result = await prisma.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: {
          username,
          email,
          passwordHash: await hashPassword(tempPassword),
          role: "APPLICANT",
          firstName: parts[0],
          lastName: parts.slice(1).join(" "),
          fullName,
          phone,
          jambNo: jambNo || null,
          programmeId: programme.id,
          mustChangePassword: true,
        },
      }));

    if (existing) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName,
          firstName: parts[0],
          lastName: parts.slice(1).join(" "),
          phone,
          jambNo: jambNo || user.jambNo,
          programmeId: programme.id,
        },
      });
    }

    const app = await tx.application.create({
      data: {
        userId: user.id,
        programmeId: programme.id,
        jambNo: jambNo || null,
        status: "SUBMITTED",
        nipedsStatus: "UNVERIFIED",
        parentConsent,
        submittedAt: new Date(),
        eligibility: {
          applicationType,
          jambScore: jambScore ? Number(jambScore) : null,
          dob,
          gender,
          source: "public-apply",
        },
      },
    });
    return { user, app };
  });

  await writeAudit({
    action: "SUBMIT",
    module: "ADMISSIONS",
    targetType: "APPLICATION",
    targetId: result.app.id,
    meta,
    actorUserId: result.user.id,
    actorUsername: result.user.username,
    actorRole: result.user.role,
    after: {
      programme: programme.code,
      applicationType,
      email,
      createdAccount: !existing,
    },
  });

  // Unverified accounts (fresh applicants, or returning ones who never
  // completed the email step) get a one-time verification magic link.
  const verification = result.user.emailVerifiedAt
    ? ({ verifySent: false } as const)
    : await issueEmailVerification({
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
      });

  return {
    ok: true,
    username: result.user.username,
    tempPassword: existing ? undefined : tempPassword,
    fullName,
    programme: `${programme.code} · ${programme.name}`,
    reference: result.app.id,
    verifySent: "verifySent" in verification ? verification.verifySent : verification.sent,
    verifyLink: "verifySent" in verification ? undefined : verification.link,
  };
}
