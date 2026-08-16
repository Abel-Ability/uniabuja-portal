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
  permissionsFor,
  can,
  PORTAL_MODULES,
  CROSS_CUTTING_MODULES,
  SBC_MENU,
  DVC_GOVERNANCE_MENU,
  STUDENT_MENU,
  LECTURER_MENU,
  VC_MENU,
} from "@/lib/constants";
import {
  ROLE_HELP,
  helpForRole,
  helpSectionsForRole,
  helpSectionForPath,
  helpDashboardForRole,
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
      REGISTRY: "/portal/applications",
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

  it("gives the /portal root a redirect page instead of a dead 404 route", () => {
    expect(existsSync(resolve(PORTAL_ROOT, "page.tsx"))).toBe(true);
    for (const role of ROLES) {
      expect(landingForRole(role), `${role} landing from /portal`).toMatch(/^\/portal\//);
    }
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

const CROSS_CUTTING_KEYS = Object.keys(CROSS_CUTTING_MODULES);

// The generic sidebar = PORTAL_MODULES filtered by the matrix, then
// CROSS_CUTTING_MODULES filtered by the matrix (see src/app/portal/layout.tsx).
function genericSidebarHrefs(role: string): string[] {
  const keys = visibleModules(role);
  return [
    ...PORTAL_MODULES.filter((m) => keys.includes(m.key)).map((m) => `/portal/${m.slug}`),
    ...CROSS_CUTTING_KEYS.filter((k) => keys.includes(k as never)).map(
      (k) => CROSS_CUTTING_MODULES[k as keyof typeof CROSS_CUTTING_MODULES]!.href,
    ),
  ];
}

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
        expect(sections.map((s) => s.href), `${role} generic sections`).toEqual(
          genericSidebarHrefs(role),
        );
      }
      for (const s of sections) {
        expect(routeExists(s.href), `${role} help section route ${s.href}`).toBe(true);
      }
    }
  });

  it("shows cross-cutting help sections for generic roles that can see them", () => {
    for (const role of ROLES) {
      if (getMenuForRole(role).length > 0) continue;
      const sections = helpSectionsForRole(role);
      const keys = visibleModules(role);
      for (const k of CROSS_CUTTING_KEYS) {
        const m = CROSS_CUTTING_MODULES[k as keyof typeof CROSS_CUTTING_MODULES]!;
        if (keys.includes(k as never)) {
          expect(
            sections.some((s) => s.href === m.href),
            `${role} help should include cross-cutting module ${m.href}`,
          ).toBe(true);
        } else {
          expect(
            sections.some((s) => s.href === m.href),
            `${role} help must not expose ${m.href}`,
          ).toBe(false);
        }
      }
    }
  });

  it("keeps IT_ADMIN help aligned with its sidebar (admin + dpo only)", () => {
    const hrefs = helpSectionsForRole("IT_ADMIN").map((s) => s.href);
    expect(hrefs).toEqual(["/portal/admin", "/portal/dpo"]);
    expect(hrefs).not.toContain("/portal/communications");
    expect(hrefs).not.toContain("/portal/helpdesk");
    expect(hrefs).not.toContain("/portal/library");
  });

  it("keeps REGISTRY help aligned with its sidebar (library, communications, helpdesk)", () => {
    const hrefs = helpSectionsForRole("REGISTRY").map((s) => s.href);
    expect(hrefs).toContain("/portal/applications");
    expect(hrefs).toContain("/portal/library");
    expect(hrefs).toContain("/portal/communications");
    expect(hrefs).toContain("/portal/helpdesk");
    expect(hrefs).not.toContain("/portal/admin");
    expect(hrefs).not.toContain("/portal/dpo");
  });

  it("lists help sections in the same order as the sidebar", () => {
    for (const role of ROLES) {
      const curated = getMenuForRole(role);
      const expected =
        curated.length > 0 ? curated.map((m) => m.href) : genericSidebarHrefs(role);
      expect(
        helpSectionsForRole(role).map((s) => s.href),
        `help section order for ${role}`,
      ).toEqual(expected);
    }
  });

  it("has no duplicate help section hrefs for any role", () => {
    for (const role of ROLES) {
      const hrefs = helpSectionsForRole(role).map((s) => s.href);
      expect(new Set(hrefs).size, `duplicate help hrefs for ${role}`).toBe(hrefs.length);
    }
  });

  it("keeps VERIFIER help to its read-only verification scope", () => {
    const content = helpForRole("VERIFIER");
    const hrefs = helpSectionsForRole("VERIFIER").map((s) => s.href);
    expect(hrefs).toEqual(["/portal/results", "/portal/transcripts"]);
    expect(content.cannotDo.join(" ").toLowerCase()).toContain("modify");
    expect(content.cannotDo.join(" ").toLowerCase()).toContain("financial");
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

// --- Remaining role workspace navigation recovery (Phase 12) ----------------

const GENERIC_ROLES = ROLES.filter((r) => getMenuForRole(r).length === 0);

// href -> ModuleKey for every generic sidebar link.
const MODULE_HREF_TO_KEY: Record<string, string> = {
  ...Object.fromEntries(PORTAL_MODULES.map((m) => [`/portal/${m.slug}`, m.key])),
  ...Object.fromEntries(
    Object.entries(CROSS_CUTTING_MODULES).map(([k, v]) => [v!.href, k as string]),
  ),
};

const WORKSPACE_PREFIX: Record<string, string> = {
  HOD: "/portal/hod",
  DEAN: "/portal/dean",
  VC: "/portal/vc",
  BURSARY: "/portal/bursary",
  STUDENT: "/portal/student",
  LECTURER: "/portal/lecturer",
  SBC_CHAIRMAN: "/portal/sbc",
  DVC_OVERSIGHT: "/portal/dvc",
  GOVERNANCE_OVERSIGHT_MEMBER: "/portal/dvc",
};

// The shared /portal/results page renders a read-only view for roles with
// EXAMS_RECORDS read access; roles with a dedicated results surface are routed
// to it instead (see src/app/portal/results/page.tsx).
const SHARED_RESULTS_ROLES = ["REGISTRY", "PG_SCHOOL", "TIMETABLE", "BURSARY", "STUDENT_AFFAIRS"];

describe("remaining role workspace navigation recovery", () => {
  it("keeps the nine dedicated workspace menus untouched", () => {
    const dedicated = ROLES.filter((r) => getMenuForRole(r).length > 0);
    expect(dedicated.sort()).toEqual(
      ["HOD", "DEAN", "VC", "BURSARY", "STUDENT", "LECTURER", "SBC_CHAIRMAN", "DVC_OVERSIGHT", "GOVERNANCE_OVERSIGHT_MEMBER"].sort(),
    );
  });

  it("lands every generic-fallback role on a sidebar link it can access", () => {
    for (const role of GENERIC_ROLES) {
      const landing = landingForRole(role);
      expect(genericSidebarHrefs(role), `${role} landing ${landing}`).toContain(landing);
    }
  });

  it("never lands a role on the system admin console without ADMIN_SYSTEM access", () => {
    for (const role of ROLES) {
      if (landingForRole(role) === "/portal/admin") {
        expect(can(role, "ADMIN_SYSTEM", "R"), role).toBe(true);
      }
    }
  });

  it("lands REGISTRY on its admissions console, not the admin console", () => {
    expect(landingForRole("REGISTRY")).toBe("/portal/applications");
    expect(can("REGISTRY", "ADMISSIONS", "R")).toBe(true);
  });

  it("dedicated menus only link to the role's own workspace or modules it can access", () => {
    for (const role of ROLES) {
      const menu = getMenuForRole(role);
      if (menu.length === 0) continue;
      const prefix = WORKSPACE_PREFIX[role];
      for (const item of menu) {
        if (prefix && item.href.startsWith(prefix)) continue;
        if (role === "VC" && item.href === "/portal/appointments") continue;
        const key = MODULE_HREF_TO_KEY[item.href];
        expect(key, `${role} href ${item.href} maps to a module`).toBeTruthy();
        expect(
          permissionsFor(role, key as never).length,
          `${role} access to ${item.href}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every generic sidebar link on a module the role can access", () => {
    for (const role of GENERIC_ROLES) {
      for (const href of genericSidebarHrefs(role)) {
        const key = MODULE_HREF_TO_KEY[href];
        expect(key, `${role} generic link ${href}`).toBeTruthy();
        expect(permissionsFor(role, key as never).length, `${role} link ${href}`).toBeGreaterThan(0);
      }
    }
  });

  it("routes EXAMS_RECORDS read-only roles to the shared results page", () => {
    for (const role of SHARED_RESULTS_ROLES) {
      expect(resultsForRole(role), `resultsForRole(${role})`).toBeNull();
      expect(can(role, "EXAMS_RECORDS", "R"), `${role} read access`).toBe(true);
    }
  });

  it("grants applicants the self-service fee surface they are linked to", () => {
    expect(genericSidebarHrefs("APPLICANT")).toContain("/portal/fees");
    expect(can("APPLICANT", "FEES", "W")).toBe(true);
    expect(genericSidebarHrefs("APPLICANT")).toContain("/portal/postgraduate");
    expect(can("APPLICANT", "PG_RESEARCH", "R")).toBe(true);
  });
});

// --- Role-specific account help: global coverage and verification ------------

describe("account-specific help global coverage", () => {
  it("provides curated help content for every authenticated role", () => {
    expect(Object.keys(ROLE_HELP).sort(), "ROLE_HELP keys match ROLES").toEqual([...ROLES].sort());
    for (const role of ROLES) {
      expect(helpForRole(role), `${role} must use curated content, not the fallback`).toBe(
        ROLE_HELP[role],
      );
    }
  });

  it("gives each named workspace its own help content", () => {
    expect(helpForRole("HOD")).not.toBe(helpForRole("DEAN"));
    expect(helpForRole("HOD")).not.toBe(helpForRole("STUDENT"));
    expect(helpForRole("VC")).not.toBe(helpForRole("BURSARY"));
    expect(helpForRole("VC")).not.toBe(helpForRole("SBC_CHAIRMAN"));
    expect(helpForRole("LECTURER")).not.toBe(helpForRole("STUDENT"));
    // DVC and Governance share an identical, read-only workspace by design, so
    // they intentionally share the same help content object.
    expect(helpForRole("DVC_OVERSIGHT")).toBe(helpForRole("GOVERNANCE_OVERSIGHT_MEMBER"));
  });

  it("keeps HOD, DEAN, VC, BURSARY, LECTURER, STUDENT, DVC, GOVERNANCE and SBC help inside their own workspace", () => {
    const expectations: Record<string, { prefix: string; can: string; cannot: string }> = {
      HOD: { prefix: "/portal/hod", can: "allocate", cannot: "finalise" },
      DEAN: { prefix: "/portal/dean", can: "faculty", cannot: "finalise" },
      VC: { prefix: "/portal/vc", can: "university-wide", cannot: "modify" },
      BURSARY: { prefix: "/portal/bursary", can: "invoices", cannot: "results" },
      LECTURER: { prefix: "/portal/lecturer", can: "allocated", cannot: "approve" },
      STUDENT: { prefix: "/portal/student", can: "register", cannot: "approve" },
      DVC_OVERSIGHT: { prefix: "/portal/dvc", can: "monitor", cannot: "modify" },
      GOVERNANCE_OVERSIGHT_MEMBER: { prefix: "/portal/dvc", can: "monitor", cannot: "modify" },
      SBC_CHAIRMAN: { prefix: "/portal/sbc", can: "senate", cannot: "approve" },
    };
    for (const [role, exp] of Object.entries(expectations)) {
      const sectionHrefs = helpSectionsForRole(role).map((s) => s.href);
      expect(sectionHrefs.length, `${role} sections`).toBeGreaterThan(0);
      expect(
        sectionHrefs.some((h) => h.startsWith(exp.prefix)),
        `${role} must link into its own workspace`,
      ).toBe(true);
      for (const href of sectionHrefs) {
        for (const other of Object.values(WORKSPACE_PREFIX)) {
          if (other === exp.prefix) continue;
          expect(href.startsWith(other), `${role} section ${href} leaks into ${other}`).toBe(false);
        }
      }
      const content = helpForRole(role);
      const text = `${content.workspace} ${content.canDo.join(" ")}`.toLowerCase();
      expect(text, `${role} mentions its own functions`).toContain(exp.can);
      expect(
        content.cannotDo.join(" ").toLowerCase(),
        `${role} does not claim other roles' actions`,
      ).toContain(exp.cannot);
    }
  });

  it("never resolves another role's workspace path into a help section", () => {
    for (const [role, own] of Object.entries(WORKSPACE_PREFIX)) {
      for (const other of Object.values(WORKSPACE_PREFIX)) {
        if (other === own) continue;
        expect(
          helpSectionForPath(role, `${other}/some-page`),
          `${role} must not resolve ${other}`,
        ).toBeUndefined();
      }
    }
  });

  it("keeps Help out of the normal module navigation", () => {
    const moduleHrefs = [
      ...PORTAL_MODULES.map((m) => `/portal/${m.slug}`),
      ...Object.values(CROSS_CUTTING_MODULES).map((m) => m!.href),
    ];
    expect(moduleHrefs).not.toContain("/portal/help");
    for (const role of ROLES) {
      expect(getMenuForRole(role).map((m) => m.href), `${role} menu`).not.toContain("/portal/help");
      expect(genericSidebarHrefs(role), `${role} sidebar`).not.toContain("/portal/help");
    }
  });

  it("provides a real help page route for the shell link", () => {
    expect(routeExists("/portal/help")).toBe(true);
  });

  it("points each role's help back to its real dashboard", () => {
    for (const role of ROLES) {
      const dash = dashboardForRole(role);
      expect(helpDashboardForRole(role).href, `${role} help dashboard`).toBe(
        dash ? dash.href : "/portal/dashboard",
      );
    }
  });
});
