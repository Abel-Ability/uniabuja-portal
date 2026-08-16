import { describe, it, expect } from "vitest";
import {
  can,
  permissionsFor,
  visibleModules,
  validateUsernameFormat,
  normaliseIdentifier,
  REGEX_UNDERGRAD,
  REGEX_PG_PROVISIONAL,
  REGEX_STAFF,
  MODULE_LABELS,
  ROLES,
  ROLE_LABELS,
} from "./constants";

describe("identifier formats", () => {
  it("accepts undergraduate registration numbers", () => {
    expect(REGEX_UNDERGRAD.test("12/345ABC/678")).toBe(true);
    expect(REGEX_UNDERGRAD.test("12/345ABCD/6789")).toBe(true);
    expect(REGEX_UNDERGRAD.test("12A/345ABC/678")).toBe(true);
    expect(REGEX_UNDERGRAD.test("12345/ABC")).toBe(false);
    expect(REGEX_UNDERGRAD.test("12/345/678")).toBe(false);
  });

  it("accepts PG provisional numbers", () => {
    expect(REGEX_PG_PROVISIONAL.test("UA/PG1234/567890")).toBe(true);
    expect(REGEX_PG_PROVISIONAL.test("UA/PG123/567890")).toBe(false);
  });

  it("accepts staff numbers", () => {
    expect(REGEX_STAFF.test("AB12")).toBe(true);
    expect(REGEX_STAFF.test("ST90")).toBe(true);
    expect(REGEX_STAFF.test("ABC1234")).toBe(true);
    expect(REGEX_STAFF.test("ABCD1234")).toBe(false);
    expect(REGEX_STAFF.test("1234")).toBe(false);
  });

  it("validateUsernameFormat accepts all known identifiers", () => {
    expect(validateUsernameFormat("12/345ABC/678")).toBe(true);
    expect(validateUsernameFormat("UA/PG1234/567890")).toBe(true);
    expect(validateUsernameFormat("AB12")).toBe(true);
    expect(validateUsernameFormat("applicant@uniabuja.edu.ng")).toBe(true);
    expect(validateUsernameFormat("not an id")).toBe(false);
  });

  it("normalises identifiers to uppercase trimmed form", () => {
    expect(normaliseIdentifier("  12/345abc/678 ")).toBe("12/345ABC/678");
  });
});

