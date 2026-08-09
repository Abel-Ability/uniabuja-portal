import bcrypt from "bcryptjs";
import {
  PASSWORD_POLICY,
} from "./constants";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Password complexity rules from the Security & Compliance Checklist.
export function validatePasswordPolicy(plain: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (plain.length < PASSWORD_POLICY.minLength) {
    reasons.push(`At least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (PASSWORD_POLICY.requiresUpper && !/[A-Z]/.test(plain)) {
    reasons.push("At least one uppercase letter");
  }
  if (PASSWORD_POLICY.requiresLower && !/[a-z]/.test(plain)) {
    reasons.push("At least one lowercase letter");
  }
  if (PASSWORD_POLICY.requiresDigit && !/\d/.test(plain)) {
    reasons.push("At least one number");
  }
  if (PASSWORD_POLICY.requiresSpecial && !/[^A-Za-z0-9]/.test(plain)) {
    reasons.push("At least one special character");
  }
  return { ok: reasons.length === 0, reasons };
}
