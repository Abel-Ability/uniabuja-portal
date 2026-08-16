# Role Navigation, Results Routing & Account-Specific Help — Recovery Report

**Date:** 2026-08-16
**Milestone:** Role Workspace Navigation, Account-Specific Help, Results Routing & Recovery Checkpoint — recover role-correct post-login landing, dedicated role menus, role-specific Results routing, a complete account-specific Help system, and a pre/post git checkpoint.
**Mode:** Recovery — navigation/help repair only. **No schema, migration, database, seed or RBAC changes were made.** No `prisma migrate reset` / `prisma db push` / `prisma migrate dev` / seed was run. All data in the persistent `data/pgdata` cluster was preserved. The academic workflow pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) and all existing guards are untouched.
**Auditor scope:** Post-login landing routing (F3), Results routing (F4), dedicated SBC/DVC/Governance/Student/Lecturer menus (F5), VC menu dead-link repair, duplicate-nav sweep, and the account-specific + context-aware Help system, verified across all 18 roles.
**Related prior audits:** `docs/END_TO_END_ACADEMIC_WORKFLOW_UAT_RECOVERY_REPORT.md`, `docs/GLOBAL_ROLE_WORKSPACE_NAVIGATION_RECOVERY_REPORT.md`, `docs/LECTURER_COURSE_DELIVERY_RESULT_RECOVERY_AUDIT.md`.
**Commands run this session:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors, 45 pre-existing warnings), `npm test` (all **289** pass — 273 baseline + 16 new), `npm run build` (success). The embedded PostgreSQL cluster was running for the integration suite.

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not exercised in this run

---

## 1. Executive Summary

The portal previously routed every user to a generic `/portal/dashboard`, gave SBC / DVC / Governance / Student / Lecturer roles generic module menus (hiding their real workspace surfaces), and routed DEAN / SBC / DVC / GOV / VC users away from Results entirely. The shared Help page only covered 4 roles. This milestone repairs all of it:

- **F3 — Post-login landing:** `login()`, `changePassword()` and both MFA paths now redirect through `landingForRole()`, sending every role to its own workspace. `VERIFIER` is added to the map (→ shared Results page).
- **F4 — Results routing:** a new `resultsForRole()` in `src/lib/constants.ts` routes each owning role to its dedicated results surface; the shared `/portal/results` catch-all uses it instead of dumping users on the dashboard.
- **F5 — Dedicated menus:** new `STUDENT_MENU`, `LECTURER_MENU`, `SBC_MENU` and `DVC_GOVERNANCE_MENU`; `VC_MENU` repaired (dead `/portal/students` and accessless `/portal/admin` entries removed, real executive surfaces added); a `dashboardForRole()` helper makes each workspace's sidebar start on its own dashboard.
- **Help system:** `src/lib/help.ts` rewritten into a structured, account-specific guide covering all 18 roles with ten standard points each; a "Help & Guide" control is pinned at the bottom of the sidebar; the help page is context-aware via `?from=<pathname>`.

**Regression status:** `tsc` clean, ESLint 0 errors (45 warnings — no increase), all **289 tests pass** (273 baseline + 16 new navigation/help tests), production build succeeds, and the pre-change checkpoint branch/tag are preserved.

---

## 2. Scope

- F3 — post-login landing for every role (login, change-password, MFA).
- F4 — role-specific Results routing (`resultsForRole` + shared-page catch-all).
- F5 — dedicated SBC, DVC/Governance, Student and Lecturer menus; VC menu repair.
- Navigation de-duplication and dead/misleading entry sweep.
- Account-specific Help content for all 18 roles + sidebar control + context-aware section resolution.
- New unit tests for landing, results routing, menus, route existence, duplicate hrefs and help isolation.
- Verification gates: `tsc`, `lint`, `npm test`, `npm run build`.
- Git checkpoint (branch + tag) and completion commit + tag.

Out of scope (unchanged, verified only): the academic workflow pipeline, audit-hash chain internals, RBAC matrix, all role guards, bursary/admissions/PG aggregates, browser-level UI walkthrough (F10-style).

---

## 3. Baseline — Pre-change Checkpoint (Phase 0)

| Check | Result |
|---|---|
| Working tree before milestone | `main` at `b4cb9bd` ("Source public content from Google Sheets tabs"), 0 staged changes, prior-milestone work uncommitted |
| Recovery branch created | `recovery/pre-navigation-help` at `b4cb9bd` |
| Pre-change tag created | `recovery-pre-navigation-help` at `b4cb9bd` |
| Database | `data/pgdata` untouched; no migration/seed/DB commands run |

The checkpoint branch/tag remain in the repository and are never deleted.

