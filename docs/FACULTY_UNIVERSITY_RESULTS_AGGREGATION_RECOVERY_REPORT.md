# Faculty & University Results Aggregation — Recovery Report

**Date:** 2026-08-16
**Milestone:** Faculty & University results aggregation recovery (HoD → Dean → SBC → DVC/Governance → VC).
**Mode:** Recovery — READ-ONLY audit plus minimal, additive application repairs. **No schema, migration, database, seed or RBAC changes were made.** No `prisma migrate reset` / `prisma db push` / `prisma migrate dev` / seed was run. All data in the persistent `data/pgdata` cluster was preserved.
**Auditor scope:** The Faculty/University aggregation slice built on top of the (already recovered) HoD → Lecturer result-delivery chain: the Dean workspace results, the SBC (Senate Business Committee) results, the DVC/Governance oversight and exceptions outputs, and the VC executive overview — plus the shared aggregation helpers that feed all of them.
**Related prior audits:** `docs/LECTURER_COURSE_DELIVERY_RESULT_RECOVERY_AUDIT.md`, `docs/END_TO_END_ACADEMIC_WORKFLOW_MILESTONE.md`, `docs/EXECUTIVE_GOVERNANCE_RECOVERY_AUDIT.md`, `docs/GLOBAL_ROLE_WORKSPACE_NAVIGATION_RECOVERY_REPORT.md`.
**Commands run this session:** `npx tsc --noEmit` (clean), `npm run lint` (0 errors), `npm test` (all **266** pass), `npm run build` (success), plus read-only source reads/greps. The embedded PostgreSQL cluster was started (`scripts/start-db.ts`) for the integration suite.

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not exercised in this run

---

## 1. Executive Summary

The Faculty/University aggregation slice is **structurally complete and healthy**. The full chain — HoD departmental results (current-session, stage counts) → Dean faculty oversight and return → SBC Senate scrutiny → DVC/Governance university-wide monitoring and exceptions → VC executive read — exists as real server actions and pages with server-side authorization, and the pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) is enforced by the recovered `approveResult` / `returnResult` / `finaliseResult` actions.

The slice was **not fully consistent** on one axis and **not cleanly rendered** on another. Two real defects were found and repaired, both application-level and additive:

| # | Defect | Severity | Status |
|---|---|---|---|
| 1 | The university/faculty aggregation was **not in lock-step across roles**: the HoD views counted only the current session (via `getResultPipelineStats` / `getDepartmentAcademicStats`), but the Dean (`facultyStats.results`, `facultyDepartmentOverview.pendingResults`), SBC (raw `groupBy`), DVC/Governance (`governanceStats.results`, `resultsPipeline`) and VC (`resultsPipeline`) counted **every academic session**. The VC results page also mixed scopes (academic overview current-session, pipeline all-session). | P1 | 🔴 → 🟢 **REPAIRED** |
| 2 | **Double-encoded UTF-8 mojibake** (`â€”` / `â†’` instead of `—` / `→`) across the whole DVC workspace — 15 occurrences in 9 files under `src/app/portal/dvc/`. | P2 | 🟡 → 🟢 **REPAIRED** |

The fix for Defect 1 makes **`getResultPipelineStats` the single source of truth for pipeline stage counts** at every level (university, faculty, department, course) and scopes every dashboard roll-up to `CURRENT_SESSION` / `CURRENT_SEMESTER`. The DVC/Governance `resultsPipeline` now delegates its stage counts to that shared helper instead of running its own all-session `groupBy`.

**Regression status:** `tsc` clean, ESLint 0 errors, all **266 tests pass** (2 new: TESTS 58–59 in `src/lib/academic-workflow.test.ts`), production build succeeds. No existing behaviour was weakened.

---

## 2. Scope

