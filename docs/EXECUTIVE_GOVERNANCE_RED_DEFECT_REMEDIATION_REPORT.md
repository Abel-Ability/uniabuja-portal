# Executive & Governance RED Defect Remediation — Audit Report

**Milestone:** Executive & Governance Recovery — RED Defect Remediation
**Date:** 15 Aug 2026
**Source of truth:** `docs/EXECUTIVE_GOVERNANCE_FUNCTIONAL_UAT_REPORT.md` (F1 + F2)
**Status:** COMPLETE — both RED defects remediated, gates green

---

## 1. Executive Summary

The Functional UAT surfaced two RED (high) defects in the Executive &
Governance workspace:

- **F1 — Cross-department result approval**: an HOD/HOD_DEAN could approve
  `SUBMITTED` results for courses belonging to *any* department, because
  neither `approveResult` nor the shared `/portal/results` HOD branch enforced
  a departmental boundary.
- **F2 — VC Reports CSV download 404**: every "Download CSV" link on
  `/portal/vc/reports` pointed at `/api/portal/vc/reports/…` — a route that
  does not exist.

Both are now fixed **in application code only**:

1. `approveResult` rejects any result whose course is not allocated to the
   HOD's own department (server-side, session-derived scope — cannot be
   bypassed by ID manipulation).
2. The shared `/portal/results` HOD branch and its appeal queue are scoped to
   the HOD's department via the same `departmentCourseCodes` boundary the
   existing HOD approvals queue already uses.
3. `reviewAppeal` rejects HODs reviewing appeals filed by students outside
   their own department (the Exams & Records unit keeps the full register).
4. A new guarded `/portal/vc/reports/export` CSV export route mirrors the DVC
   export (VC-only, slug-validated, audit-trailed); the reports page now links
   to it.

Security/functional regression coverage was added (12 new integration tests,
TESTS 1–12). All verification gates pass: `tsc` 0 errors, `lint` 0 errors
(41 pre-existing warnings unchanged), `npm test` 16 files / 207 tests
(195 baseline + 12 new), `npm run build` succeeds.

**No database schema changes. No migrations. No `db:push`/`db:reset`/`db seed`
re-runs. No RBAC matrix changes. No role-string changes. No account changes.**
The result pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) is
unchanged and verified intact.

---

## 2. Scope

In scope (the two RED defects only):

| Item | RED defect | Target |
|---|---|---|
| `src/lib/module-actions.ts` — `approveResult` | F1 | Server-side HOD department scope |
| `src/lib/module-actions.ts` — `reviewAppeal` | F1 | Server-side HOD appeal scope (defense in depth) |
| `src/app/portal/results/page.tsx` — HOD branch | F1 | Scope pending pipeline + appeal queue to HOD department |
| `src/lib/hod.ts` | F1 | Reusable scoped-query helpers (page + tests share them) |
| `src/app/portal/vc/reports/export/route.ts` (new) | F2 | VC CSV export route |
| `src/app/portal/vc/reports/page.tsx` | F2 | Point "Download CSV" at the new route |
| `src/lib/executive-recovery.test.ts` (new) | F1/F2 | TESTS 1–12 regression coverage |

Out of scope (explicitly **not** touched — all yellow/⚪ findings):
F3, F4, F5, F6, F7, F9, F10, and the F8 leftovers not already covered by the
new tests (see §17).

---

## 3. Baseline (pre-remediation, verified)

- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors, **41 warnings** (pre-existing).
- `npm test`: 15 files / 195 tests passing.
- `npm run build`: succeeds.
- Live demo DB: 0 `CourseAssignment` rows; demo roles MFA disabled
  (`mfaEnabled: false` → no step-up block in tests).
- No `middleware.ts`; authorization is per-page/per-action (unchanged, F6).

---

## 4. What Changed

### 4.1 Defect 1A — `approveResult` server-side departmental scope

`src/lib/module-actions.ts` (`approveResult`):

- Loads the result with `include: { course: true }`.
- After the existing `can(role, "EXAMS_RECORDS", "A")` + `stepUpGuard`
  checks, and **before any mutation or audit**, if the actor is an HOD role
  (`isHodRole`):
  - requires `session.user.department` (else clear error);
  - computes `departmentCourseCodes(session.user.department)` and rejects with
    `"You can only approve results for courses in your own department."` when
    the result's course code is not in that set.