---

## 4. Post-login Landing Repair (F3)

**Finding (pre-milestone):** `login()` redirected to `/portal/dashboard` for every role.

**Repairs applied (presentation-only):**

| File | Location | Change |
|---|---|---|
| `src/app/login/actions.ts` | `login()` | `redirect(landingForRole(user.role))` |
| `src/app/login/actions.ts` | `changePassword()` | `redirect(landingForRole(user.role))` |
| `src/app/login/mfa/actions.ts` | pre-verify guard | `redirect(landingForRole(session.user.role))` |
| `src/app/login/mfa/actions.ts` | `verifyMfaCode()` success | `redirect(landingForRole(session.user.role))` |
| `src/app/login/mfa/page.tsx` | pre-render guard | `redirect(landingForRole(session.user.role))` |
| `src/lib/constants.ts` | `landingForRole` | Added `VERIFIER → "/portal/results"` |

`landingForRole()` already existed for all 18 roles (default `/portal/dashboard`); no landing target changed except the VERIFIER addition. Auth semantics, MFA flow and lockout/rate-limit behavior are untouched.

| Role | Post-login landing | Route exists |
|---|---|---|
| APPLICANT | `/portal/applications` | 🟢 |
| STUDENT | `/portal/student` | 🟢 |
| LECTURER | `/portal/lecturer` | 🟢 |
| HOD | `/portal/hod` | 🟢 |
| DEAN | `/portal/dean` | 🟢 |
| REGISTRY | `/portal/admin` | 🟢 |
| BURSARY | `/portal/bursary` | 🟢 |
| STUDENT_AFFAIRS | `/portal/hostels` | 🟢 |
| EXAMS_RECORDS | `/portal/results` | 🟢 |
| PG_SCHOOL | `/portal/postgraduate` | 🟢 |
| SIWES | `/portal/siwes` | 🟢 |
| TIMETABLE | `/portal/timetabling` | 🟢 |
| IT_ADMIN | `/portal/admin` | 🟢 |
| DVC_OVERSIGHT | `/portal/dvc` | 🟢 |
| GOVERNANCE_OVERSIGHT_MEMBER | `/portal/dvc` | 🟢 |
| VC | `/portal/vc` | 🟢 |
| SBC_CHAIRMAN | `/portal/sbc` | 🟢 |
| VERIFIER | `/portal/results` | 🟢 |

---

## 5. Results Routing (F4)

**Finding (pre-milestone):** the shared `/portal/results` page handled STUDENT / LECTURER / HOD / EXAMS_RECORDS / STUDENT_AFFAIRS / VERIFIER / VC branches, but its catch-all (`/portal/results/page.tsx` line 438) redirected everyone else — including DEAN, SBC and DVC/GOV — to the dashboard, hiding their real results surfaces.

**Repair:** new `resultsForRole(role)` in `src/lib/constants.ts`; the shared-page catch-all now routes through it.

| Role | Results surface | Notes |
|---|---|---|
| HOD | `/portal/hod/approvals` | Department sign-off page |
| DEAN | `/portal/dean/results` | Faculty review/return |
| SBC_CHAIRMAN | `/portal/sbc/results` | Senate scrutiny |
| DVC_OVERSIGHT | `/portal/dvc/academic` | Read-only oversight |
| GOVERNANCE_OVERSIGHT_MEMBER | `/portal/dvc/academic` | Read-only oversight |
| VC | `/portal/vc/results` | Executive pipeline |
| Others | `null` → shared `/portal/results` | Unchanged |

No duplicate results implementation was introduced; each role reuses its existing dedicated page.

---

## 6. Dedicated Role Menus (F5)

**Findings (pre-milestone, verified by live matrix probe):** SBC_CHAIRMAN's sidebar contained only `/portal/results` (its `/portal/sbc/*` surfaces invisible); DVC/GOV showed 13 generic modules including FEES/HOSTELS/SIWES (misleading); STUDENT and LECTURER had generic module menus; VC_MENU pointed at `/portal/students` (404) and `/portal/admin` (renders "No access").

**Repairs in `src/lib/constants.ts`:**