- HoD departmental results & statistics — **verified only** (already current-session scoped).
- Dean workspace results — faculty aggregation repaired.
- SBC workspace results (dashboard + results page) — pipeline repaired.
- DVC/Governance workspace — `governanceStats.results` + `resultsPipeline` repaired; mojibake repaired.
- VC workspace results — pipeline + copy repaired.
- Shared helpers `getResultPipelineStats`, `getUniversityAcademicStats`, `facultyStats`, `governanceStats` — scoping verified.
- RBAC matrix, guards (`requireSbcChairman`, `requireVC`, `requireGovernanceOversight`), navigation menus — **verified only, unchanged**.

Out of scope (unchanged, verified only): `approveResult` / `returnResult` / `finaliseResult` / `submitGrade` action logic; the audit-hash chain; `ModuleActions` result actions; bursary, admissions, PG, research, helpdesk aggregates.

---

## 3. Baseline (pre-milestone, verified)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ 0 errors (49 pre-existing warnings) |
| `npm test` | ✅ 264 pass / 0 fail (17 files) |
| `npm run build` | ✅ success |
| DB smoke | ✅ `{ users: 38755, results: 6, applications: 1 }` |

Pipeline stages verified in code: `RESULT_STAGE_ORDER = ["SUBMITTED", "HOD_APPROVED", "SENATE_APPROVED", "FINAL"]`; **no `DEAN_APPROVED`** anywhere in active `src/` (the only `HOD_DEAN` / `DEAN_APPROVED` references live in `orig_constants.txt` / `orig_constants.ts` backups and docs, not in running code).

---

## 4. Architectural Rules (non-negotiable, reaffirmed)

1. **Scopes are server-side and session-derived.** No client-supplied scope is ever trusted; every roll-up defaults to `CURRENT_SESSION` / `CURRENT_SEMESTER`.
2. **RBAC is not weakened.** All authorization flows through `can()` / `permissionsFor()` / `visibleModules()`; no role strings or matrix entries changed.
3. **The pipeline is `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`.** No intermediate Dean stage exists or was introduced.
4. **Aggregation must be in lock-step.** The same quantity (pipeline stage counts) must be identical at HoD, Dean, SBC, DVC and VC level for the same scope.
5. **No schema, migration, seed or RBAC changes.** Repairs are additive application code only.

---

## 5. What Changed — Lock-step session scoping (`src/lib/governance.ts`)

**Before:** `governanceStats()` grouped all `Result` rows by `gradeStatus` with **no session/semester filter** (every session since the database was restored counted). `resultsPipeline()` did the same via its own raw `groupBy` plus an all-session pending list.

**After:**
- `governanceStats()` groups results filtered to `{ academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER }`.
- `resultsPipeline()` now builds `stages` / `total` from **`getResultPipelineStats()`** (the shared helper already used by the HoD views) and scopes its pending list to the current session. The `ResultsPipeline` shape is unchanged, so SBC/VC consumers render the same fields.
- `RESULT_STAGE_ORDER` is preserved as a `string[]` (the demo script still checks `.includes("DEAN_APPROVED")`), with an explicit cast to `PipelineStage` at the map site.

---

## 6. What Changed — Dean faculty scoping (`src/lib/faculty.ts`)

**Before:** `facultyStats().results` grouped the faculty's results across **all sessions**; `facultyDepartmentOverview()` listed pending results without a session filter.

**After:** both are scoped to `CURRENT_SESSION` / `CURRENT_SEMESTER`, matching the HoD departmental statistics (`getDepartmentAcademicStats`) that already scope to the current session.

---

## 7. What Changed — SBC dashboard & results page

**`src/app/portal/sbc/page.tsx`** — the dashboard's `resultsByStatus` was a raw `prisma.result.groupBy` (all sessions). Now it calls **`getResultPipelineStats()`**; `pipelineTotal` uses `.total` and `gradeStatus` uses `.byStage`, and the note text renders the helper's `academicSession` / `semester` context.

**`src/app/portal/sbc/results/page.tsx`** — the four stage cards now come from `getResultPipelineStats()`; the recent list and total are session-scoped; the page description names the current session/semester. The `statusCount` helper is retained for the stage cards.

---

## 8. What Changed — VC executive overview

