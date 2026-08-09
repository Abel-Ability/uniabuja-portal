import { describe, it, expect } from "vitest";
import { generateCaptcha, verifyCaptcha } from "./captcha";

describe("captcha", () => {
  it("generates a valid challenge that verifies with the correct answer", () => {
    const c = generateCaptcha();
    expect(c.question).toMatch(/^\d+ \+ \d+ = \?$/);
    const [a, b] = c.question.match(/\d+/g)!.map(Number);
    expect(verifyCaptcha(c.token, String(a + b))).toBe(true);
  });

  it("rejects a wrong answer", () => {
    const c = generateCaptcha();
    expect(verifyCaptcha(c.token, "999")).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const c = generateCaptcha();
    expect(verifyCaptcha(c.token + "x", "5")).toBe(false);
    expect(verifyCaptcha("", "5")).toBe(false);
    expect(verifyCaptcha("garbage", "5")).toBe(false);
  });
});
