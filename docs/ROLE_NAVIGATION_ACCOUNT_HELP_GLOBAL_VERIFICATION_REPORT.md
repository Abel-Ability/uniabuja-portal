# ROLE-SPECIFIC ACCOUNT HELP — GLOBAL COVERAGE AND VERIFICATION RECOVERY REPORT

**Milestone:** Role-specific account Help — global coverage and verification recovery
**Mode:** Targeted audit + verification. **No production code was changed.** Only `src/lib/navigation-help.test.ts` was extended with new tests, and this report was created. No database, RBAC, navigation, workflow or dashboard changes were made.

---

## Executive Summary

The role-specific account Help feature was audited, verified end-to-end and locked in.

The reported gap ("Help works in the HOD workspace but is missing from at least the DEAN dashboard") was **not reproduced**: Help is not implemented per-dashboard. It is rendered once, by the shared `PortalShell` component that wraps every authenticated `/portal` route, so it appears at the bottom of the sidebar for **every** authenticated role — HOD and DEAN included. The Help page itself is a server component that derives the role from the authenticated session, so the content shown is always that role's own, and a user cannot obtain another role's Help by editing the URL or client-side state.

Verification performed:

- **All 18 authenticated roles** have curated, role-specific help content (`src/lib/help.ts`), and a module-derived fallback covers any future/unknown role.
- **Browser UAT in real headless Chrome** for the nine named workspaces (HOD, DEAN, VC, BURSARY, LECTURER, STUDENT, DVC/Oversight, Governance, SBC): each signed in to its own dashboard, confirmed the Help entry at the **bottom of the sidebar** (beneath the role's navigation items, visually distinct, not a normal module), opened the Help page, confirmed it was **labelled with that role** and listed **exactly that role's sidebar modules**, and confirmed **no other workspace's links** leaked. All nine passed on the desktop sidebar **and** the mobile drawer.
- **Gates:** TypeScript 0 errors · ESLint 0 errors (45 pre-existing warnings, none new) · **311/311 tests pass** (304 baseline + 7 new) · production build succeeds.

## Root Cause

The premise that Help was HOD-only was inaccurate. The real architecture places Help in the shared shell, so the feature was already global:

- `HelpLink` is hard-coded in `PortalShell` (`src/components/portal-shell.tsx`), which is used by the single portal layout (`src/app/portal/layout.tsx`) for **all** `/portal/*` routes.
- The HOD workspace therefore displays Help for the same reason every other workspace does — the shell renders it. It is not HOD-specific wiring.
- The DEAN dashboard renders the same shell and the same Help entry; no Dean-specific defect exists.
- The feature was introduced with HOD as the first exercised workspace, which explains the impression that only HOD had it; the earlier milestone's browser UAT already recorded a role-scoped Help page for every role.

No root-cause defect was found; the task reduced to proving global coverage and role-scoping, which is what this milestone delivers.

## Architecture

- **Single shared integration point — `PortalShell`.** Every authenticated page nests under `src/app/portal/layout.tsx`, which renders `PortalShell` with the role's menu (`getMenuForRole` / `visibleModules`) and dashboard. `PortalShell` appends a dedicated `nav[aria-label="Help"]` **after** the module navigation and **before** the user footer, in both the desktop `<aside>` and the mobile drawer. It is visually distinct (`border-t`, card styling, its own label/description) and is **not** part of `PORTAL_MODULES`, `CROSS_CUTTING_MODULES`, or any role menu — so it can never be mistaken for an ordinary application module.
- **Link target:** `/portal/help?from=<current path>`.
- **Server-rendered Help page** (`src/app/portal/help/page.tsx`): a server component. The role comes exclusively from `getCurrentSession().user.role`; the `from` query parameter can only highlight a section **within the user's own role content** (`helpSectionForPath(role, from)`), so it can never substitute another role's Help.
- **Content library** (`src/lib/help.ts`): a `RoleHelpContent` object per role (workspace, start-here, sections, workflow, can-do, cannot-do, results, after, dashboard, history, FAQs) plus `helpSectionsForRole()` which mirrors the actual sidebar so guidance always matches the menu. All 18 roles are curated; an unknown role receives an accurate module-derived fallback rather than an empty page.

**Why this integration point was selected:** `PortalShell` is the single layout wrapper that every authenticated role passes through. Placing Help there yields consistent global availability with zero per-dashboard duplication — exactly what the brief asked for over "adding isolated copies".

## Role Help Matrix

| Role | Workspace | Help Present | Help Content | Navigation Verified |
| ---- | --------- | -----------: | ------------ | ------------------: |
| HOD | `/portal/hod` | Yes | HoD-only (allocation, offerings, approvals, advisers) | Yes — browser |
| DEAN | `/portal/dean` | Yes | Dean-only (faculty, results return, admissions, graduation, PG, academic mgmt, comms) | Yes — browser |
| VC | `/portal/vc` | Yes | VC-only (executive dashboard, results & records, governance, appointments) | Yes — browser |
| BURSARY | `/portal/bursary` | Yes | Bursary-only (invoices, payments, waivers, scholarships, clearance, reports) | Yes — browser |
| LECTURER | `/portal/lecturer` | Yes | Lecturer-only (post results, backlog, corrections, level adviser) | Yes — browser |
| STUDENT | `/portal/student` | Yes | Student-only (registration, finalisation, reference, results, fees, transcripts, hostels) | Yes — browser |
| DVC_OVERSIGHT | `/portal/dvc` | Yes | DVC/Oversight-only (read-only monitoring, exceptions, audit) | Yes — browser |
| GOVERNANCE_OVERSIGHT_MEMBER | `/portal/dvc` | Yes | Governance/Oversight-only — same object as DVC because the two workspaces are identical by design | Yes — browser |
| SBC_CHAIRMAN | `/portal/sbc` | Yes | SBC-only (senate scrutiny, matters, decisions, reports) | Yes — browser |
| APPLICANT | generic modules + `/portal/applications` | Yes | Applicant-only (application status, offers, fees, PG info) | Yes — unit |
| REGISTRY | generic modules | Yes | Registry-only (applications, admissions, student records) | Yes — unit |
| EXAMS_RECORDS | generic modules | Yes | Exams & Records-only (finalisation, transcripts) | Yes — unit |
| STUDENT_AFFAIRS | generic modules | Yes | Student Affairs-only (hostels, clearance, welfare) | Yes — unit |
| PG_SCHOOL | generic modules | Yes | PG School-only (PG admissions, supervision, records) | Yes — unit |
| SIWES | generic modules | Yes | SIWES-only (placements, records) | Yes — unit |
| TIMETABLE | generic modules | Yes | Timetable-only (venues, timetables) | Yes — unit |
| IT_ADMIN | generic modules | Yes | IT Admin-only (admin, DPO) | Yes — unit |
| VERIFIER | `/portal/results`, `/portal/transcripts` | Yes | Verifier-only (read-only record verification) | Yes — unit (no demo user for browser) |

Browser verification covers the nine named workspaces per the brief; the remaining roles were exercised by the role-to-menu, leakage, RBAC and help-content unit tests (they share the same shell, so sidebar placement is structural and identical).

## Files Modified

| File | Purpose |
| ---- | ------- |
| `src/lib/navigation-help.test.ts` | Added 7 tests in `describe("account-specific help global coverage")`: (1) `ROLE_HELP` covers exactly the authenticated role set with curated (non-fallback) content; (2) each named workspace has distinct content (DVC/Governance intentionally identical); (3) the nine named roles' help stays inside their own workspace — sections link only into the role's workspace, mention the role's real functions, and never claim other roles' actions; (4) `helpSectionForPath` never resolves another role's workspace path; (5) `/portal/help` is excluded from `PORTAL_MODULES`, `CROSS_CUTTING_MODULES` and every role's sidebar (Help is separate, not a module); (6) the `/portal/help` route exists; (7) each role's help points back to its real dashboard. Imports extended with `ROLE_HELP`, `helpDashboardForRole`. |

No production source files were changed.

## Files Created

| File | Purpose |
| ---- | ------- |
| `docs/ROLE_NAVIGATION_ACCOUNT_HELP_GLOBAL_VERIFICATION_REPORT.md` | This report. |
| `scripts/__uat/{mint.mts, cdp-uat.mts, tokens.json}` (transient) | Temporary browser UAT harness (session minting + headless-Chrome CDP driver). **Deleted after use**, matching prior-milestone precedent. |

## Database

- Schema changed: **NO**
- Migrations: **NO**
- Database reset: **NO**
- Seed: **NO**

## RBAC

- `ACCESS_CONTROL_MATRIX` and server-side authorization: **unchanged**. No new permissions, roles or guards were introduced. The obsolete `HOD_DEAN` role remains absent from all active code (`grep HOD_DEAN src/` → 0 matches); it exists only in historical docs and `orig_*` backups.

## Tests

- **TypeScript:** `npx tsc --noEmit` → **0 errors**.
- **ESLint:** `npm run lint` → **0 errors**, 45 pre-existing warnings (no new warnings).
- **Unit/integration:** `npm test` → **311 passed / 311** (18 files). Baseline was 304; **7 new tests** added (all in `navigation-help.test.ts`).
- **Build:** `npm run build` → **success**.
- **Browser/UAT:** real headless Chrome (CDP) for HOD, DEAN, VC, BURSARY, LECTURER, STUDENT, DVC_OVERSIGHT, GOVERNANCE_OVERSIGHT_MEMBER, SBC_CHAIRMAN. Per role, a session was minted directly in the database (same `uap_session` + HMAC token scheme the app uses) and the browser verified:
  1. The role's landing page loads and shows the role's own sidebar;
  2. the Help entry is present **at the bottom of the sidebar** — DOM order module-nav → Help-nav → user footer, visible, and not inside the module list;
  3. opening Help shows a page labelled for that role and listing **exactly** the role's sidebar modules (section count matched per role: HOD 8, DEAN 9, VC 11, BURSARY 11, LECTURER 9, STUDENT 12, DVC 9, GOV 9, SBC 6);
  4. **no** links to any other role's workspace appear on the Help page;
  5. the **mobile drawer** also exposes the Help entry (open via hamburger, Help link visible).
  **All 9 roles passed** on desktop sidebar and mobile drawer.

**Documented limitation:** the unit suite is pure vitest without a component-testing library, so the rendered sidebar DOM is not unit-asserted. Sidebar placement is instead verified by (a) the browser UAT above and (b) unit assertions that `/portal/help` never appears in any module/menu list.

## Regression Verification

- Full unit suite green (**311/311**), including the existing navigation-integrity suite (menus, landing routing, results routing, RBAC/`can()` matrix tests) and the academic-workflow suite (course offerings, course assignment, student registration, registration finalisation/locking/view-print, lecturer result submission, faculty/university aggregation, bursary and executive/governance recoveries).
- `git diff` confirms **zero changes** to production code: the working tree diff touches only `src/lib/navigation-help.test.ts`. No `prisma/`, `seed`, migration, or `data/` changes were made.

## Remaining Gaps

- **VERIFIER browser coverage:** no demo user exists for the VERIFIER role, so its Help page was not browser-exercised. Its content is curated and covered by unit tests asserting the read-only verification scope.
- **DVC/Governance shared content:** DVC_OVERSIGHT and GOVERNANCE_OVERSIGHT_MEMBER intentionally share one help object because their workspaces are identical (same menu, same matrix row). This is by design, not a gap.
- **No component-level unit test for sidebar DOM placement** (no testing library installed); covered by browser UAT instead.

No other genuine gaps were identified.