**`src/app/portal/vc/results/page.tsx`** — the `outstandingCounts` list was an all-session query; it is now session-scoped. The header description and the Total Results hint name the current session, and unused imports (`Link`, `EXCEPTION_SEVERITY_LABELS`, `EmptyState`) were removed.

**`src/app/portal/vc/academic/page.tsx`** — unchanged (its academic overview was already current-session via `getUniversityAcademicStats`); verified.

---

## 9. What Changed — Dean results page

**`src/app/portal/dean/results/page.tsx`** — the recent results list was all-session; it is now scoped to `CURRENT_SESSION` / `CURRENT_SEMESTER` (importing both constants). The description and the "Grade pipeline" subtitle name the current session. `return-result-button.tsx` is untouched.

---

## 10. What Changed — DVC workspace mojibake (P2)

Double-encoded UTF-8 (`â€”`/`â†’` where `—`/`→` were intended) across the DVC workspace. Repaired **15 occurrences in 9 files** under `src/app/portal/dvc/`:

| File | Occurrences fixed |
|---|---|
| `academic/page.tsx` | description, "Export pipeline →", 2 table-cell fallbacks |
| `admissions/page.tsx` | table-cell fallback |
| `audit/page.tsx` | "Chain verification FAILED — investigate" hint + table-cell fallback |
| `communications/page.tsx` | description |
| `exceptions/page.tsx` | description |
| `postgraduate/page.tsx` | SectionHeading subtitle |
| `reports/page.tsx` | table-cell fallback |
| `staff/page.tsx` | 3 table-cell fallbacks |
| `students/page.tsx` | description + 2 table-cell fallbacks |
| `university-overview/page.tsx` | description |

Confirmed: `grep "â€" src/` → **0 matches** after repair.

---

## 11. What Changed — Shared helpers (`src/lib/academic-stats.ts`)

No behavioural change to the shared helpers themselves (they already scoped to `CURRENT_SESSION`/`CURRENT_SEMESTER` by default). Their role is now formalised: **`getResultPipelineStats` is the single source of truth** that HoD, Dean, SBC, DVC/Governance and VC all delegate to for pipeline stage counts.

---

## 12. Test Plan — Aggregation scoping (TESTS 58–59)

- **TEST 58 — session-scoped aggregation excludes results from other sessions.** Creates a `Result` for a fixture course in session `2024/2025`, semester 2, status `SUBMITTED`; verifies the row exists via a raw cross-session `groupBy` (count 1); verifies `getResultPipelineStats({}, { course: { code: fx.CS } })` is byte-identical to a baseline captured before creation (proving the cross-session row is excluded by the session filter); deletes the row in `finally`.
- **TEST 59 — `resultsPipeline` stays in lock-step with the shared pipeline helper.** Wraps `getResultPipelineStats` in a spy (pass-through by default) via a partial `vi.mock("./academic-stats")`, stubs one call to a fixed `ResultPipelineStats`, and asserts `resultsPipeline()` produces identical `stages` and `total` — guarding against a regression to an independent all-session `groupBy`.

The cross-session row is created and deleted **inside** TEST 58, so it can never leak into TEST 34's `governanceExceptions` deltas or the `afterAll` cleanup.

---

## 13. Test Results

| Suite | Result |
|---|---|
| `src/lib/academic-workflow.test.ts` (TESTS 1–59) | ✅ 59 pass / 0 fail |
| All suites (`npm test`) | ✅ **266 pass / 0 fail** (17 files) |
| New this milestone | ✅ TESTS 58–59 |

---

## 14. Verification Gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (0 errors) |
| `npm run lint` | ✅ 0 errors (46 pre-existing warnings; was 49 — 3 unused imports removed from `vc/results`) |
| `npm test` | ✅ **266 pass / 0 fail** (was 264; +2 new) |
| `npm run build` | ✅ success |
| `grep "â€" src/` | ✅ 0 matches |
| `grep "HOD_DEAN\|DEAN_APPROVED" src/` | ✅ 0 matches (active code) |

---

## 15. Regression Safety

