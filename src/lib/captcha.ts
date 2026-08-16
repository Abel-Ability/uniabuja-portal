import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Stateless arithmetic CAPTCHA. The challenge token carries an HMAC-signed
// expression plus an expiry timestamp; the server recomputes the signature and
// the expected answer on verification, so no per-request server state is
// needed. The TTL bounds replay: a solved token stops verifying once expired.

const SECRET = process.env.CAPTCHA_SECRET ?? "dev-only-captcha-secret";
const TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function signaturesMatch(expected: string, submitted: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CaptchaChallenge = { question: string; token: string };

export function generateCaptcha(): CaptchaChallenge {
  const a = randomInt(3, 12);
  const b = randomInt(3, 12);
  const expr = `${a}+${b}`;
  const payload = Buffer.from(
    JSON.stringify({ expr, exp: Date.now() + TTL_MS }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return { question: `${a} + ${b} = ?`, token };
}

export function verifyCaptcha(token: string, submitted: string): boolean {
  const [payload, sig] = String(token ?? "").split(".");
  if (!payload || !sig) return false;
  if (!signaturesMatch(sign(payload), sig)) return false;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { expr?: string; exp?: unknown };
    // Only plain decimal integers are accepted; Number() would otherwise
    // happily parse forms like "0x6" or "1e1" as the answer.
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return false;
    if (!/^\d+$/.test(submitted.trim())) return false;
    const parts = String(parsed.expr ?? "")
      .split("+")
      .map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return false;
    return Number(submitted) === parts[0] + parts[1];
  } catch {
    return false;
  }
}