- `STUDENT_MENU` — 12 entries from `/portal/student` dashboard through registration, results, fees, transcripts, LMS, hostels, graduation, profiles.
- `LECTURER_MENU` — 9 entries from the lecturer dashboard through posting, backlog, course results, files, corrections, level-adviser lookup, LMS, profiles.
- `SBC_MENU` — 6 entries (dashboard, results/scrutiny, matters, decisions, reports, communications).
- `DVC_GOVERNANCE_MENU` — 9 entries shared by both governance roles (dashboard, academic oversight, university overview, exceptions, audit, reports, students, staff, communications).
- `VC_MENU` — repaired: removed `/portal/students` and `/portal/admin`; added `results`, `university-overview`, `academic`, `governance`, `exceptions`, `audit`, `students`, `staff`, `reports` (all real `/portal/vc/*` routes) plus the existing Appointments link.
- `getMenuForRole()` now returns the above for STUDENT, LECTURER, SBC_CHAIRMAN, DVC_OVERSIGHT and GOVERNANCE_OVERSIGHT_MEMBER (HOD/DEAN/VC/BURSARY were already dedicated).
- `dashboardForRole(role)` added; `src/app/portal/layout.tsx` uses it so each workspace sidebar starts on its own dashboard (the shell de-duplicates the matching first menu entry).

Every menu entry is verified to resolve to an existing route by the new test suite (see §11).

---

## 7. Navigation De-duplication & Dead-link Sweep

- Duplicate-href rule: `portal-shell.tsx` already de-duplicates a menu entry whose href equals the dashboard entry. With `dashboardForRole`, STUDENT/LECTURER/SBC/DVC/GOV/VC now start on their workspace dashboard with no duplicate row.
- Dead-link sweep result: `VC_MENU` no longer contains `/portal/students` (route does not exist — confirmed absent from the build route table) or `/portal/admin` (accessless for VC).
- The test suite asserts zero duplicate hrefs inside any role menu and that every menu href resolves to a real page.

---

## 8. Account-Specific Help System

**Before:** `src/lib/help.ts` covered only STUDENT, LECTURER, HOD and APPLICANT with FAQ cards; everything else fell back to a generic staff sheet. The help page had no sidebar entry.

**After:**

- **Structure:** every role's content is a `RoleHelpContent` with the ten standard points — workspace purpose, sidebar sections, where to start, workflow sequence, allowed actions, not-allowed actions, results/reports location, post-action effects, returning to the dashboard, historical records — plus role FAQs.
- **Coverage:** all 18 roles in `ROLE_HELP` (STUDENT, LECTURER, HOD, DEAN, BURSARY, SBC_CHAIRMAN, DVC_OVERSIGHT + GOVERNANCE_OVERSIGHT_MEMBER (shared), VC, APPLICANT, REGISTRY, EXAMS_RECORDS, STUDENT_AFFAIRS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, VERIFIER). An unknown-role fallback still produces accurate, module-derived guidance so no user ever sees an empty page.
- **Sections mirror the sidebar:** curated roles list their workspace menu; generic roles derive sections from `visibleModules()` + `PORTAL_MODULES`, so the help always matches the rendered menu by construction.
- **Sidebar control:** "Help & Guide" is pinned at the bottom of the sidebar (desktop aside and mobile drawer), outside the scrollable nav so it never interferes with scrolling.
- **Context-aware:** the control links to `/portal/help?from=<pathname>`; the help page highlights the section the user came from (`helpSectionForPath`, longest-match). The `from` query may only select a section **within the session-derived role's content** — it can never change which role's help is shown.

---

## 9. Context-Aware Help Behavior

| Input | Result |
|---|---|
| STUDENT opens Help from `/portal/student/course-registration` | "Course Registration" section highlighted |
| STUDENT requests `/portal/help?from=/portal/hod/approvals` | `helpSectionForPath` returns undefined (outside role) — no section highlighted, role content unchanged |
| HOD opens Help from `/portal/hod/approvals` | "Approvals" section highlighted |
| Help page receives `?from` for an unknown path | Graceful fallback — full role guide rendered |

Tested in `navigation-help.test.ts` (help isolation + context resolution).

---

## 10. Guards & Workflow Preservation

- **Pipeline unchanged:** `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`; no `DEAN_APPROVED`/`HOD_DEAN` stages exist or were introduced.
- **Guards preserved:** every workspace page keeps its role gate (e.g. lecturer pages gate `user.role !== "LECTURER"` → `redirect(landingForRole(role))`; student surfaces remain session-keyed to the logged-in user). The `/portal/results` page still branches per role before any fallback.
- **Identity:** all role decisions derive from the server-side session; client-supplied `?from=` can only select within the session role's help content.
- **RBAC:** `ACCESS_CONTROL_MATRIX` and `can()`/`visibleModules()` are untouched (see §13).

---

## 11. Tests Added (Phase 16)

New file `src/lib/navigation-help.test.ts` (16 tests, pure unit — no DB):

