import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "./password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("UniAbuja@2026");
    expect(hash).not.toContain("UniAbuja@2026");
    expect(await verifyPassword("UniAbuja@2026", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces unique salts", async () => {
    const a = await hashPassword("UniAbuja@2026");
    const b = await hashPassword("UniAbuja@2026");
    expect(a).not.toBe(b);
  });
});

describe("password policy", () => {
  it("accepts a policy-compliant password", () => {
    const r = validatePasswordPolicy("UniAbuja@2026");
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("rejects short passwords", () => {
    const r = validatePasswordPolicy("Ab1@x");
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("At least 10 characters");
  });

  it("rejects passwords missing required character classes", () => {
    const r = validatePasswordPolicy("onlylowercaseandspaces");
    expect(r.ok).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
