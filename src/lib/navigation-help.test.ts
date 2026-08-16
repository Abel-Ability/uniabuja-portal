import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROLES,
  ROLE_LABELS,
  landingForRole,
  resultsForRole,
  getMenuForRole,
  dashboardForRole,
  visibleModules,
  PORTAL_MODULES,
  SBC_MENU,
  DVC_GOVERNANCE_MENU,
  STUDENT_MENU,
  LECTURER_MENU,
  VC_MENU,
} from "@/lib/constants";
import {
  helpForRole,
  helpSectionsForRole,
  helpSectionForPath,
} from "@/lib/help";

const PORTAL_ROOT = resolve(__dirname, "../app/portal");

function routeExists(href: string): boolean {
  if (href === "/portal") return false;
  const rel = href.replace(/^\/portal\//, "");
  return existsSync(resolve(PORTAL_ROOT, rel, "page.tsx"));
}

describe("post-login landing routing", () => {
  it("lands every role on its own workspace", () => {
    const expected: Record<string, string> = {
      APPLICANT: "/portal/applications",
      STUDENT: "/portal/student",
      LECTURER: "/portal/lecturer",
      HOD: "/portal/hod",
      DEAN: "/portal/dean",
      REGISTRY: "/portal/admin",
      BURSARY: "/portal/bursary",
      STUDENT_AFFAIRS: "/portal/hostels",
      EXAMS_RECORDS: "/portal/results",
      PG_SCHOOL: "/portal/postgraduate",
      SIWES: "/portal/siwes",
      TIMETABLE: "/portal/timetabling",
      IT_ADMIN: "/portal/admin",
      DVC_OVERSIGHT: "/portal/dvc",
      GOVERNANCE_OVERSIGHT_MEMBER: "/portal/dvc",
      VC: "/portal/vc",
      SBC_CHAIRMAN: "/portal/sbc",
      VERIFIER: "/portal/results",
    };
    for (const role of ROLES) {
      const href = landingForRole(role);
      expect(href, `landingForRole(${role})`).toBe(expected[role]);
      expect(routeExists(href), `route exists for ${role} landing ${href}`).toBe(true);
    }
  });

  it("falls back to the portal dashboard for unknown roles", () => {
    expect(landingForRole("SOME_UNKNOWN_ROLE")).toBe("/portal/dashboard");
  });
});

describe("results routing", () => {
  it("maps each role to its dedicated results surface", () => {
    const expected: Record<string, string> = {
      HOD: "/portal/hod/approvals",
      DEAN: "/portal/dean/results",
      SBC_CHAIRMAN: "/portal/sbc/results",
      DVC_OVERSIGHT: "/portal/dvc/academic",
      GOVERNANCE_OVERSIGHT_MEMBER: "/portal/dvc/academic",
      VC: "/portal/vc/results",
    };
    for (const [role, href] of Object.entries(expected)) {
      expect(resultsForRole(role), `resultsForRole(${role})`).toBe(href);
      expect(routeExists(href), `route exists for ${role} results ${href}`).toBe(true);
    }
  });

  it("returns null for roles served by the shared /portal/results page", () => {
    for (const role of ["STUDENT", "LECTURER", "EXAMS_RECORDS", "VERIFIER", "REGISTRY"]) {
      expect(resultsForRole(role), `resultsForRole(${role})`).toBeNull();
    }
  });
});

const CROSS_CUTTING_KEYS = ["ADMIN_SYSTEM", "DPO", "COMMUNICATIONS", "HELPDESK"] as const;

describe("workspace menus", () => {
  it("gives every role a non-empty sidebar", () => {
    for (const role of ROLES) {
      const menu = getMenuForRole(role);
      const modules = visibleModules(role);
      const total =
        menu.length +
        PORTAL_MODULES.filter((m) => modules.includes(m.key)).length +
        CROSS_CUTTING_KEYS.filter((k) => modules.includes(k as never)).length;
      expect(total, `sidebar size for ${role}`).toBeGreaterThan(0);
    }
  });

  it("dedicates SBC, DVC/GOV, STUDENT and LECTURER menus", () => {
    expect(getMenuForRole("SBC_CHAIRMAN")).toBe(SBC_MENU);
    expect(getMenuForRole("DVC_OVERSIGHT")).toBe(DVC_GOVERNANCE_MENU);
    expect(getMenuForRole("GOVERNANCE_OVERSIGHT_MEMBER")).toBe(DVC_GOVERNANCE_MENU);
    expect(getMenuForRole("STUDENT")).toBe(STUDENT_MENU);
    expect(getMenuForRole("LECTURER")).toBe(LECTURER_MENU);
  });

  it("has no duplicate hrefs within any menu", () => {
    for (const role of ROLES) {
      const menu = getMenuForRole(role);
      const hrefs = menu.map((m) => m.href);
      expect(new Set(hrefs).size, `duplicate hrefs in ${role} menu`).toBe(hrefs.length);
    }
  });

  it("points every menu entry at an existing route", () => {
    for (const role of ROLES) {
      for (const item of getMenuForRole(role)) {
        expect(routeExists(item.href), `${role} menu entry ${item.href}`).toBe(true);
      }
    }
  });

  it("removed the dead VC menu links", () => {
    const vcHrefs = VC_MENU.map((m) => m.href);
    expect(vcHrefs).not.toContain("/portal/students");
    expect(vcHrefs).not.toContain("/portal/admin");
  });

  it("matches the dashboard entry to the menu start so the shell de-duplicates it", () => {
    for (const role of ROLES) {
      const dash = dashboardForRole(role);
      if (!dash) continue;
      const menu = getMenuForRole(role);
      expect(menu[0]?.href, `dashboard match for ${role}`).toBe(dash.href);
    }
  });
});

describe("account-specific help", () => {
  it("covers every role in the system", () => {
    for (const role of ROLES) {
      const content = helpForRole(role);
      expect(content.description, `${role} description`).toBeTruthy();
      expect(content.workspace, `${role} workspace`).toBeTruthy();
      expect(content.sections.length + content.canDo.length, `${role} sections/canDo`).toBeGreaterThan(0);
      expect(content.faqs.length, `${role} faqs`).toBeGreaterThan(0);
    }
  });

  it("never exposes another role's capabilities", () => {
    const student = helpForRole("STUDENT");
    expect(student.cannotDo.join(" ").toLowerCase()).toContain("approve");
    expect(helpSectionsForRole("STUDENT").some((s) => s.href.startsWith("/portal/hod"))).toBe(false);
    const hod = helpForRole("HOD");
    expect(hod.cannotDo.join(" ").toLowerCase()).toContain("finalise");
    expect(helpSectionsForRole("HOD").some((s) => s.href.startsWith("/portal/student"))).toBe(false);
  });

  it("shows sections that mirror the sidebar", () => {
    for (const role of ROLES) {
      const curated = getMenuForRole(role);
      const sections = helpSectionsForRole(role);
      if (curated.length > 0) {
        expect(sections.map((s) => s.href), `${role} sections vs menu`).toEqual(
          curated.map((m) => m.href),
        );
      } else {
        const keys = visibleModules(role);
        const moduleHrefs = PORTAL_MODULES.filter((m) => keys.includes(m.key)).map(
          (m) => `/portal/${m.slug}`,
        );
        expect(sections.map((s) => s.href), `${role} generic sections`).toEqual(moduleHrefs);
      }
      for (const s of sections) {
        expect(routeExists(s.href), `${role} help section route ${s.href}`).toBe(true);
      }
    }
  });

  it("resolves context-aware help only within the user's own role", () => {
    const student = helpSectionForPath("STUDENT", "/portal/student/course-registration");
    expect(student?.href).toBe("/portal/student/course-registration");
    expect(helpSectionForPath("STUDENT", "/portal/hod/approvals")).toBeUndefined();
    const hod = helpSectionForPath("HOD", "/portal/hod/approvals");
    expect(hod?.href).toBe("/portal/hod/approvals");
  });

  it("gives unknown roles a generic but accurate fallback", () => {
    const content = helpForRole("NOT_A_ROLE");
    expect(content.workspace).toContain("NOT_A_ROLE");
    expect(content.faqs.length).toBeGreaterThan(0);
  });
});

describe("role labels completeness", () => {
  it("labels all roles referenced in the system", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], `label for ${role}`).toBeTruthy();
    }
  });
});