| Group | Coverage |
|---|---|
| Post-login landing routing | `landingForRole` for all 18 roles + route-existence check; unknown-role fallback |
| Results routing | `resultsForRole` mapping + route existence; `null` for shared-page roles |
| Workspace menus | Non-empty sidebar for every role (incl. CROSS_CUTTING); dedicated SBC/DVC/GOV/STUDENT/LECTURER menus; zero duplicate hrefs; every href resolves to a route; VC dead links absent; dashboard entry matches menu start (shell de-duplication) |
| Account-specific help | All 18 roles covered (description/workspace/canDo/faqs non-empty); help isolation (STUDENT cannot obtain HOD/VC content, HOD cannot obtain STUDENT content); sections mirror the sidebar menu; every section route exists; context-aware resolution; unknown-role fallback |
| Role labels | All roles labelled |

Existing `src/lib/constants.test.ts` (can()/visibleModules) was not modified.

---

## 12. Verification Gates (Phase 17)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 45 warnings (no increase from the pre-existing baseline) |
| `npm test` | **289/289 pass** (18 files; 273 baseline + 16 new) |
| `npm run build` | Success (Next.js 16.3.0, Turbopack); route table confirms all new menu/routing targets (`/portal/help`, `/portal/sbc/results`, `/portal/vc/results`, `/portal/dvc/academic`, `/portal/hod/approvals`) and the absence of the removed `/portal/students` |

---

## 13. RBAC / Access-Control Matrix — Unchanged

- `ACCESS_CONTROL_MATRIX`, `can()`, `visibleModules()`, `isHodRole()`, `requireSbcChairman()`, `requireGovernanceOversight()`, `requireVC()` and all page guards are **unchanged**.
- No role gained or lost any granted permission. Menu changes are presentation-layer only (`getMenuForRole`/`dashboardForRole`/`landingForRole`/`resultsForRole`).
- No `middleware.ts` was introduced (F6 — documented only; server-side layout/action checks remain the sole enforcement layer).
- F7 (SBC CHAIRMAN vs MEMBER powers identical) — documented only, unchanged per product decision.

---

## 14. Database Safety Confirmation

- **No schema change, no migration, no Prisma client regeneration, no DB reset.**
- `prisma migrate reset`, `prisma db push`, `prisma migrate dev` and seed were **NOT** run.
- The persistent `data/pgdata` cluster was untouched; only the existing integration suite ran against it.
- No fixtures were written, changed or cleaned up by this milestone.

---

## 15. Final Status, Commit & Tags

**ROLE WORKSPACE NAVIGATION, ACCOUNT-SPECIFIC HELP, RESULTS ROUTING & RECOVERY CHECKPOINT STATUS: COMPLETE**

| Item | Value |
|---|---|
| Pre-change checkpoint | Branch `recovery/pre-navigation-help` + tag `recovery-pre-navigation-help` @ `b4cb9bd` (kept) |
| Completion commit | `80380a1` — "Recover role navigation, results routing and account-specific help" (257 files) |
| Completion tag | `recovery-role-navigation-help-complete` @ `80380a1` |
| Working tree after commit | Only junk/probe/DB/roster files remain untracked (excluded intentionally: `data/`, `.kimchi/`, `*_output.txt`, probes, etc.) |

Scope note: the completion commit also captures the accumulated prior-milestone source/docs (academic workflow, executive governance, registrations, etc.) that were previously uncommitted — staged explicitly, excluding junk and sensitive files (DB cluster data, roster CSVs, agent logs, inspect JSONs).

---

## 16. Remaining Findings (deferred, not fixed)

| # | Finding | Status |
|---|---|---|
| 1 | SBC and DVC/GOV `cannotDo` wording implies read-only results; the shared `/portal/results` page is still reachable by direct URL for these roles but immediately redirects via `resultsForRole` — no per-role guard inside the page for the new dedicated surfaces (they rely on their own page guards, which exist). Verified safe; no change made. | ⚪ |
| 2 | `VERIFIER` lands on the shared `/portal/results` page; its read-only verifier branch is server-rendered for VERIFIER and strips administrative actions, but no dedicated guard file exists on that page for VERIFIER specifically. Verified safe (branch is session-role-scoped); documented only. | ⚪ |
| 3 | IT_ADMIN's sidebar is entirely CROSS_CUTTING (Admin/System + DPO); acceptable and now covered by tests, but IT_ADMIN has no dedicated landing workspace other than `/portal/admin`. | ⚪ |
| 4 | F10-style interactive browser walkthrough of every menu + the new Help control not executed this session (requires live DB + dev server); logic is fully covered by unit tests and the build route table. | ⚪ |

Recommended next step: a brief live walkthrough (login as a STUDENT, SBC, DVC and VC user; open Help from a sub-page) to eyeball the sidebar/Help layout in the browser.
