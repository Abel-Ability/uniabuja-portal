# End-to-End Academic Workflow — UAT & Integration Recovery Report

**Date:** 2026-08-16
**Milestone:** End-to-End Academic Workflow UAT & Integration Recovery — HOD → CourseOffering → CourseAllocation → Student Registration → Lecturer Delivery → HOD Approval → Dean → SBC → DVC/Governance → VC, with security + atomicity integration coverage and a session-scoped lock-step pipeline.
**Mode:** Recovery — UAT verification of the full workflow plus minimal, additive application repairs. **No schema, migration, database, seed or RBAC changes were made.** No `prisma migrate reset` / `prisma db push` / `prisma migrate dev` / seed was run. All data in the persistent `data/pgdata` cluster was preserved.
**Auditor scope:** The complete academic workflow as recovered across the prior milestones — CourseOfferings, CourseAssignment, student registration, lecturer CSV result posting, HOD approval, Dean faculty aggregation, SBC Senate scrutiny, DVC/Governance oversight, VC executive overview — plus the §16 security and §17 atomicity integration matrixes and the lock-step pipeline guarantee.
**Related prior audits:** `docs/FACULTY_UNIVERSITY_RESULTS_AGGREGATION_RECOVERY_REPORT.md`, `docs/END_TO_END_ACADEMIC_WORKFLOW_MILESTONE.md`, `docs/EXECUTIVE_GOVERNANCE_RED_DEFECT_REMEDIATION_REPORT.md`, `docs/LECTURER_COURSE_DELIVERY_RESULT_RECOVERY_AUDIT.md`, `docs/GLOBAL_ROLE_WORKSPACE_NAVIGATION_RECOVERY_REPORT.md`.
**Commands run this session:** `npx tsc --noEmit` (clean), `npm run lint` (0 errors, 46 pre-existing warnings), `npm test` (all **273** pass), `npm run build` (success), plus read-only source reads/greps and an idempotent test-residue cleanup (see §23). The embedded PostgreSQL cluster was started (`scripts/start-db.ts`) for the integration suite.

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not exercised in this run

---

## 1. Executive Summary

The complete academic workflow — from HOD course offering and allocation, through student registration, lecturer result delivery, HOD approval, Dean faculty aggregation, SBC Senate scrutiny, DVC/Governance oversight, to the VC executive read — is **structurally complete, authorized end to end, and provably consistent** across every aggregation surface. All 20 pipeline stages are reachable, the pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) is immutable after finalisation, and every roll-up is scoped to `CURRENT_SESSION` / `CURRENT_SEMESTER` in lock-step.

This milestone adds the UAT evidence layer that was previously open:

| # | Verification gap | Resolution | Tests |
|---|---|---|---|
| 1 | §16#1 — HOD accessing another department's CourseOffering | New negative coverage (create + status toggle) | TEST 60 |
| 2 | §16#12 — client-supplied scope override on the lecturer CSV path | New negative coverage (bogus session/semester, zero writes) | TEST 61 |
| 3 | §17#2 — result-batch atomicity (unauthorized / fully-invalid batch writes nothing) | New negative coverage | TEST 62 |
| 4 | §17#3 — HOD mixed-authz approval must not mutate (gradeStatus / approver / audit) | New no-mutation + no-audit assertions | TEST 63 |
| 5 | §16#10 — governance guard (membership boundary) | New positive/negative coverage of `requireGovernanceOversight` | TEST 64 |
| 6 | Lock-step aggregation end to end (course→dept→faculty→university pipeline + governance, controlled dataset, historical exclusion, ground-truth equality) | New controlled end-to-end dataset | TEST 65 |
| 7 | Dean cannot approve (pipeline ownership) | New negative coverage | TEST 66 |

All 12 §16 security items and all 4 §17 atomicity items are now covered by integration tests. **No application-level workflow defect was found that required a repair** — every surface behaved per the recovered contract. Two test-defect repairs and one trivial lint hygiene fix were made (see §17, §19).

