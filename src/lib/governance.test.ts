import { describe, it, expect } from "vitest";
import {
  membershipIsActive,
  isGovernanceRole,
  membershipDesignationLabel,
  GOVERNANCE_COMMITTEE,
  governanceCsv,
  GOVERNANCE_REPORTS,
  EXCEPTION_SEVERITY_RANK,
  EXCEPTION_SEVERITY_LABELS,
  RESULT_STAGE_ORDER,
  type GovernanceReportColumn,
} from "./governance";
import { MEMBERSHIP_STATUSES } from "./constants";

const ACTIVE = MEMBERSHIP_STATUSES.ACTIVE;

describe("committee membership helpers", () => {
  it("treats an active, unexpired membership as granting access", () => {
    expect(membershipIsActive({ status: ACTIVE, endDate: null })).toBe(true);
    expect(membershipIsActive({ status: ACTIVE, endDate: new Date("2030-01-01") })).toBe(true);
  });

  it("denies missing, inactive or expired memberships", () => {
    expect(membershipIsActive(null)).toBe(false);
    expect(membershipIsActive(undefined)).toBe(false);
    expect(membershipIsActive({ status: "INACTIVE", endDate: null })).toBe(false);
    const now = new Date("2026-08-13T12:00:00Z");
    expect(
      membershipIsActive({ status: ACTIVE, endDate: new Date("2026-01-01") }, now),
    ).toBe(false);
  });

  it("recognises the two governance roles", () => {
    expect(isGovernanceRole("GOVERNANCE_OVERSIGHT_MEMBER")).toBe(true);
    expect(isGovernanceRole("DVC_OVERSIGHT")).toBe(true);
    expect(isGovernanceRole("HOD")).toBe(false);
    expect(isGovernanceRole("STUDENT")).toBe(false);
  });

  it("labels the chairman and ordinary member identically apart from the designation", () => {
    const committee = "Governance & Oversight Committee";
    expect(membershipDesignationLabel("CHAIRMAN")).toBe(`Chairman — ${committee}`);
    expect(membershipDesignationLabel("MEMBER")).toBe(`Member — ${committee}`);
    expect(membershipDesignationLabel(undefined)).toBeUndefined();
    expect(membershipDesignationLabel("VISITOR")).toBeUndefined();
  });

  it("exposes the governance committee constant", () => {
    expect(GOVERNANCE_COMMITTEE).toBe("GOVERNANCE_OVERSIGHT");
  });
});

describe("exception severity ordering", () => {
  it("ranks critical above high above moderate above low", () => {
    expect(EXCEPTION_SEVERITY_RANK.CRITICAL).toBeGreaterThan(EXCEPTION_SEVERITY_RANK.HIGH);
    expect(EXCEPTION_SEVERITY_RANK.HIGH).toBeGreaterThan(EXCEPTION_SEVERITY_RANK.MODERATE);
    expect(EXCEPTION_SEVERITY_RANK.MODERATE).toBeGreaterThan(EXCEPTION_SEVERITY_RANK.LOW);
  });

  it("labels every severity level", () => {
    for (const severity of ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const) {
      expect(EXCEPTION_SEVERITY_LABELS[severity].length).toBeGreaterThan(0);
    }
  });
});

describe("result pipeline stage order", () => {
  it("follows the real approval pipeline without a Dean stage", () => {
    expect(RESULT_STAGE_ORDER).toEqual([
      "SUBMITTED",
      "HOD_APPROVED",
      "SENATE_APPROVED",
      "FINAL",
    ]);
    expect(RESULT_STAGE_ORDER).not.toContain("DEAN_APPROVED");
  });
});

describe("report catalogue", () => {
  it("lists twelve unique reports covering the committee's remit", () => {
    expect(GOVERNANCE_REPORTS).toHaveLength(12);
    const slugs = GOVERNANCE_REPORTS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const expected of [
      "students-register",
      "staff-register",
      "results-pipeline",
      "course-allocation",
      "level-coordination",
      "admissions-pipeline",
      "clearance-progress",
      "postgraduate-overview",
      "faculty-comparison",
      "department-comparison",
      "exceptions-register",
      "audit-trail",
    ]) {
      expect(slugs).toContain(expected);
    }
  });

  it("has a title, description and category on every report", () => {
    for (const r of GOVERNANCE_REPORTS) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.category.length).toBeGreaterThan(0);
    }
  });
});

describe("governanceCsv", () => {
  const columns: GovernanceReportColumn[] = [
    { header: "Registration No", key: "reg" },
    { header: "Full Name", key: "name" },
    { header: "Note", key: "note" },
  ];
  const empty: Record<string, unknown>[] = [];

  it("emits a header row even with no data rows", () => {
    expect(governanceCsv(columns, empty)).toBe("Registration No,Full Name,Note");
  });

  it("joins cells and rows with commas and newlines", () => {
    const csv = governanceCsv(columns, [{ reg: "12/345ABC/678", name: "Ada Obi", note: null }]);
    expect(csv).toBe('Registration No,Full Name,Note\n12/345ABC/678,Ada Obi,');
  });

  it("quotes cells that contain commas, quotes or newlines and escapes embedded quotes", () => {
    const csv = governanceCsv(columns, [
      { reg: "A,1", name: 'Dr "Nana" Okafor', note: "line1\nline2" },
    ]);
    expect(csv).toBe(
      'Registration No,Full Name,Note\n"A,1","Dr ""Nana"" Okafor","line1\nline2"',
    );
  });
});