- Rejected attempts perform **no DB mutation and no success audit**.
- The stage machine is untouched: HOD still moves `SUBMITTED → HOD_APPROVED`;
  EXAMS_RECORDS still moves `HOD_APPROVED → SENATE_APPROVED` (`published: true`);
  no `DEAN_APPROVED` stage introduced.

Rationale for scope source: `departmentCourseCodes` is the database-backed,
session-derived boundary **already used by the HOD approvals queue**
(`hod/approvals/page.tsx`) and the shared page, so the action and the views
cannot disagree. `courseInDepartmentCatalogue` (network-backed Google Sheet)
remains the scope for course-offering work and was deliberately not added to
the approval path — it would make a grade-approval authorization depend on a
live network fetch and could diverge from the allocation-derived queue.

### 4.2 Defect 1B — shared `/portal/results` HOD branch scoped

`src/app/portal/results/page.tsx`:

- The HOD branch now uses two new helpers in `src/lib/hod.ts`:
  - `hodPendingResultRows(user, { take })` — `SUBMITTED` results restricted to
    `course.code in departmentCourseCodes(user.department)` (returns `[]` when
    the HOD has no department), exactly matching the approvals-queue scope.
  - `hodScopedAppeals(user, { take })` — appeals restricted to
    `user.department === user.department` (the filing student's department).
- The EXAMS_RECORDS branch is unchanged (full `HOD_APPROVED` pipeline and
  full appeal register — that unit owns the university-wide view).

### 4.3 Defect 1C — `reviewAppeal` HOD scope (defense in depth)

`src/lib/module-actions.ts` (`reviewAppeal`):

- Loads the appeal with `include: { user: { select: { department: true } } }`.
- If the actor is an HOD role, rejects with
  `"You can only review appeals from students in your own department."` when
  the filing student's department differs from the HOD's. EXAMS_RECORDS is
  unaffected. Rejected attempts perform no mutation and no audit.

### 4.4 Defect 2 — VC Reports CSV export route

`src/app/portal/vc/reports/export/route.ts` (new) mirrors the DVC export:

- `GET(req)` → `requireVC()` (403 on redirect/failure) →
  `slug = searchParams.get("report")` → `buildGovernanceReport(slug)` (404
  `UNKNOWN_REPORT` for missing/unknown slugs) → `governanceCsv(columns, rows)`
  → `writeAudit({ action: "EXPORT", module: "GOVERNANCE", targetType:
  "REPORT", targetId: slug, … })` → `200 text/csv` with `Content-Disposition`
  attachment and `no-store`.

`src/app/portal/vc/reports/page.tsx`:

- `Download CSV →` links changed from the dangling
  `/api/portal/vc/reports/${r.slug}.csv` to
  `/portal/vc/reports/export?report=${r.slug}`.

The DVC export route was **not modified** (verified still functional, TEST 12).

---

## 5. Test Plan — TESTS 1–12

New integration suite: `src/lib/executive-recovery.test.ts` (seeded sessions,
fixture create-and-cleanup harness following `module-actions.smoke.test.ts`;
self-contained: creates courses `TESTHOD001–004`, assignments, results,
students, appeals; deletes every fixture + session + audit row in `afterAll` —
verified zero residue after the run).

| Test | Scenario | Expected |
|---|---|---|
| TEST 1 | HOD approves own-department `SUBMITTED` result | `ok`, status `HOD_APPROVED`, approver stamped |
| TEST 2 | HOD cross-department approval | rejected (`/own department/`), no mutation, no success audit |
| TEST 3 | Direct server-action invocation of cross-dept approval | rejected (same boundary holds without the UI) |
| TEST 4 | Lecturer / Dean / Student attempt `approveResult` | rejected (`/cannot approve/`) |
| TEST 5 | `hodPendingResultRows` for Computer Science | own-dept `SUBMITTED` rows only; no other-dept / unallocated / already-approved rows |
| TEST 6 | ID/course manipulation (unallocated course + other-dept result) | both rejected; both rows stay `SUBMITTED` |
| TEST 7 | Pipeline transitions intact | HOD double-approve → `Not ready for your approval`; EXAMS advances `HOD_APPROVED → SENATE_APPROVED` (`published: true`) |
| TEST 8 | HOD appeal queue + review scoped | queue shows own-dept appeal only; HOD cross-dept review rejected (no mutation); own-dept review `UNDER_REVIEW`; EXAMS can still review cross-dept |
| TEST 9 | VC CSV export | 200, `text/csv`, header present, audit row written |
| TEST 10 | Non-VC roles (Dean, SBC) hit VC export | 403 |
| TEST 11 | Unknown report slug | 404 |
| TEST 12 | DVC governance export regression | `gov@` → 200 CSV; `bursary@` → 403 |

---

## 6. Test Results

```
Test Files  16 passed (16)      (was 15)
     Tests  207 passed (207)    (was 195; +12 new)
```

All new tests pass; all 195 pre-existing tests still pass (no regression).

---

## 7. Verification Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 41 warnings (pre-existing baseline unchanged) |
| `npm test` | 16 files / 207 tests passing |
| `npm run build` | succeeds; `/portal/vc/reports/export` present in route table |

---

## 8. Regression Safety

- HOD Course Offerings (catalogue-scoped via `courseInDepartmentCatalogue`):
  untouched.
- Student Registration finalisation/locking, Bursary, Fees, Transcripts,
  Clearance smoke tests: untouched and still green.
- Result pipeline stage order and `published` semantics: unchanged (TEST 7).
- `returnResult`, senate actions, SBC workflow: untouched.
- DVC governance export: untouched, still green (TEST 12).
- Login/redirect flow and guards: untouched.

---

## 9. RBAC — Unchanged

- `ACCESS_CONTROL_MATRIX` in `src/lib/constants.ts`: **not modified**.
- Role strings (`HOD`, `HOD_DEAN`, `EXAMS_RECORDS`, `VC`, …): **not modified**.
- No `DEAN_APPROVED` stage, no new roles/permissions, no committee changes.
- All authorization still flows through `can()`, `isHodRole()`,
  `stepUpGuard`/`requireStepUp`, `requireVC`, `requireGovernanceOversight`.

---

## 10. Database Safety Confirmation

- **NO schema changes.**
- **NO migrations created or applied.**
- **NO `db:push` / `db:reset` / `db seed` / `db migrate` executed.**
- Only application code + tests changed; tests create and fully remove their
  own rows (verified: 0 `TESTHOD*` courses/results/assignments, 0 temp users,
  appeals, sessions, or audit rows remain after the suite).

---

## 11. Boundaries Intact

- HOD approvals queue (`hod/approvals`) — unchanged, still dept-scoped.
- Exams & Records university-wide view — unchanged.
- VC workspace read-only posture — unchanged (export route is a GET that only
  produces CSV from existing reports; it adds an audit row per export, which is
  the intended and existing DVC behaviour).
- DEAN / SBC / DVC / GOV access to `/portal/results` — unchanged (still
  redirected to dashboard; that is F4, out of scope).

---

## 12. Remaining Findings (deferred, not fixed)

Not addressed in this milestone (out of scope by design — all yellow/⚪):

- **F3 🟡** Post-login landing ignores `landingForRole()` — UX.
- **F4 🟡** Sidebar "Results" bounces DEAN/SBC/DVC/GOV to dashboard — navigation.
- **F5 🟡** Dead `VC_MENU`, `/portal` + `/portal/students` 404s — dead code.
- **F6 🟡** No centralized route authorization (no `middleware.ts`) — defense in depth.
- **F7 🟡** CHAIRMAN vs MEMBER designations grant identical powers — product decision.
- **F8 🟡** Action-level negative tests for `createCourseOffering` /
  `assignCourse` / `returnResult` / senate actions — partially addressed:
  `approveResult` (F1) and `reviewAppeal` negatives are now covered by TESTS
  2/3/4/6/8; the other executive write actions remain uncovered.
- **F9 🟡** SBC workspace discoverability — UX.
- **F10 ⚪** Interactive UI walkthrough not executed (requires authorized live
  test data / running server).

---

## 13. Recommended Next Milestone

1. **P2 — F4**: route each of DEAN/SBC/DVC/GOV from the sidebar "Results" entry
   to its own results surface (or hide the entry for roles with no branch).
2. **P2 — F3**: post-login redirect to `landingForRole(user.role)`.
3. **P3 — F5/F6**: remove `VC_MENU` dead code, add `/portal` redirect, and
   introduce centralized route↔role authorization (middleware or layout
   segment).
4. **P3 — F8 remainder**: action-level negative tests for
   `createCourseOffering`, `assignCourse`, `returnResult`, and senate actions.
5. **P3 — F7/F9**: product decision on Chairman powers; SENATE sidebar entry.
6. **F10**: interactive UI walkthrough of the remediated HOD pipeline, appeal
   queue, and VC reports download with authorized temporary test data.

All of the above remain application-code/test-only; no schema or RBAC changes
required.