**Regression status:** `tsc` clean, ESLint 0 errors (46 pre-existing warnings — baseline restored), all **273 tests pass** (266 baseline + 7 new: TESTS 60–66), production build succeeds, zero test residue.

---

## 2. Scope

- STEP 1 — HOD Course Offerings (`createCourseOffering` / `setCourseOfferingStatus`) — verified + new negative tests (TEST 60).
- STEP 2 — HOD Course Allocation (`assignCourse`) — verified (TESTS 1–6).
- STEP 3 — Student Course Registration (`registerCourse` / finalisation) — verified (TESTS 7–15, student-registration suite).
- STEP 4 — Lecturer Result Submission (CSV path) — verified + new negative tests (TESTS 61–62).
- STEP 5 — HOD Result Approval (`approveResult`) — verified + new no-mutation assertions (TEST 63).
- STEP 6 — Dean Faculty Results (`facultyStats`, return) — verified + new negative (TEST 66).
- STEP 7 — SBC University Results — verified (TESTS 30–32).
- STEP 8 — DVC/Governance Oversight — verified + new guard test (TEST 64).
- STEP 9 — VC Executive Results — verified (TESTS 36–38).
- STEP 10 — Lock-step session-scoped aggregation — new controlled end-to-end dataset (TEST 65).
- §16 Security matrix — full integration coverage closed.
- §17 Atomicity matrix — full integration coverage closed.
- Navigation findings F3/F4/F5/F6 — inspected and documented (see §25).

Out of scope (unchanged, verified only): audit-hash chain internals; bursary / admissions / PG / research / helpdesk aggregates; interactive browser-level walkthrough (F10).

---

## 3. Baseline (pre-milestone, verified)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ 0 errors (46 pre-existing warnings) |
| `npm test` | ✅ 266 pass / 0 fail (17 files) |
| `npm run build` | ✅ success |
| DB smoke | ✅ `{ users: 38755, results: 6, applications: 1 }` |

Pipeline verified in code: `RESULT_STAGE_ORDER = ["SUBMITTED", "HOD_APPROVED", "SENATE_APPROVED", "FINAL"]`; **no `DEAN_APPROVED`** anywhere in active `src/`. `getResultPipelineStats()` is the single source of truth for pipeline counts; `resultsPipeline()` delegates to it.

---

## 4. Architectural Rules (non-negotiable, reaffirmed)

1. **`CourseOffering` = registrability; `CourseAssignment` = teaching authority.** Never cross-used.
2. **Scopes are server-side and session-derived.** No client-supplied identity/scope field is ever trusted.
3. **RBAC is not weakened.** All authorization flows through `can()` / `isHodRole()` / `stepUpGuard()` / `requireStepUp()` / `requireGovernanceOversight()` / `requireVC()` / `requireSbcChairman()`; no role strings or matrix entries changed.
4. **The pipeline is `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`.** No Dean approval stage exists or was introduced.
5. **Aggregation must be in lock-step.** The same quantity (pipeline stage counts) must be identical at department, faculty and university level for the same scope.
6. **No schema, migration, seed or RBAC changes.** Repairs are additive application code only.

---

## 5. STEP 1 — HOD Course Offerings 🟢

Verified in `src/lib/module-actions.ts` (`createCourseOffering`, `setCourseOfferingStatus`, ~2360–2500):

- HOD-only (`can(role, "EXAMS_RECORDS", "A")`) + `stepUpGuard` (passes for the non-MFA demo fixtures).
- The offering is bound to the HOD's own department and **must** exist in the department catalogue (`courseInDepartmentCatalogue` over the mocked sheet's `getCoursesUG`) → `"You can only create offerings in your own department."`
- Session validated against `academicSessions()`; levels validated against `departmentLevels(departmentMaxLevel(department))` ("Computer Science" max 400 → 100–400); duplicate offering per session/semester/level prevented; audit written on create and toggle.

**New evidence (TEST 60):** HOD creates and toggles an offering for `C_CS` at level 200 (action ok); non-HOD rejected; a `C_ENG` offering from the HOD_CS session rejected (`own department`); toggling a `C_ENG` offering rejected.

