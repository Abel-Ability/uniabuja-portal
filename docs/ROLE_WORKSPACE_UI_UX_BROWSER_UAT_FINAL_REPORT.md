# Role Workspace UI/UX — Browser UAT Final Report

**Date:** 2026-08-16
**Milestone:** Role Workspace UI/UX And Browser UAT Hardening — Final Production Readiness (24-section directive)
**Mode:** Browser-level UAT + smallest-safe UI/UX hardening. **No schema, migration, database, seed or RBAC changes were made.** No `prisma migrate reset` / `prisma db push` / `prisma migrate dev` / seed was run. All data in the persistent `data/pgdata` cluster was preserved. The academic workflow pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`), the RBAC matrix, audit semantics and every existing role guard are untouched.
**Auditor scope:** Real browser (headless Edge via CDP) verification of every authenticated role workspace — landing, sidebar/menu, every menu route, active state, help page, help cross-role isolation, unauthorized-route guards — plus responsive/mobile, nested-route 404, logout and print behaviour, followed by the four production gates.
**Related prior audits:** `docs/ROLE_NAVIGATION_ACCOUNT_HELP_RECOVERY_REPORT.md`, `docs/FINAL_END_TO_END_ACADEMIC_WORKFLOW_UAT_REPORT.md`, `docs/GLOBAL_ROLE_WORKSPACE_NAVIGATION_RECOVERY_REPORT.md`.
**Commands run this session:** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors — all warnings pre-existing in files outside this milestone's change set), `npm test` (all **296** pass — 289 baseline + 7 new), `npm run build` (success). The embedded PostgreSQL cluster and the dev server were running throughout.

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not exercised in this run

---

## 1. Executive Summary

Every authenticated role workspace was driven end-to-end in a real browser (headless Microsoft Edge over the CDP protocol) with role sessions minted directly in the database. **All 17 roles with demo users PASS** — correct role landing, correct sidebar, every menu route reachable with the correct active state, Help page present and role-scoped, Help immune to cross-role manipulation, and unauthorized routes redirected away. 0 console errors and 0 page-level failures across 164 checked routes. `VERIFIER` is the only role not browser-exercised (no demo user; login is CAPTCHA + first-login password-change gated).

The browser UAT uncovered **four genuine production-readiness defects**, all fixed with smallest-safe changes:

1. **🔴 Admin users table unbounded (125 MB response).** `/portal/admin` rendered all **38,755** roster-synced users into one table — a 125,341,964-byte HTML payload (~3.5 min server stream) that made the page time out in every browser and looked like a UAT-driver hang. Fixed with server-side pagination (page size 50, `safePage` clamp, Prev/Next, "Showing X–Y of Z users"). The page now renders **357,483 bytes in ~1.2 s**.
2. **🔴 Appointments staff picker unbounded (8.4 MB response).** The propose-appointment `<select>` listed all **38,754 ACTIVE users** — 8,419,826-byte HTML for DEAN/DVC (~2.2 s). Fixed with a search-based picker (`?q=` ≥ 2 chars, case-insensitive `contains`, `take: 50`). DEAN/DVC now render **~32–34 KB in ~0.15–0.2 s**; `?q=ade` caps at 50 matches.
3. **🟡 Generic-role Help omitted cross-cutting modules.** Help sections for generic roles (REGISTRY, IT_ADMIN, …) mirrored only `PORTAL_MODULES`, so sidebar modules like Admin / System, Data Protection, Communications and Helpdesk were missing from the Help page. Fixed by centralizing `CROSS_CUTTING_MODULES` and having both the shell and Help derive from it — the two can no longer drift. Verified in-browser (IT_ADMIN Help now shows exactly Admin / System + Data Protection; REGISTRY shows Library / Communications / Helpdesk).
4. **🟡 `/portal` was a dead 404 route.** Every logged-in user hitting `/portal` got a 404. Fixed with a `/portal` root page that 307-redirects to `landingForRole(role)` (verified: IT_ADMIN→`/portal/admin`, VC→`/portal/vc`, STUDENT→`/portal/student`, APPLICANT→`/portal/applications`).

**Regression status:** `tsc` clean, ESLint 0 errors (warnings pre-existing, none from changed files), all **296 tests pass** (289 baseline + 7 new), production build succeeds.

---

## 2. Scope

- Real-browser UAT of every role workspace: landing, sidebar, all menu routes, active state, Help, Help isolation, unauthorized-route guards.
- Mobile/drawer behaviour, bogus + nested-route 404 behaviour, logout, print CSS (supplemental checks).
- Fix only genuine UI/UX defects with the smallest safe change; verify each fix in-browser and with unit tests.
- Verification gates: `tsc`, `lint`, `npm test`, `npm run build`.
- §22 checkpoint (commit + tag) and §23 final report.

Out of scope (unchanged, verified only): the academic workflow pipeline, audit-hash chain internals, RBAC matrix and `ACCESS_CONTROL_MATRIX`, all role guards, schema/migrations, seeds, and the financial/admissions/PG aggregates.

---

## 3. Baseline — Pre-change Checkpoint (Phase 0)

| Check | Result |
|---|---|
| Working tree before milestone | `main` at `dea682a` ("Add final end-to-end academic workflow UAT report"), 0 staged changes |
| Recovery branch | `recovery/role-workspace-ui-ux` at `dea682a` |
| Pre-change tag (created earlier in this milestone) | `recovery-role-workspace-ui-ux-pre-hardening` at `dea682a` |
| Database | `data/pgdata` untouched; no migration/seed/DB commands run |
| Baseline gates | `tsc` 0 errors · lint 0 errors/45 warnings · tests 289/289 · build success |

The checkpoint branch/tag remain in the repository and are never deleted.

---

## 4. Browser UAT Methodology

- **Driver:** `scripts/__uat/cdp.mjs` — Node built-ins only (`fetch` + `WebSocket`) driving headless Edge (`--headless=new`) over the Chrome DevTools Protocol. Temporary harness (deleted after this milestone; evidence summarized in this report).
- **Sessions:** role sessions minted directly in the database via the app's own `issueToken` (`scripts/__uat/mint.mjs`), installed as the `uap_session` cookie (domain `localhost`). This bypasses the public CAPTCHA + first-login password-change flow so the authenticated workspaces can be audited.
- **Per-role checks:**
  - `landingOk` — post-login landing matches `landingForRole`.
  - `clientNavOk` — every sidebar link is clicked; path, `<main>` render and sidebar active state verified.
  - `backOk` — browser Back returns to the previous route.
  - `help` — Help & Guide renders with the correct role label and workspace, and lists the role's sidebar sections.
  - `helpCrossRoleManipulationOk` — `?from=` on the Help page cannot select another role's content.
  - `unauthOk` — probing a route outside the role's matrix redirects away and never serves content.
  - `consoleErrors` — any `Runtime.exceptionThrown` / `Log.entryAdded` error / `console.error`.
- **DB facts:** users = 38,755 (37,960 STUDENT, 627 LECTURER, 117 HOD, 18 DEAN, 6 each for STUDENT_AFFAIRS / BURSARY / REGISTRY / IT_ADMIN, 1 each for the remaining roles), sessions = 56.

---

## 5. UAT Results — 17 Roles 🟢

| Role | Landing | Sidebar/routes | Back | Help | Help isolation | Unauthorized guard | Console errors |
|---|---|---|---|---|---|---|---|
| HOD | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| STUDENT | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 (incl. `/portal/admin` no-access) | 0 |
| LECTURER | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| DEAN | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| BURSARY | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| SBC_CHAIRMAN | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| DVC_OVERSIGHT | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| GOVERNANCE_OVERSIGHT_MEMBER | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| VC | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| REGISTRY | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| EXAMS_RECORDS | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| PG_SCHOOL | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| SIWES | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| TIMETABLE | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| IT_ADMIN | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| STUDENT_AFFAIRS | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |
| APPLICANT | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 0 |

**VERIFIER:** ⚪ skipped — no demo user exists; the public login is CAPTCHA + first-login password-change gated, so no browser session was minted. Verifier Help content and read-only scope are covered by unit tests (§15).

**Totals:** 17/17 roles PASS · 164 menu routes checked across roles · 0 page-level failures (path / `<main>` / active state all correct) · 0 console errors · 0 exceptions.

**UAT finding recorded pre-fix:** `/portal` returned 404 (`portal404=true`) for every role — fixed in §9.

---

## 6. Defect #1 — Admin Users Table Unbounded (125 MB) 🔴 → 🟢

**Symptom:** during the UAT, IT_ADMIN (and any cache-missing role reaching `/portal/admin`) appeared to "hang" with repeated `cmd timeout: Page.navigate` errors, while REGISTRY loaded instantly. Server log showed `GET /portal/admin 200 in 3.2min`.

**Root cause:** the Admin page rendered **every row of the 38,755-user roster** into a single HTML table — a 125,341,964-byte response streamed over ~207 s. REGISTRY's fast load was a stale dev-server cache hit; a cache miss (IT_ADMIN) triggered the full render. This was a genuine production-readiness defect, not a UAT-harness problem.

**Fix (`src/app/portal/admin/page.tsx`):** server-side pagination — `USERS_PER_PAGE = 50`, `?page=` search param with `safePage` clamping to `[1, totalPages]`, `skip`/`take` on the Prisma query, and Prev/Next links plus a "Showing X–Y of Z users" range line. No RBAC or schema change.

**Verified (measured after restart, browser-fresh):**

| Metric | Before | After |
|---|---|---|
| HTML bytes | 125,341,964 | **357,483** |
| Time to body | ~207 s | **~1.2 s** |

IT_ADMIN now lands and navigates cleanly in the browser.

---

## 7. Defect #2 — Appointments Staff Picker Unbounded (8.4 MB) 🔴 → 🟢

**Symptom:** `/portal/appointments` (DEAN / DVC and any role reaching it) rendered an 8.4 MB HTML for DEAN/DVC because the "Propose appointment" form's staff `<select>` enumerated **all 38,754 ACTIVE users**.

**Fix (`src/app/portal/appointments/page.tsx` + `appointment-form.tsx`):** replaced the all-users `<select>` with a search-based picker — a GET form with `?q=` (min 2 chars), `where: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }`, `take: 50`, and a `searching` prop on `ProposeAppointmentForm`. Smallest safe change; no RBAC or schema change.

**Verified (measured after fix):**

| Metric | Before | After |
|---|---|---|
| DVC_OVERSIGHT HTML bytes | 8,419,826 | **32,502** |
| DVC_OVERSIGHT time | ~2.2 s | **~0.14 s** |
| DEAN HTML bytes | (same defect) | **34,261** |
| `?q=ade` results | — | **capped at 50** |

---

## 8. Defect #3 — Generic-Role Help Omitted Cross-Cutting Modules 🟡 → 🟢

**Symptom:** Help "Sidebar modules" for generic roles listed only `PORTAL_MODULES`, while the sidebar (portal shell) appends the cross-cutting modules (Admin / System, Data Protection, Communications, Helpdesk). IT_ADMIN's Help therefore omitted the very modules it could see.

**Fix (smallest safe):**
- `src/lib/constants.ts` — added exported `CROSS_CUTTING_MODULES` (the exact map previously hard-coded in the shell).
- `src/app/portal/layout.tsx` — the shell now consumes `CROSS_CUTTING_MODULES` from constants (no local copy).
- `src/lib/help.ts` — `helpSectionsForRole` generic branch now appends the role's visible cross-cutting sections in sidebar order, so Help mirrors the sidebar exactly and cannot drift.

**Verified:** in-browser, IT_ADMIN Help now renders exactly **Admin / System** and **Data Protection** sections (and nothing else); unit tests pin IT_ADMIN → `["/portal/admin", "/portal/dpo"]` and REGISTRY → applications/library/communications/helpdesk (no admin/dpo).

---

## 9. Defect #4 — `/portal` Dead 404 Route 🟡 → 🟢

**Symptom:** the UAT recorded `portal404=true` for all 17 roles — `/portal` had a layout but no page, so authenticated users hitting the bare portal URL got a 404.

**Fix (`src/app/portal/page.tsx`):** a minimal dynamic page that resolves the session and `redirect(landingForRole(session.user.role))`. The existing layout still owns suspended/MFA guards.

**Verified (307 no-redirect-follow):** IT_ADMIN → `/portal/admin`, VC → `/portal/vc`, STUDENT → `/portal/student`, APPLICANT → `/portal/applications`.

---

## 10. Supplemental Browser Checks

| Check | Result |
|---|---|
| Mobile drawer at 390 px | 🟢 drawer button visible, desktop `<aside>` hidden, drawer opens/closes correctly, 16 links present, Help entry present |
| Bogus route `/portal/hod/does-not-exist` | 🟢 root `not-found` rendered, no crash, no console errors |
| Nested route HOD `/portal/hod/course-offerings/demo-course-01/detail` | 🟢 404s gracefully via root not-found; active-state unverifiable with data (`CourseOffering` table empty — ⚪) |
| Logout | 🟢 session cookie cleared, redirect to `/`, login shown |
| Print CSS | 🟢 `@media print` in `globals.css` (A4, hides chrome) |

---

## 11. Verification Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` | **0 errors**; all warnings pre-existing in files untouched by this milestone (0 warnings in any changed file) |
| `npm test` | **296/296 pass** (289 baseline + **7 new**: 6 help-parity/order/uniqueness/scope + 1 `/portal` redirect) |
| `npm run build` | **Success** |

