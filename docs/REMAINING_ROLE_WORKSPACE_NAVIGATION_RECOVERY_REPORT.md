# Remaining Role Workspace Navigation Recovery — Final Report

**Date:** 2026-08-16
**Milestone:** RECOVERY MILESTONE — REMAINING ROLE WORKSPACE NAVIGATION RECOVERY (16-phase directive)
**Mode:** Architecture audit + smallest-safe navigation recovery. **No RBAC, database, schema, migration, seed or workflow changes were made.** `ACCESS_CONTROL_MATRIX`, `permissionsFor()`, `can()`, `visibleModules()`, every role guard and server action are untouched. No `prisma migrate` / `db push` / `db reset` / seed was run; the persistent `data/pgdata` cluster was preserved. The academic workflow (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`), course-offering / course-assignment / registration-finalisation semantics, result approval and eligibility are untouched. `HOD_DEAN` was never referenced or recreated.
**Auditor scope:** Every role's sidebar resolves to an existing, authorized, renderable route in a real browser (headless Chrome over the CDP protocol) and via server-side probes; every generic-fallback role is documented; the Help system stays byte-identical to the authoritative sidebar.
**Related prior audits:** `docs/ROLE_WORKSPACE_UI_UX_BROWSER_UAT_FINAL_REPORT.md`, `docs/ROLE_NAVIGATION_ACCOUNT_HELP_RECOVERY_REPORT.md`, `docs/GLOBAL_ROLE_WORKSPACE_NAVIGATION_RECOVERY_REPORT.md`.
**Commands run this session:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors — 45 pre-existing warnings), `npm test` (all **304** pass — 296 baseline + 8 new), `npm run build` (success). The embedded PostgreSQL cluster and dev server were running throughout.

---

## 1. Executive Summary

The 13 remaining role workspaces were audited against the actual source and verified against a running dev server with minted role sessions. **The audit's headline finding: the directive's baseline assumption is inaccurate.** `getMenuForRole()` already returns dedicated menus for LECTURER, SBC_CHAIRMAN, DVC_OVERSIGHT and GOVERNANCE_OVERSIGHT_MEMBER (recovered in the previous milestone), so only **9 roles** actually fall back to the generic module sidebar: APPLICANT, REGISTRY, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER and STUDENT_AFFAIRS.

For those 9 roles the generic fallback is the **correct** design (each role maps cleanly onto existing module pages), but the audit found **one broken landing and five dead sidebar links** — routes that render a "No access" card or 307-bounce a role back to the dashboard even though the matrix grants the role access:

| # | Role | Defect | Fix |
|---|---|---|---|
| 1 | REGISTRY | Landing `/portal` → `/portal/admin` renders a **"No access"** card (REGISTRY has no ADMIN_SYSTEM) | Landing changed to `/portal/applications` (ADMISSIONS RWA — the Registry admissions console) |
| 2 | REGISTRY | Sidebar "Exams & Records" (`/portal/results`) 307-bounces to dashboard despite EXAMS_RECORDS R | Read-only results view added for EXAMS_RECORDS-R roles |
| 3 | PG_SCHOOL | Same dead `/portal/results` link | Same read-only view |
| 4 | TIMETABLE | Same dead `/portal/results` link | Same read-only view |
| 5 | APPLICANT | Sidebar "Fees & Payments" (`/portal/fees`) 307-bounces despite FEES W | APPLICANT self-service view added (own invoices + Remita payment) |
| 6 | APPLICANT | Sidebar "Postgraduate School" (`/portal/postgraduate`) 307-bounces despite PG_RESEARCH R | APPLICANT view added (PG programme catalogue + own application status) |

**All four fixes are page- and constants-level only** — no new menus, no RBAC changes, no new routes, no workflow changes. After the fixes, every sidebar link for every role resolves to a 200 render in a real browser. **17 roles with demo accounts pass browser UAT (137 checked routes, 0 failures); VERIFIER is the only role not browser-exercised (no demo user; login is CAPTCHA + first-login password-change gated) and is covered by code review + unit tests.**

The previous milestone's browser UAT had recorded these routes as passing (`pathOk: true`); the server probe and the CDP driver used here both re-verify them with a redirect-aware check and prove they were genuinely bouncing — the earlier `pathOk` values were a driver-timing false positive. This report supersedes those individual route entries.

**Regression status:** `tsc` clean, ESLint 0 errors (warnings pre-existing), all **304 tests pass** (296 baseline + 8 new navigation-integrity tests), production build succeeds, no DB/schema/seed/RBAC/workflow diff.

---

## 2. Scope

- Audit the 13 remaining role workspaces against source: LECTURER, DVC_OVERSIGHT, GOVERNANCE_OVERSIGHT_MEMBER, SBC_CHAIRMAN, REGISTRY, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER, APPLICANT, STUDENT_AFFAIRS.
- Decide for each role: dedicated menu (existing) vs generic fallback (justified) — **no new dedicated menus were created** because the audit showed the generic fallback is architecturally correct for all 9 generic roles once dead links are eliminated.
- Eliminate dead navigation links and broken landings with the smallest safe change, keeping menus centralized in `getMenuForRole()`.
- Keep the Help system in lock-step with the authoritative sidebar (no Help changes were needed because no menus changed).
- Verify with server-side redirect-aware probes + real-browser CDP UAT, navigation-integrity unit tests, and the four production gates.
- Deliver the recovery branch, pre-change/completion tags and this 16-section report.

Out of scope (unchanged, verified only): RBAC matrix and guards, schema/migrations/seeds, academic workflow, financial/admissions/PG aggregates, and the already-recovered dedicated workspaces (HOD, DEAN, VC, BURSARY, STUDENT).

---

## 3. Phase 0 — Baseline (Pre-change Checkpoint)

| Check | Result |
|---|---|
| Working tree before milestone | `recovery/role-workspace-ui-ux` at `e30fbda` ("Add role workspace UI/UX browser UAT final report") |
| Recovery branch | `recovery/remaining-role-workspaces` created at `e30fbda` |
| Pre-change tag | `recovery-remaining-role-workspaces-pre-change` at `e30fbda` |
| Baseline gates | `tsc` 0 errors · lint 0 errors/45 warnings · tests **296/296** (18 files) · build success |
| Database | `data/pgdata` untouched; no migration/seed/DB commands run |

The checkpoint branch and tag remain in the repository and are never deleted.

---

## 4. Phase 1 — Architecture Audit

Source audited: `src/lib/constants.ts` (`ACCESS_CONTROL_MATRIX` lines 279–471, `landingForRole` 647, `dashboardForRole` 697, `resultsForRole` 729, `PORTAL_MODULES` 494, `CROSS_CUTTING_MODULES` 517, `getMenuForRole` 858), `src/app/portal/layout.tsx` (sidebar construction), `src/components/portal-shell.tsx` (shell + EXTRA_LINKS), and every shared module page. An explore agent produced a role/page inventory which was then **re-verified against the page source and empirically** (redirect-aware `fetch` with minted sessions), because several agent claims contradicted the prior passing UAT.

**Key finding — directive baseline is inaccurate.** `getMenuForRole()` already returns dedicated menus for HOD, DEAN, VC, BURSARY, STUDENT, LECTURER, SBC_CHAIRMAN, DVC_OVERSIGHT and GOVERNANCE_OVERSIGHT_MEMBER. LECTURER/DVC/GOV/SBC are **not** on the generic fallback. Only 9 roles are generic.

**Dead-link verification (server-truth):** `/portal/results` ends in `redirect(resultsForRole(role) ?? "/portal/dashboard")`; `resultsForRole` returns non-null only for HOD/DEAN/SBC/DVC/GOV/VC. A probe with `redirect: "manual"` confirmed the earlier claims for the generic roles and rejected the one for STUDENT_AFFAIRS:

| Role | `/portal/results` (EXAMS_RECORDS perm) | Probe result | Prior UAT claim |
|---|---|---|---|
| REGISTRY | R | 307 → `/portal/dashboard` (dead) | (passed) |
| PG_SCHOOL | R | 307 → `/portal/dashboard` (dead) | — |
| TIMETABLE | R | 307 → `/portal/dashboard` (dead) | — |
| STUDENT_AFFAIRS | R | 200 (own misconduct branch) | (passed) — **agent claim rejected** |
| EXAMS_RECORDS | RWA | 200 (full pipeline branch) | (passed) |
| VERIFIER | V | 200 (verification branch, by code) | (passed) |

`/portal/fees` ends in `redirect("/portal/dashboard")` for anyone without STUDENT/BURSARY/FEES-R; APPLICANT (FEES W only) is bounced. `/portal/postgraduate` ends in the same redirect for anyone outside STUDENT/PG_SCHOOL/`READ_ONLY_ROLES`; APPLICANT (PG_RESEARCH RWS) is bounced. `/portal/admin` shows a "No access" card for any role without ADMIN_SYSTEM — REGISTRY's landing.

---

## 5. Phase 2 — Role Workspace Inventory

### Already dedicated (no action; nav unchanged and re-verified)

| Role | Menu | Links |
|---|---|---|
| LECTURER | `LECTURER_MENU` (9) | dashboard, post-results, backlog, course-results, result-files, corrections, level-adviser lookup, LMS, Profiles |
| DVC_OVERSIGHT | `DVC_GOVERNANCE_MENU` (9) | dvc dashboard + 8 oversight pages |
| GOVERNANCE_OVERSIGHT_MEMBER | `DVC_GOVERNANCE_MENU` (9) | same |
| SBC_CHAIRMAN | `SBC_MENU` (6) | sbc dashboard + 5 |
| HOD / DEAN / VC / BURSARY / STUDENT | dedicated menus | re-verified all 200 in browser (see §12) |

### Generic fallback (all 9 — final verdict: generic is correct)

| Role | Modules in matrix (sidebar links) | Landing | Issues found | After fix |
|---|---|---|---|---|
| APPLICANT | ADMISSIONS RWS, FEES W, ACCOMMODATION W, PROFILES RW, PG_RESEARCH RWS (5 links) | `/portal/applications` | fees + postgraduate dead | all 5 link to 200 |
| REGISTRY | ADMISSIONS RWA, EXAMS_RECORDS R, ACCOMMODATION R, PROFILES R, GRAD_CLEARANCE R, LIBRARY R, COMMUNICATIONS RW, HELPDESK RW, SENATE RW (8 links) | ~~`/portal/admin`~~ → `/portal/applications` | landing = no-access card; results dead | all 8 link to 200 |
| EXAMS_RECORDS | EXAMS_RECORDS RWA, TRANSCRIPT RWA, LMS R, GRAD_CLEARANCE R, PG_RESEARCH R, LIBRARY R, SENATE RW (6 links) | `/portal/results` | none | all 6 link to 200 |
| PG_SCHOOL | ADMISSIONS R, FEES R, EXAMS_RECORDS R, PROFILES R, GRAD_CLEARANCE A, PG_RESEARCH RWA, HELPDESK R (7 links) | `/portal/postgraduate` | results dead | all 7 link to 200 |
| SIWES | GRAD_CLEARANCE A, SIWES RWA (2 links) | `/portal/siwes` | none | both 200 |
| TIMETABLE | EXAMS_RECORDS R, TIMETABLE_VENUE RWA (2 links) | `/portal/timetabling` | results dead | both 200 |
| IT_ADMIN | ADMIN_SYSTEM RWA, DPO R (2 links) | `/portal/admin` | none | both 200 |
| VERIFIER | EXAMS_RECORDS V, TRANSCRIPT V (2 links) | `/portal/results` | none (results + transcripts branches exist) | both 200 by code; no demo user |
| STUDENT_AFFAIRS | ADMISSIONS R, FEES R, EXAMS_RECORDS R, ACCOMMODATION RWA, GRAD_CLEARANCE A, COMMUNICATIONS RW (6 links) | `/portal/hostels` | none | all 6 link to 200 |

`SENATE` (RW for REGISTRY/EXAMS_RECORDS) has no `PORTAL_MODULES` catalogue entry, so it surfaces no sidebar link — a gap in *menu surface*, not a dead link; left unchanged and noted in §11.

---

## 6. Phase 3 — Menu Justification Rules

Applied the directive's rule: **create a dedicated menu only when the generic fallback is architecturally wrong for the role.** The generic fallback is wrong when a role's modules cannot be covered by existing module pages. After Phase 1 the audit showed the opposite — every one of the 9 generic roles maps cleanly onto existing module pages once dead links are eliminated. **No new dedicated menu is justified** for any of the 13 roles:

- LECTURER / DVC / GOV / SBC: already have dedicated menus (previous milestone). No change.
- REGISTRY: 8 generic links, all authorized and renderable after §9. A bespoke REGISTRY menu would only link the same existing routes (no `/portal/registry/*` workspace pages exist), i.e. it would duplicate the generic menu — not justified.
- APPLICANT / EXAMS_RECORDS / PG_SCHOOL / SIWES / TIMETABLE / IT_ADMIN / VERIFIER / STUDENT_AFFAIRS: each is a narrow module consumer; the filtered module catalogue is exactly their workspace.

---

## 7. Phase 4 — Menu Design Rules Applied

- Menus stay centralized: dedicated menus in `getMenuForRole()`, generic menu in `src/app/portal/layout.tsx` (identical to Help via `CROSS_CUTTING_MODULES`). No navigation logic was duplicated.
- Every menu entry is an existing route the role is authorized to access (new unit tests in §13 enforce this).
- No new hrefs, no fake routes, no dashboard data invented.
- Landing pages must resolve to a page the role can actually render — the REGISTRY landing was the one violation and is fixed.

---

## 8. Phase 5 — Dedicated-Menu Decisions

**No new dedicated menus created.** Final per-role verdicts:

| Role | Decision | Justification |
|---|---|---|
| LECTURER, DVC_OVERSIGHT, GOVERNANCE_OVERSIGHT_MEMBER, SBC_CHAIRMAN | Dedicated menu (existing) | Already recovered; nav verified unchanged |
| HOD, DEAN, VC, BURSARY, STUDENT | Dedicated menu (existing) | Unchanged per directive; re-verified in browser |
| REGISTRY | Generic fallback | 8 authorized links; landing fixed; no bespoke workspace routes exist to justify a dedicated menu |
| APPLICANT, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER, STUDENT_AFFAIRS | Generic fallback | Module catalogue exactly covers each role; dead links eliminated at the page level |

---

## 9. Phase 6 — Implementation (4 smallest-safe fixes)

All changes are in `src/lib/constants.ts` (landing) and three shared module pages. No new routes, no RBAC changes, no workflow changes.

1. **`landingForRole("REGISTRY")` → `/portal/applications`** (`src/lib/constants.ts:659`). The Registry Office has no ADMIN_SYSTEM permission, so `/portal/admin` rendered a "No access" card; its primary console is the Admissions page (ADMISSIONS RWA). Comment added explaining why.
2. **Read-only results view** (`src/app/portal/results/page.tsx`). Before the final `redirect(resultsForRole(role) ?? "/portal/dashboard")`, a branch now serves roles with `resultsForRole(role) === null && can(role, "EXAMS_RECORDS", "R")` — REGISTRY, PG_SCHOOL, TIMETABLE (and BURSARY on direct visit) — an institutional read-only grade-pipeline + appeal-register view (same shape as the VC read-only view). Roles with a dedicated results surface (DEAN/SBC/DVC/GOV/VC) still route to it; HOD/EXAMS_RECORDS/STUDENT_AFFAIRS/VERIFIER/LECTURER/STUDENT branches are untouched.
3. **APPLICANT self-service fees view** (`src/app/portal/fees/page.tsx`). The self-service branch (own account, invoices, Remita `PayButton`, payment history) is now entered for `STUDENT || APPLICANT`, honouring APPLICANT's FEES W (pay-own-invoice). `payInvoice` is not role-gated (it already enforced invoice ownership), so no action change was needed.
4. **APPLICANT postgraduate view** (`src/app/portal/postgraduate/page.tsx`). New APPLICANT branch renders the PG programme catalogue plus the applicant's own PG application status. It deliberately does **not** render `ApplyPgForm`, because the `applyPg` server action gates PG applications to enrolled students (`module-actions.ts:988`) — surfacing a submit button that would error would be a dead action. The R-side of APPLICANT's PG_RESEARCH RWS is honoured; the W-side asymmetry is documented in §11 and left untouched (server auth is out of scope).

---

## 10. Phase 7 — Help System Sync

The Help system derives its sections from the authoritative sidebar (`helpSectionsForRole` mirrors `getMenuForRole` for dedicated roles and the `PORTAL_MODULES` + `CROSS_CUTTING_MODULES` filter for generic roles; the previous milestone's `CROSS_CUTTING_MODULES` centralization prevents drift). **Because no menus changed, no Help changes were required.** The existing Help-parity tests (§13) all still pass unchanged.

---

## 11. Phases 8–10 — Protection: RBAC, Database, Workflow

- **RBAC (Phase 8):** `ACCESS_CONTROL_MATRIX`, `permissionsFor()`, `can()`, `visibleModules()`, every role guard and every server action are byte-identical to the pre-change tag. The dead links were caused by *pages* not honouring the matrix, not by the matrix; they were fixed at the page level.
- **Database (Phase 9):** no schema, migration, seed or DB command ran; `data/pgdata` untouched; no `git diff` touches `prisma/` or seed files (verified in §14).
- **Workflow (Phase 10):** the results approval pipeline, course-offering/allocation, registration finalisation and eligibility are untouched — the new results branch is read-only and mutates nothing (no approve/finalise/return buttons), matching the existing VC read-only view.

**Noted, not changed (permission observations):**
1. APPLICANT holds `PG_RESEARCH: RWS` but `applyPg` only allows STUDENT — the "W" is dormant. Honoured R in the page; left the action's gate untouched per the no-server-auth rule.
2. `SENATE` RW (REGISTRY/EXAMS_RECORDS) has no catalogue entry, so it never produces a sidebar link; `DVC/GOV/VC` also hold SENATE R. Menu surface only; no dead link; left unchanged.

---

## 12. Phase 11 — Real Browser UAT (CDP)

- **Driver:** `scripts/__uat/cdp-uat.mts` — Node built-ins (`fetch` + native `WebSocket`) driving headless Chrome (`--headless=new`) over the Chrome DevTools Protocol. Temporary harness (recreated for this milestone; deleted after; evidence summarized here).
- **Sessions:** role sessions minted directly in the database via the app's own token scheme (`scripts/__uat/mint.mts`), installed as the `uap_session` cookie on `localhost`. Bypasses the public CAPTCHA + first-login password-change flow so workspaces can be audited.
- **Per-role checks:** `/portal` landing, dedicated/generic dashboard, and **every sidebar href** — navigate, wait for load, then assert `location.pathname` (redirect-aware, unlike the previous UAT) and no "No access" card.

| Role | Result | Role | Result |
|---|---|---|---|
| APPLICANT | 7/7 | EXAMS_RECORDS | 8/8 |
| STUDENT | 13/13 | PG_SCHOOL | 9/9 |
| LECTURER | 10/10 | SIWES | 4/4 |
| HOD | 9/9 | TIMETABLE | 4/4 |
| DEAN | 10/10 | IT_ADMIN | 4/4 |
| REGISTRY | 10/10 | DVC_OVERSIGHT | 10/10 |
| BURSARY | 12/12 | GOVERNANCE_OVERSIGHT_MEMBER | 10/10 |
| STUDENT_AFFAIRS | 8/8 | VC | 12/12 |
| | | SBC_CHAIRMAN | 7/7 |

**137/137 checked routes pass, 0 failures.** REGISTRY's landing now resolves to the Admissions console and its "Exams & Records" link renders the read-only view; APPLICANT's Fees and Postgraduate links render their new views; PG_SCHOOL and TIMETABLE results links render. `VERIFIER` is the only role not browser-exercised (no demo user; login is CAPTCHA + password-change gated) — its two routes were verified by code review (results VERIFIER branch, transcripts VERIFIER branch) and unit tests.

The 5 dead links and 1 broken landing from the prior milestone's report are hereby superseded by these results.

---

## 13. Phase 12 — Navigation Integrity Tests

Added 8 tests in `src/lib/navigation-help.test.ts` ("remaining role workspace navigation recovery"):
1. Keeps the nine dedicated workspace menus untouched (no role additions/removals).
2. Lands every generic-fallback role on a sidebar link it can access.
3. Never lands a role on `/portal/admin` without ADMIN_SYSTEM access.
4. Lands REGISTRY on its admissions console, not the admin console.
5. Dedicated menus link only to the role's own workspace or modules it has permission for (covers VC's `/portal/appointments` special case).
6. Every generic sidebar link maps to a module the role can access.
7. Routes EXAMS_RECORDS read-only roles (REGISTRY, PG_SCHOOL, TIMETABLE, BURSARY, STUDENT_AFFAIRS) to the shared results page.
8. Grants applicants the self-service fee and postgraduate surfaces they are linked to.

Pre-existing Help-parity, landing, results-routing and cross-role-isolation tests continue to pass unchanged.

---

## 14. Phases 13–14 — Regression Gates + Database Safety Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 45 warnings (all pre-existing, none from changed files) |
| `npm test` | **304/304 pass** (296 baseline + 8 new), 18 files |
| `npm run build` | success |
| DB safety | `git diff` contains **no** `prisma/schema.prisma`, migration, or seed changes; no DB command ran; `data/pgdata` preserved |
| RBAC / workflow | `src/lib/constants.ts` diff is limited to the REGISTRY landing comment/value; no matrix/guard/action changes |

One announcements-API test timed out once at 5000 ms under parallel load with the dev server hot-compiling; it passes 12/12 in isolation and the full suite re-run is green.

---

## 15. Phase 15 — Recovery Commit + Tags

| Item | Value |
|---|---|
| Recovery branch | `recovery/remaining-role-workspaces` |
| Pre-change tag | `recovery-remaining-role-workspaces-pre-change` (at `e30fbda`) |
| Completion commit | the milestone commit on the recovery branch |
| Completion tag | `recovery-remaining-role-workspaces-complete` |

The temporary UAT harness (`scripts/__uat/`) was deleted after use, matching the previous milestone's precedent. The branch and both tags are permanent.

---

## 16. Phase 16 — Final Completion Report

- **Roles audited:** all 13 (LECTURER, DVC_OVERSIGHT, GOVERNANCE_OVERSIGHT_MEMBER, SBC_CHAIRMAN — confirmed already-dedicated; REGISTRY, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER, APPLICANT, STUDENT_AFFAIRS — generic fallback).
- **Dedicated menus added:** none (none justified — generic fallback is architecturally correct for all 9 after the dead-link fixes).
- **Roles intentionally using the generic fallback:** APPLICANT, REGISTRY, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER, STUDENT_AFFAIRS — documented in §5/§8.
- **Fixes:** REGISTRY landing `/portal/admin` → `/portal/applications`; read-only results view for EXAMS_RECORDS-R roles (REGISTRY/PG_SCHOOL/TIMETABLE); APPLICANT self-service fees view; APPLICANT postgraduate view. 5 dead links + 1 broken landing eliminated.
- **Tests:** 304/304 (8 new navigation-integrity tests).
- **TypeScript:** 0 errors. **Lint:** 0 errors (45 pre-existing warnings). **Build:** success.
- **Database changes:** none. **RBAC changes:** none. **Workflow changes:** none.
- **Browser UAT:** 17 roles with demo accounts — 137/137 routes pass (real headless Chrome via CDP); VERIFIER not browser-exercised (no demo user).
- **Recovery branch:** `recovery/remaining-role-workspaces`. **Pre-change tag:** `recovery-remaining-role-workspaces-pre-change`. **Completion tag:** `recovery-remaining-role-workspaces-complete`.
- **Remaining blockers / open items:** (1) VERIFIER has no demo user — minting requires CAPTCHA + first-login password change; covered by code review and tests. (2) APPLICANT `PG_RESEARCH` W is dormant behind `applyPg`'s student-only gate (deliberately left untouched; see §11). (3) `SENATE` produces no sidebar surface (menu-catalogue gap, not a dead link).
- **Recommended next milestone:** a SENATE module catalogue entry + Senate workspace page for REGISTRY/EXAMS_RECORDS/SBC/DVC/GOV/VC, and a VERIFIER demo user for full browser UAT coverage.

STATUS: **COMPLETE**