- All 264 pre-existing tests still pass — including the Dean return, SBC read-only, Governance monitoring and VC oversight suites that exercise the aggregation surfaces.
- The new spy wraps `getResultPipelineStats` with pass-through semantics; no other test's counts are affected.
- TESTS 58–59 create and delete their own rows; `afterAll` residue was re-verified at zero.

---

## 16. RBAC — Unchanged

- `ACCESS_CONTROL_MATRIX` in `src/lib/constants.ts`: **not modified**.
- Role strings and menu maps: **not modified**. `HOD_MENU` / `DEAN_MENU` / `VC_MENU` / `BURSARY_WORKSPACE` recovered in the navigation milestone remain intact; SBC/DVC still fall back to generic `PORTAL_MODULES` (unchanged, documented limitation).
- No new roles, no new permissions, no `DEAN_APPROVED` stage, no committee changes.
- Guards verified (read-only): `requireSbcChairman` (role `SBC_CHAIRMAN`), `requireVC` (role `VC`), `requireGovernanceOversight` (active `CommitteeMembership` on `GOVERNANCE_OVERSIGHT`).

---

## 17. Boundaries Intact

- HoD approvals queue (`hod/approvals`) — unchanged, still department-scoped.
- Exams & Records university-wide actions — unchanged.
- DEAN / SBC / DVC / GOV read posture on results — unchanged (aggregation only, no new write powers).
- VC workspace read-only posture — unchanged.
- `CourseOffering` (registrability) vs `CourseAssignment` (teaching authority) — unchanged.

---

## 18. Database Safety Confirmation

- **NO schema changes.**
- **NO migrations created or applied.**
- **NO `db:push` / `db:reset` / `db seed` / `db migrate` executed.**
- Only application code + tests changed; tests create and fully remove their own rows (verified: zero residue after the suite).

---

## 19. Pipeline & Scope Verification (summary matrix)

| # | Surface | Session scope after fix | Source of truth | Tests | Status |
|---|---|---|---|---|---|
| 1 | HoD departmental stats | current session | `getResultPipelineStats` / `getDepartmentAcademicStats` | 48 | 🟢 |
| 2 | Dean `facultyStats.results` / pending | current session | `getResultPipelineStats` + session filter | — | 🟢 |
| 3 | SBC dashboard + results page | current session | `getResultPipelineStats` | 30–32 | 🟢 |
| 4 | DVC `governanceStats.results` | current session | session-scoped groupBy | 33–35 | 🟢 |
| 5 | DVC `resultsPipeline` (SBC/VC dashboard feed) | current session | delegates to `getResultPipelineStats` | 58–59 | 🟢 |
| 6 | VC `outstandingCounts` + copy | current session | session-scoped query | 36–38 | 🟢 |

---

## 20. Remaining Findings (deferred, not fixed)

- **F4 🟡** Sidebar "Results" bounces DEAN/SBC/DVC/GOV to dashboard — navigation limitation, unchanged from prior milestones.
- **F5 🟡** SBC/DVC workspace discoverability still falls back to generic `PORTAL_MODULES` (no dedicated menu map) — unchanged, documented.
- **F3 🟡** Post-login landing ignores `landingForRole()` — UX, unchanged.
- **F6 🟡** No centralized route authorization (`middleware.ts`) — defense in depth, unchanged.
- **F7 🟡** CHAIRMAN vs MEMBER designations grant identical powers — product decision, unchanged.

---

## 21. FACULTY & UNIVERSITY RESULTS AGGREGATION RECOVERY STATUS: **COMPLETE**

- **TypeScript:** `npx tsc --noEmit` — **0 errors** ✅
- **Lint:** `npm run lint` — **0 errors** (46 pre-existing warnings, none in changed files) ✅
- **Tests:** `npm test` — **266 pass / 0 fail** (17 files; TESTS 58–59 new) ✅
- **Build:** `npm run build` — **success** ✅
- **Defects fixed:** session-scope lock-step across Dean/SBC/DVC/VC aggregation (P1); 15 DVC mojibake occurrences (P2).
- **Database:** untouched — no schema, migration, seed or RBAC changes; zero test residue.