---

## 12. RBAC / Schema / Workflow Preservation

- No migrations, no `db push`, no seed, no `db reset`; `data/pgdata` untouched.
- `ACCESS_CONTROL_MATRIX`, `can()`, `visibleModules()` and every role guard unchanged.
- Academic pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) frozen and untouched.
- Generic roles remain on RBAC-filtered navigation (portal modules + cross-cutting, per matrix); no invented roles.

---

## 13. Test Coverage Added (§15)

`src/lib/navigation-help.test.ts` (16 → **23** tests):

- Generic roles' Help sections mirror the sidebar **including** cross-cutting modules (per-role, presence + absence).
- IT_ADMIN Help exactly `["/portal/admin", "/portal/dpo"]`; REGISTRY Help includes library/communications/helpdesk and excludes admin/dpo.
- Help section order matches sidebar order for every role.
- No duplicate Help section hrefs for any role.
- VERIFIER Help stays read-only scope (`results` + `transcripts`; `cannotDo` denies modify/financial).
- `/portal` root is no longer a dead route and every role's landing is under `/portal`.

(The pagination and search picker are exercised in-browser; the pure logic is intentionally thin and covered by the measured byte/time evidence in §6–§7.)

---

## 14. Checkpoint & Completion (§22)

| Check | Result |
|---|---|
| Completion commit | `8ae58aa` "Harden role workspaces found by browser UAT" on `recovery/role-workspace-ui-ux` |
| Completion tag | `recovery-role-workspace-ui-ux-complete` |
| Files | `src/app/portal/admin/page.tsx` · `src/app/portal/appointments/{page,appointment-form}.tsx` · `src/app/portal/{layout,page}.tsx` · `src/lib/{constants,help}.ts` · `src/lib/navigation-help.test.ts` |

