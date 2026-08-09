import { createHmac, randomInt } from "node:crypto";

// Stateless arithmetic CAPTCHA. The challenge token carries an HMAC-signed
// expression; the server recomputes the signature and the expected answer on
// verification, so no per-request server state is needed.

const SECRET = process.env.CAPTCHA_SECRET ?? "dev-only-captcha-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export type CaptchaChallenge = { question: string; token: string };

export function generateCaptcha(): CaptchaChallenge {
  const a = randomInt(3, 12);
  const b = randomInt(3, 12);
  const expr = `${a}+${b}`;
  const payload = Buffer.from(JSON.stringify({ expr })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return { question: `${a} + ${b} = ?`, token };
}

export function verifyCaptcha(token: string, submitted: string): boolean {
  const [payload, sig] = String(token ?? "").split(".");
  if (!payload || !sig) return false;
  if (sign(payload) !== sig) return false;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { expr?: string };
    const parts = String(parsed.expr ?? "")
      .split("+")
      .map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return false;
    return Number(submitted) === parts[0] + parts[1];
  } catch {
    return false;
  }
}