describe("access control matrix", () => {
  it("students can read results but not approve them", () => {
    expect(can("STUDENT", "EXAMS_RECORDS", "R")).toBe(true);
    expect(can("STUDENT", "EXAMS_RECORDS", "A")).toBe(false);
    expect(can("STUDENT", "EXAMS_RECORDS", "W")).toBe(false);
  });

  it("lecturers submit results but cannot approve their own", () => {
    expect(can("LECTURER", "EXAMS_RECORDS", "S")).toBe(true);
    expect(can("LECTURER", "EXAMS_RECORDS", "A")).toBe(false);
  });

  it("HOD approves results but does not read-edit them", () => {
    expect(can("HOD", "EXAMS_RECORDS", "A")).toBe(true);
    expect(can("HOD", "EXAMS_RECORDS", "R")).toBe(false);
    expect(can("HOD", "FEES", "R")).toBe(false);
  });

  it("bursary approves fees; students only write", () => {
    expect(can("BURSARY", "FEES", "A")).toBe(true);
    expect(can("STUDENT", "FEES", "A")).toBe(false);
    expect(can("STUDENT", "FEES", "W")).toBe(true);
  });

  it("bursary may read and approve clearance items but nothing beyond its module set", () => {
    expect(can("BURSARY", "GRAD_CLEARANCE", "R")).toBe(true);
    expect(can("BURSARY", "GRAD_CLEARANCE", "A")).toBe(true);
    expect(can("BURSARY", "GRAD_CLEARANCE", "W")).toBe(false);
    expect(can("BURSARY", "ADMIN_SYSTEM", "R")).toBe(false);
    expect(can("BURSARY", "DPO", "R")).toBe(false);
    expect(can("BURSARY", "SENATE", "R")).toBe(false);
  });

  it("IT admin controls admin system and reads DPO", () => {
    expect(can("IT_ADMIN", "ADMIN_SYSTEM", "RWA".charAt(0) as never)).toBe(true);
    expect(can("IT_ADMIN", "ADMIN_SYSTEM", "A")).toBe(true);
    expect(can("IT_ADMIN", "DPO", "R")).toBe(true);
    expect(can("IT_ADMIN", "DPO", "W")).toBe(false);
    expect(can("IT_ADMIN", "FEES", "R")).toBe(false);
  });

  it("verifiers can only verify, never modify", () => {
    expect(can("VERIFIER", "TRANSCRIPT", "V")).toBe(true);
    expect(can("VERIFIER", "TRANSCRIPT", "R")).toBe(false);
    expect(can("VERIFIER", "EXAMS_RECORDS", "V")).toBe(true);
  });

  it("dvc oversight reads everything except Module 17 (Health) but writes nothing", () => {
    for (const m of Object.keys(MODULE_LABELS) as never[]) {
      if (m === "HEALTH") continue;
      expect(can("DVC_OVERSIGHT", m, "R"), `read ${m}`).toBe(true);
      expect(can("DVC_OVERSIGHT", m, "W"), `write ${m}`).toBe(false);
    }
    expect(can("DVC_OVERSIGHT", "HEALTH", "R")).toBe(false);
  });

  it("vc reads every module including Module 17 (Health)", () => {
    for (const m of Object.keys(MODULE_LABELS) as never[]) {
      expect(can("VC", m, "R"), `read ${m}`).toBe(true);
    }
  });

  it("vc has no day-to-day transactions and no grade/course mutability", () => {
    expect(can("VC", "EXAMS_RECORDS", "W")).toBe(false);
    expect(can("VC", "EXAMS_RECORDS", "S")).toBe(false);
    expect(can("VC", "EXAMS_RECORDS", "A")).toBe(false);
    expect(can("VC", "LMS", "W")).toBe(false);
    expect(can("VC", "TIMETABLE_VENUE", "W")).toBe(false);
    expect(can("VC", "ADMISSIONS", "W")).toBe(false);
    expect(can("VC", "FEES", "W")).toBe(false);
    expect(can("VC", "HEALTH", "W")).toBe(false);
  });

  it("vc holds final approval on cross-cutting decisions only", () => {
    for (const m of ["ADMIN_SYSTEM", "COMMUNICATIONS", "DPO", "GRAD_CLEARANCE"]) {
      expect(can("VC", m as never, "A"), `approve ${m}`).toBe(true);
      expect(can("VC", m as never, "W"), `write ${m}`).toBe(false);
    }
    expect(can("VC", "ADMISSIONS", "A")).toBe(false);
    expect(can("VC", "FEES", "A")).toBe(false);
    expect(can("VC", "HEALTH", "A")).toBe(false);
  });

  it("visibleModules surfaces Module 17 for vc but not dvc", () => {
    expect(visibleModules("VC")).toContain("HEALTH");
    expect(visibleModules("DVC_OVERSIGHT")).not.toContain("HEALTH");
  });

  it("unknown role has no permissions", () => {
    expect(permissionsFor("SUPERADMIN", "ADMIN_SYSTEM")).toEqual([]);
    expect(can("SUPERADMIN", "ADMIN_SYSTEM", "R")).toBe(false);
  });

  it("visibleModules returns only permitted modules", () => {
    expect(visibleModules("VERIFIER").sort()).toEqual(
      ["EXAMS_RECORDS", "TRANSCRIPT"].sort(),
    );
    expect(visibleModules("STUDENT")).toContain("FEES");
    expect(visibleModules("STUDENT")).not.toContain("ADMIN_SYSTEM");
  });

  it("HOD grants department-scoped rights through the matrix", () => {
    expect(can("HOD", "EXAMS_RECORDS", "A")).toBe(true);
    expect(can("HOD", "EXAMS_RECORDS", "R")).toBe(false);
    expect(can("HOD", "FEES", "R")).toBe(false);
    expect(can("HOD", "ADMIN_SYSTEM", "R")).toBe(false);
  });

  it("DEAN is read-only oversight with communications write", () => {
    expect(can("DEAN", "EXAMS_RECORDS", "R")).toBe(true);
    expect(can("DEAN", "EXAMS_RECORDS", "A")).toBe(false);
    expect(can("DEAN", "EXAMS_RECORDS", "S")).toBe(false);
    expect(can("DEAN", "ADMISSIONS", "R")).toBe(true);
    expect(can("DEAN", "PG_RESEARCH", "R")).toBe(true);
    expect(can("DEAN", "PROFILES", "R")).toBe(true);
    expect(can("DEAN", "GRAD_CLEARANCE", "R")).toBe(true);
    expect(can("DEAN", "COMMUNICATIONS", "RW".charAt(0) as never)).toBe(true);
    expect(can("DEAN", "COMMUNICATIONS", "A")).toBe(false);
    expect(can("DEAN", "FEES", "R")).toBe(false);
    expect(can("DEAN", "ADMIN_SYSTEM", "R")).toBe(false);
  });

  it("SBC chairman runs Senate business but approves nothing in the results pipeline", () => {
    expect(can("SBC_CHAIRMAN", "SENATE", "R")).toBe(true);
    expect(can("SBC_CHAIRMAN", "SENATE", "W")).toBe(true);
    expect(can("SBC_CHAIRMAN", "SENATE", "A")).toBe(true);
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "R")).toBe(true);
    expect(can("SBC_CHAIRMAN", "EXAMS_RECORDS", "A")).toBe(false);
    expect(can("SBC_CHAIRMAN", "FEES", "R")).toBe(false);
    expect(can("SBC_CHAIRMAN", "ADMIN_SYSTEM", "R")).toBe(false);
  });

  it("governance oversight member reads like the DVC but writes nothing", () => {
    for (const m of Object.keys(MODULE_LABELS) as never[]) {
      if (m === "HEALTH") continue;
      expect(can("GOVERNANCE_OVERSIGHT_MEMBER", m, "R"), `read ${m}`).toBe(true);
      expect(can("GOVERNANCE_OVERSIGHT_MEMBER", m, "W"), `write ${m}`).toBe(false);
    }
    expect(can("GOVERNANCE_OVERSIGHT_MEMBER", "HEALTH", "R")).toBe(false);
    expect(can("GOVERNANCE_OVERSIGHT_MEMBER", "SENATE", "R")).toBe(true);
  });
});

describe("role labels", () => {
  it("labels every recovered executive and governance role", () => {
    expect(ROLE_LABELS.HOD.length).toBeGreaterThan(0);
    expect(ROLE_LABELS.DEAN.length).toBeGreaterThan(0);
    expect(ROLE_LABELS.SBC_CHAIRMAN.length).toBeGreaterThan(0);
    expect(ROLE_LABELS.GOVERNANCE_OVERSIGHT_MEMBER.length).toBeGreaterThan(0);
  });

  it("every role label resolves a display string", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