---

## 6. STEP 2 — HOD Course Allocation 🟢

Verified (TESTS 1–6): `assignCourse` derives faculty/department from the HOD session, requires catalogue membership, main lecturer must be `LECTURER` in the same department, co-lecturers deduplicated and validated, team re-created to match the form, `courseTitle` read from the database (client fields ignored). Non-HOD → `/Heads of Department/`; other-department main/co → rejected with no mutation.

---

## 7. STEP 3 — Student Course Registration 🟢

Verified (TESTS 7–15 + `student-registration.test.ts`): registration gated by ACTIVE offering, matching level, matching programme, capacity (waitlist), prerequisite; tampered `courseId` rejected; finalisation creates an immutable header (`CR-\d{4}-\d{6}`, `FINALIZED`, `totalUnits ≥ 18`) and locks further registration.

---

## 8. STEP 4 — Lecturer Result Submission (CSV) 🟢

Verified in `src/app/portal/lecturer/actions.ts` (`postResults`/`postResultsAction`): session must match `SESSION_RE = /^\d{4}\/\d{4}$/`; semester ∈ {0,1,2}; the actor must be the assigned main or co-lecturer for the exact course/session/semester; unknown matric numbers fail per row; a batch with no successful rows returns `No rows could be processed for …` and writes nothing.

**New evidence (TEST 61):** tampered session `1999/2000` → `/not assigned/` with zero writes; tampered semester `9` → `/Select a semester/` with zero writes.
**New evidence (TEST 62):** an unauthorized lecturer (Engineering lecturer posting a Computer Science batch) → error with zero writes; a fully-invalid batch (`99/ACW/9999`, `00/ACW/0000`) → `processed 0 / failed 2` with zero writes.

---

## 9. STEP 5 — HOD Result Approval 🟢

Verified (TESTS 22–25): HOD may approve `SUBMITTED` results in their own department; cross-department → `/own department/`; non-`SUBMITTED` → `/Not ready for your approval/`; non-HOD → `/cannot approve/`.

