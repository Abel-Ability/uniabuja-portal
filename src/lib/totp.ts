import { createHmac, randomBytes } from "node:crypto";

// Minimal RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) for the demo MFA flow.
// Secrets are stored base32-encoded on the User row and verified at login
// and during step-up prompts.

const STEP_SECONDS = 30;
const CODE_LENGTH = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: bigint): string {
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(counter & BigInt(0xff));
    counter >>= BigInt(8);
  }
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
  return String(code % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, "0");
}

export function generateMfaSecret(): { base32: string } {
  return { base32: base32Encode(randomBytes(20)) };
}

export function currentTotp(secretB32: string): string {
  const counter = BigInt(Math.floor(Date.now() / 1000 / STEP_SECONDS));
  return hotp(base32Decode(secretB32), counter);
}

export function verifyTotp(secretB32: string, code: string): boolean {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = BigInt(Math.floor(Date.now() / 1000 / STEP_SECONDS));
  for (let w = -1; w <= 1; w++) {
    if (hotp(base32Decode(secretB32), counter + BigInt(w)) === clean) return true;
  }
  return false;
}
