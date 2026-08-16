import { describe, it, expect } from "vitest";
import { HOD_ROLES, isHodRole } from "./hod";

describe("HOD role helpers", () => {
  it("lists the HOD role", () => {
    expect(HOD_ROLES).toEqual(["HOD"]);
  });

  it("isHodRole is true for HOD", () => {
    expect(isHodRole("HOD")).toBe(true);
  });

  it("isHodRole is false for every other role", () => {
    for (const role of [
      "APPLICANT",
      "STUDENT",
      "LECTURER",
      "DEAN",
      "REGISTRY",
      "BURSARY",
      "STUDENT_AFFAIRS",
      "EXAMS_RECORDS",
      "PG_SCHOOL",
      "SIWES",
      "TIMETABLE",
      "IT_ADMIN",
      "DVC_OVERSIGHT",
      "VC",
      "VERIFIER",
      "SBC_CHAIRMAN",
      "GOVERNANCE_OVERSIGHT_MEMBER",
      "SUPERADMIN",
    ]) {
      expect(isHodRole(role), role).toBe(false);
    }
  });
});