**New evidence (TEST 63):** cross-department approval target (`C_ENG`, a seeded `HOD_APPROVED` row) → error, `gradeStatus` unchanged, `approvedBy1Id` still `null`, and **zero `APPROVE` audit rows** written (mutation + audit atomicity asserted, closing §17#3).

---

## 10. STEP 6 — Dean Faculty Results 🟢

Verified (TESTS 26–29 + faculty aggregation): Dean return requires faculty scope + step-up, is unconditional, moves `HOD_APPROVED → SUBMITTED`; cross-faculty → `/does not belong to your faculty/`. `/portal/dean/results` renders `facultyStats` + `facultyCourseCodeDepartmentMap` session-scoped.

**New evidence (TEST 66):** Dean attempting to approve a submitted result (`C_CS2`) is rejected and the row stays `SUBMITTED` — the pipeline ownership boundary (only HOD approves; the Dean oversees) holds.

---

## 11. STEP 7 — SBC University Results 🟢

Verified (TESTS 30–32): SBC is read-only — approve → `/cannot approve/`, finalise → `/Only the Exams & Records office/`, submit → `/cannot enter grades/`; read surfaces (`getResultPipelineStats`) render university-wide counts with no mutation. `/portal/sbc/results` uses the shared pipeline helper behind `requireSbcChairman`.

---

## 12. STEP 8 — DVC/Governance Oversight 🟢

Verified (TESTS 33–35): governance members are read-only and view dashboards/exceptions; `governanceExceptions` flags senate-approved non-FINAL results.

**New evidence (TEST 64):** a `GOVERNANCE_OVERSIGHT_MEMBER` without an active `CommitteeMembership` → `requireGovernanceOversight` rejects (`REDIRECT`); with a created ACTIVE membership → passes; membership cleaned up in `finally`. The membership-boundary semantics (committee + designation + status + unique `[committee, userId]`) hold.

---

## 13. STEP 9 — VC Executive Results 🟢

Verified (TESTS 36–38): non-VC → `REDIRECT` via `requireVC`; VC reads university-wide academic stats; VC mutation attempts → `REDIRECT` (read-only by design). `/portal/vc/results` uses `resultsPipeline` + `getUniversityAcademicStats`.

---

## 14. STEP 10 — Lock-step Aggregation (controlled dataset) 🟢

**New evidence (TEST 65):** builds an isolated, unique-coded dataset (`ACW_LKX_*` / `ACW_LKY_*` under Science / Engineering) respecting the `Result` unique `(userId, courseId, academicSession, semester)` constraint, with distinct students per stage:

- Course X (Science CS): one `SUBMITTED`, one `HOD_APPROVED`, one `SENATE_APPROVED`, one `FINAL`, plus one **historical** `SUBMITTED` in `2024/2025`.
- Course Y (Engineering ME): one `SUBMITTED`.

Assertions: department slice `{SUBMITTED:1, HOD_APPROVED:1, SENATE_APPROVED:1, FINAL:1}` total 4 (historical excluded); `facultyCourseCodes` scoping (X ∈ Science, ∉ Engineering; Y ∈ Engineering, ∉ Science); raw `groupBy` ground-truth equality; university slice identical to department slice for X; Y slice `{SUBMITTED:1}`; `resultsPipeline` and `governanceStats` **monotonic** (`≥`) against the known additions (the whole-university counts are shared with the parallel `executive-recovery.test.ts` worker, so absolute equality is deliberately not asserted).

Every roll-up is in lock-step and current-session scoped. 🟢

---

## 15. §16 Security Verification Matrix (12 items — all covered)

| # | Item | Coverage | Status |
|---|---|---|---|
| 1 | HOD cannot access another department's CourseOffering | TEST 60 (create + toggle negatives) | 🟢 |
| 2 | Course allocation is HOD-only and department-scoped | TESTS 3, 5, 6, 56 | 🟢 |
| 3 | Inactive offering cannot be registered | student-registration.test.ts TEST 2 | 🟢 |
| 4 | Programme-restricted course of another programme | TEST 10 + student-registration TEST 3 | 🟢 |
| 5 | Level-restricted course of another level | TEST 9 + student-registration TEST 4 | 🟢 |
| 6 | Unauthorized lecturer cannot submit | TESTS 18, 19, 20 | 🟢 |
| 7 | HOD cannot approve another department | TEST 23 (+ TEST 63 no-mutation/no-audit) | 🟢 |
| 8 | Dean cannot touch another faculty | TEST 27 | 🟢 |
| 9 | SBC cannot mutate | TESTS 30, 31 | 🟢 |
| 10 | Governance guard (membership boundary) | TEST 64 (+ requireVC TEST 36) | 🟢 |
| 11 | VC cannot mutate | TEST 38 | 🟢 |
| 12 | Client-supplied scope override ignored | TEST 61 (+ TEST 12 tampered courseId, TEST 20) | 🟢 |

---

## 16. §17 Atomicity Verification Matrix (4 items — all covered)

| # | Item | Coverage | Status |
|---|---|---|---|
| 1 | Invalid row inside a registration batch leaves zero rows | student-registration.test.ts TEST 9 + TEST 15 | 🟢 |
| 2 | Unauthorized / fully-invalid result batch writes zero rows | TEST 62 | 🟢 |
| 3 | HOD mixed-authz approval writes no status/approver/audit | TEST 23 (error) + TEST 63 (no-mutation) | 🟢 |
| 4 | Historical results excluded from current aggregation | TEST 58 (+ TEST 65 historical row) | 🟢 |

---

## 17. Test Plan — TESTS 60–66 (new)

| Test | Scenario | Expected | Status |
|---|---|---|---|
| TEST 60 | HOD creates/toggles a course offering; non-HOD and other-department rejected | ok / `/own department/` etc. | 🟢 |
| TEST 61 | Bogus session `1999/2000` and semester `9` on the CSV path | `/not assigned/`, `/Select a semester/`, zero writes | 🟢 |
| TEST 62 | Unauthorized and fully-invalid result batches | error, `processed 0`, zero writes | 🟢 |
| TEST 63 | Cross-department HOD approval | error, status unchanged, approver null, no audit | 🟢 |
| TEST 64 | Governance guard with/without active membership | REDIRECT / pass; cleanup in `finally` | 🟢 |
| TEST 65 | Controlled lock-step dataset (course→dept→faculty→uni pipeline, historical exclusion, ground-truth equality, monotonic totals) | exact slices + monotonic | 🟢 |
| TEST 66 | Dean cannot approve | rejected, row stays `SUBMITTED` | 🟢 |

**Test-defect repairs made during this milestone (no application defect):**
- TEST 65's initial dataset created two `Result` rows for the same `(userId, courseId, academicSession, semester)`, violating the model's unique constraint; the rejected `Promise.all` then aborted the test's `finally`, which cascaded into `afterAll` cleanup skipping. Redesigned to one row per student/course/session with incremental id tracking and robust `finally` cleanup.
- TEST 62 initially used the `LEC_NONE` fixture, which TEST 57 had earlier promoted to co-lecturer on `fx.CS` (so the "unauthorized" batch was in fact authorized). Switched to the Engineering lecturer (never assigned to `fx.CS`).

**App-code repair (hygiene, non-behavioral):** `resetAllPasswords` in `src/lib/module-actions.ts` had an unused `formData` parameter; renamed to `_formData` (matching the file's `/_/` convention) to restore the 46-warning lint baseline. No behavior change.

---

## 18. Test Results

| Suite | Result |
|---|---|
| `src/lib/academic-workflow.test.ts` (TESTS 1–66) | ✅ 66 pass / 0 fail |
| All suites (`npm test`) | ✅ **273 pass / 0 fail** (17 files) |
| New this milestone | ✅ TESTS 60–66 |

---

## 19. Verification Gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (0 errors) |
| `npm run lint` | ✅ 0 errors (46 pre-existing warnings; baseline restored) |
| `npm test` | ✅ **273 pass / 0 fail** (was 266; +7 new) |
| `npm run build` | ✅ success |
| Test residue | ✅ `{ acwUsers: 0, acwSessions: 0, results: 6 }` (zero leak) |
| `grep "HOD_DEAN\|DEAN_APPROVED" src/` | ✅ 0 matches (active code) |

---

## 20. Regression Safety

- All 266 pre-existing tests still pass — including the registration, lecturer delivery, HOD approval, Dean return, SBC, Governance, VC and aggregation suites.
- TESTS 60–66 create and delete their own rows; TEST 65's codes (`ACW_LKX_*`, `ACW_LKY_*`) are unique and code-sliced, so the parallel `executive-recovery.test.ts` worker's counts are never assumed — only monotonic assertions run against shared university totals.
- `resetAllPasswords` rename is purely cosmetic (parameter unused) — no behavioral delta.
- `afterAll` residue re-verified at zero after the full suite.

---

## 21. RBAC — Unchanged

- `ACCESS_CONTROL_MATRIX` in `src/lib/constants.ts`: **not modified**.
- Role strings and menu maps: **not modified**. HOD/DEAN/VC menus intact; SBC/DVC still fall back to generic `PORTAL_MODULES` (unchanged, documented — §25 F5).
- No new roles, no new permissions, no `DEAN_APPROVED` stage, no committee changes.
- Guards verified (read-only): `requireSbcChairman`, `requireVC`, `requireGovernanceOversight`, `isHodRole`, `stepUpGuard`/`requireStepUp`, `can()`.

---

## 22. Boundaries Intact

- HOD approvals queue (`hod/approvals`) — unchanged, department-scoped.
- Exams & Records university-wide actions — unchanged.
- Dean faculty read/return posture — unchanged (no approve power; TEST 66).
- SBC / DVC / GOV read-only posture — unchanged.
- VC read-only posture — unchanged.
- `CourseOffering` (registrability) vs `CourseAssignment` (teaching authority) — unchanged.

---

## 23. Database Safety Confirmation

- **NO schema changes.**
- **NO migrations created or applied.**
- **NO `db:push` / `db:reset` / `db seed` / `db migrate` executed.**
- One **test-residue cleanup** was performed with an idempotent script scoped to `acw-*` fixture users and their dependent rows (audit, session, lmsSyncLog, registration, courseRegistration, result, courseOffering/Assignment/course `ACW_*`, feeAccount, resultFile, correction request, committee membership). These rows had leaked from the first (aborted) run of the new tests during this milestone; after the test fix the suite is self-cleaning. Post-suite counts re-verified at `{ acwUsers: 0, acwSessions: 0, results: 6 }` — zero residue.

---

## 24. Final Status

### END-TO-END ACADEMIC WORKFLOW UAT & INTEGRATION RECOVERY STATUS: **COMPLETE**

- **VERIFIED WORKING** — STEPS 1–10; pipeline `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL` reachable end to end and immutable after finalisation; session-scoped lock-step aggregation at department/faculty/university level; all 12 §16 security items; all 4 §17 atomicity items; guards (`requireGovernanceOversight`, `requireVC`, `requireSbcChairman`, HOD/Dean gates).
- **REPAIRED** — none required at the workflow level. Two test-defect fixes (TEST 65 dataset, TEST 62 actor) and one non-behavioral hygiene change (`_formData` in `resetAllPasswords`, lint baseline restored).
- **NOT TESTED** — interactive browser-level walkthrough (F10): requires an authorized running server and live test data; this milestone verified the workflow through the integration suite (server actions, guards, aggregation helpers) rather than a live UI walk.
- **REMAINING GAPS** — all pre-existing and deferred (see §25): F3 (post-login landing ignores `landingForRole`), F4 (shared `/portal/results` redirects DEAN/SBC/DVC/GOV to dashboard; dedicated surfaces exist), F5 (SBC/DVC generic `PORTAL_MODULES` fallback), F6 (no `middleware.ts` centralized route authorization), F7 (CHAIRMAN vs MEMBER designation powers — product decision).
- **DATABASE** — untouched (no schema/migration/seed/RBAC); zero test residue; persistent cluster data preserved.
- **REGRESSION** — `tsc` 0 errors · `lint` 0 errors (46 pre-existing warnings) · **273/273 tests** · `build` success.

---

## 25. Remaining Findings (deferred, not fixed — inspected this session)

- **F3 🟡** Post-login landing ignores `landingForRole()` — confirmed: `src/app/login/actions.ts` redirects every role to `/portal/dashboard` (mfa path too). UX only; each workspace is still reachable directly.
- **F4 🟡** Sidebar/shared "Results" entry bounces DEAN/SBC/DVC/GOV to dashboard — confirmed: `/portal/results` line 438 `redirect("/portal/dashboard")` for roles outside its branch; dedicated surfaces exist (`/portal/dean/results`, `/portal/sbc/results`, `/portal/vc/results`) with the correct guards.
- **F5 🟡** SBC/DVC workspace menus fall back to generic `PORTAL_MODULES` — confirmed unchanged.
- **F6 🟡** No centralized route authorization (`middleware.ts` does not exist) — confirmed; per-page guards are the current defense.
- **F7 🟡** CHAIRMAN vs MEMBER designations grant identical powers — product decision, unchanged.
- **F10 ⚪** Interactive UI walkthrough not executed — requires authorized live test data / running server.

---

## 26. Recommended Next Steps

1. **P2 — F4**: route DEAN/SBC/DVC/GOV "Results" sidebar entries to their dedicated surfaces (`/portal/dean/results`, `/portal/sbc/results`, DVC governance read, `/portal/vc/results`).
2. **P2 — F3**: post-login redirect to `landingForRole(user.role)`.
3. **P3 — F6**: introduce centralized route↔role authorization (`middleware.ts`).
4. **P3 — F5**: dedicated SBC/DVC menu maps.
5. **P3 — F7**: product decision on Chairman powers.
6. **F10**: authorized interactive UI walkthrough of the now-fully-verified workflow on the running server.
