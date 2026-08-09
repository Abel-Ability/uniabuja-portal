import { describe, it, expect } from "vitest";
import {
  computeGrade,
  gradePoint,
  computeCGPA,
  awardClass,
  formatMoney,
  formatDate,
  initials,
} from "./utils";

describe("grades", () => {
  it("maps totals to NUC grades", () => {
    expect(computeGrade(70)).toBe("A");
    expect(computeGrade(69)).toBe("B");
    expect(computeGrade(50)).toBe("C");
    expect(computeGrade(45)).toBe("D");
    expect(computeGrade(40)).toBe("E");
    expect(computeGrade(39)).toBe("F");
  });

  it("maps grades to points", () => {
    expect(gradePoint("A")).toBe(5);
    expect(gradePoint("F")).toBe(0);
  });

  it("computes weighted CGPA", () => {
    const results = [
      { units: 3, grade: "A" }, // 15
      { units: 2, grade: "B" }, // 8
    ];
    expect(computeCGPA(results)).toBeCloseTo(23 / 5, 5);
    expect(computeCGPA([])).toBe(0);
  });

  it("derives award classes", () => {
    expect(awardClass(4.6)).toBe("First Class");
    expect(awardClass(4.0)).toBe("Second Class Upper");
    expect(awardClass(3.0)).toBe("Second Class Lower");
    expect(awardClass(2.0)).toBe("Third Class");
    expect(awardClass(1.2)).toBe("Pass");
  });
});

describe("formatting", () => {
  it("formats naira amounts from cents", () => {
    expect(formatMoney(10000000)).toContain("100,000");
    expect(formatMoney(0)).toContain("0");
  });

  it("formats dates safely", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(new Date("2026-08-01"))).toContain("Aug");
  });

  it("builds initials", () => {
    expect(initials("Amina Yusuf")).toBe("AY");
    expect(initials("Dr. Grace Adamu")).toBe("DG");
    expect(initials("  ")).toBe("");
  });
});