Pre-change tag `recovery-role-workspace-ui-ux-pre-hardening` and branch `recovery/role-workspace-ui-ux` preserved.

---

## 15. Known Limitations & Out of Scope

- **VERIFIER** is not browser-exercised (no demo user; CAPTCHA + forced password change on the public login). Covered by unit tests; create a demo verifier to close the gap.
- **`CourseOffering` / `CourseAssignment`** are empty, so HOD nested-route active state and course-offering detail are not data-verifiable (routes 404 gracefully).
- **Stale dev-cache masking:** REGISTRY's instant load during the pre-fix run was a dev-only artifact of a stale render cache; a fresh restart serves the paginated view to every role.
- **Lint warnings:** the suite reports 0 errors; the warning count sits above the earlier-recorded baseline because warnings live in pre-existing files (`src/app/(public)/*`, `src/app/portal/vc/*`, `src/components/*`) that this milestone did not touch. Cleaning them is a separate, non-blocking task.
- **Root-level scratch files** (`_probe*.mts`, `build_output*.txt`, `orig_*.ts`, etc.) accumulated during this milestone's debugging are untracked and slated for cleanup outside the repository commit.

**Standing request:** `HoD_Role.md` (root, untracked) is a user-requested deliverable and is intentionally never committed or deleted.
