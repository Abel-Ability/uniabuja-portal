# End-to-End Academic Workflow — Security Milestone Report

**Milestone:** End-to-End Academic Workflow — allocation → registration → grades → approval → oversight → finalisation
**Date:** 15 Aug 2026
**Source of truth:** `docs/EXECUTIVE_GOVERNANCE_RED_DEFECT_REMEDIATION_REPORT.md` (F1 + F2 baseline); student enrolment + finalisation audit
**Status:** COMPLETE — all boundaries enforced, 50 new tests green, gates green

---

## 1. Executive Summary

This milestone closes the remaining open write-action boundaries in the
academic workflow so that **every stage of the pipeline is authorized by the
server from a session-derived scope, never from client-supplied identity**:

1. **Course allocation (`assignCourse`)** is now fully server-hardened: the
   department comes from the HOD's own session, the course must exist in the
   database **and** in the department's catalogue, and every lecturer (main +
   co) must be a `LECTURER` in the same department. `courseTitle` is taken from
   the database — the client's `faculty`/`department`/`courseTitle` fields are
   ignored.
2. **Grade entry (`submitGrade`)** is now gated by `CourseAssignment` for the
   `LECTURER` role: only the assigned main/co lecturer (exact course +
   academic session + semester) may enter a grade. A tampered `courseId` that
   resolves to a different allocation is rejected.
3. **Result return (`returnResult`)** now requires a `DEAN`/`HOD_DEAN` session
   with a faculty scope and a step-up confirmation; faculty scoping is enforced
   unconditionally.
4. **Finalisation (`finaliseResult`)** — a new `EXAMS_RECORDS`-only action that
   moves `SENATE_APPROVED → FINAL` with step-up and a `FINALIZE` audit entry.
   Until now the pipeline *ended* at `SENATE_APPROVED` — a `FINAL` stage was
   declared in the workflow, but the governance exceptions register showed
   `"results-senate-approved"` exceptions proving results could never become
   `FINAL`. The finalisation button (`FinaliseResultButton`) is surfaced on the
   shared `/portal/results` page for Exams & Records.

New shared aggregation helpers in `src/lib/academic-stats.ts` power the HOD
department overview, the lecturer "registered · submitted · % complete" per
assignment cards, the VC Academic Year Overview, and a Senate-approved pending
queue — all from one set of stage-consistent queries.

Security/functional regression coverage was added (50 new integration tests,
TESTS 1–50). All verification gates pass: `tsc` 0 errors, `lint` 0 errors
(41 pre-existing warnings unchanged), `npm test` 17 files / 257 tests
(207 baseline + 50 new), `npm run build` succeeds.

**No database schema changes. No migrations. No `db:push`/`db:reset`/`db seed`
re-runs. No RBAC matrix changes. No role-string changes. No account changes.**
The result pipeline stage order (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED →
FINAL`) is unchanged and now provably reachable end to end.

---

## 2. Scope

In scope (application code + tests only):

| Item | Change |
|---|---|
| `src/lib/module-actions.ts` — `assignCourse` | Server-hardened allocation (session dept, catalogue membership, lecturer role/dept validation) |
| `src/lib/module-actions.ts` — `submitGrade` | `LECTURER` grade entry gated by `CourseAssignment` (main or co) |
| `src/lib/module-actions.ts` — `returnResult` | Mandatory faculty scope + step-up for Dean returns |
| `src/lib/module-actions.ts` — `finaliseResult` (new) | `EXAMS_RECORDS`-only `SENATE_APPROVED → FINAL` |
| `src/lib/academic-stats.ts` (new) | Shared stage-consistent aggregation helpers |
| `src/app/portal/results/page.tsx` | LECTURER branch scoped to assigned courses; EXAMS branch adds senate-approved queue |
| `src/app/portal/results/finalise-result-button.tsx` (new) | Server-action button for finalisation |
| `src/app/portal/lecturer/page.tsx` | Per-assignment registration/submission completion cards |
| `src/app/portal/hod/page.tsx` | Department academic overview section |
| `src/app/portal/vc/results/page.tsx` | Academic Year Overview section |
| `src/lib/academic-workflow.test.ts` (new) | TESTS 1–50 regression coverage |

Out of scope (deferred): F3, F4, F5, F6, F7, F9, F10 from the RED report
(unchanged), plus any further VC workspace surface work beyond the results
page.

---

## 3. Baseline (pre-milestone, verified)

- `npx tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors, **41 warnings** (pre-existing).
- `npm test`: 16 files / 207 tests passing.
- `npm run build`: succeeds.
- The result pipeline ended at `SENATE_APPROVED`: governance exception
  `"results-senate-approved"` fired because no `FINAL` stage existed (see §8).
- `submitGrade` for `LECTURER` was scoped only by role — any lecturer could
  enter a grade on any course.
- `assignCourse` trusted client-supplied `faculty`, `department`,
  `lecturerId`, and `courseTitle`.
- `returnResult` did not require a step-up and its faculty check was
  conditional.
- Demo DB: no `CourseAssignment` rows existed before TESTS 1/39 created them;
  demo roles MFA disabled (`mfaEnabled: false` → no step-up block in tests).

---

## 4. Architectural Rules (non-negotiable, reaffirmed)

1. `CourseOffering` = eligibility; `CourseAssignment` = teaching allocation.
   Never cross-used.
2. Server-side authorization is authoritative; client-supplied identity fields
   (`courseId`, `courseCode`, `lecturerId`, `faculty`, `department`, `level`,
   `programmeId`) are never trusted.
3. HOD = department scope, Dean = faculty scope (oversight only), SBC = read-only
   oversight, DVC/GOV = membership-gated read-only, VC = executive read-only.
4. All mutations are hash-chained through `audit()`/`writeAudit`.
5. Pipeline frozen at `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`;
   no `DEAN_APPROVED` stage.

---

## 5. What Changed — Course Allocation (`assignCourse`)

`src/lib/module-actions.ts` (`assignCourse`, ~2171):

- Role gate unchanged (`can(role, "EXAMS_RECORDS", "A")` → Heads of Department
  only). Non-HOD attempt → `"Only Heads of Department can allocate courses."`
- `faculty` and `department` are now **derived from `session.user`**. A session
  without a department → `"Your account has no department scope. Contact the
  registry."`
- The course must exist in the database **and** pass
  `courseInDepartmentCatalogue(faculty, department, code)` →
  `"You can only allocate courses in your own department."`
- Main lecturer must be role `LECTURER` **and** in the same department →
  `"The main lecturer must belong to your department."` (non-lecturer → `"Select
  a valid lecturer."`)
- Co-lecturers are validated the same way, deduplicated, and removed if they
  equal the main lecturer → `"Co-lecturers must belong to your department."`
- `courseTitle` is read from `course.title` in the database; the client's
  `courseTitle`/`faculty`/`department` fields are ignored.
- Assignment is upserted (same course/session/semester) and team members are
  re-created after the upsert, so the co-lecturer set always matches the
  submitted form.

---

## 6. What Changed — Grade Entry (`submitGrade`)

`src/lib/module-actions.ts` (`submitGrade`, ~1239):

- The registration is loaded with `include: { course: true }` so the course
  code is available server-side.
- After the existing role/`can()`/step-up checks, when `session.user.role ===
  "LECTURER"`:
  - looks up `CourseAssignment` for
    `(course.code, registration.academicSession, registration.semester)`;
  - the actor must be the assignment's `lecturerId` (main) or a member of the
    assignment's `CourseAssignmentMember` team (co-lecturer);
  - otherwise → `"You are not assigned to teach this course for this session."`
    — with **no mutation and no audit**.
- `EXAMS_RECORDS` remains the university-wide entering unit (unchanged).
- The submitted `grade` value is still validated against `GRADE_BANDS`
  (70→A, 60→B, 50→C, 45→D, 40→E) and stored; submission writes a `SUBMIT`
  audit targeted at the course-registration row (the target before a `Result`
  row exists).

---

## 7. What Changed — Result Return (`returnResult`) and Finalisation (`finaliseResult`)

`src/lib/module-actions.ts`:

**`returnResult`** (~2784):

- After the Dean role gate, a `stepUpGuard` now runs (defense in depth for a
  destructive, faculty-wide action).
- `faculty` is now **required** → `"Your account has no faculty scope. Contact
  the registry."`
- The faculty scope check now runs **unconditionally** (previously only when a
  faculty string was present): results whose course's offering faculty is not
  the Dean's → `"This result does not belong to your faculty."`
- Returned results move `HOD_APPROVED → SUBMITTED`; a `RETURN` audit entry is
  written. `FINAL` results cannot be returned.

**`finaliseResult`** (new, placed after `returnResult`):

- Gate: `can(role, "EXAMS_RECORDS", "F")` → `"Only the Exams & Records office
  can finalise results."`
- Step-up required (`requireStepUp`) — irreversible action.
- Result must exist → `"Result not found."`
- Stage must be `SENATE_APPROVED` → otherwise `"Only Senate-approved results
  can be finalised (current stage: …)."`
- Transition: `gradeStatus: "SENATE_APPROVED" → "FINAL"`, `published: true`
  preserved, `finalisedAt` stamped.
- Audit: `audit("EXAMS_RECORDS", "FINALIZE", "RESULT", id, session,
  { gradeStatus: "SENATE_APPROVED" }, { gradeStatus: "FINAL" })`.
- `FINAL` is immutable: `approveResult`, `returnResult`, `submitGrade` all
  reject `FINAL` rows.

UI: `src/app/portal/results/finalise-result-button.tsx` (client, `useActionState`,
label `Finalise`, `bg-brand-strong`) renders the senate-approved pending queue on
the shared `/portal/results` EXAMS branch (`isHod ? [] : senateApproved` query,
take 50).

---

## 8. Why a `FINAL` Stage Was Missing

The pipeline documentation always declared `SENATE_APPROVED → FINAL`, but no
action produced `FINAL`. The `governanceExceptions()` register contains a
`"results-senate-approved"` exception raised for exactly this condition (the
reference RED report lists it). This milestone supplies the missing terminal
transition and proves it reachable (TESTS 40–50).

---

## 9. What Changed — Shared Aggregation Helpers (`src/lib/academic-stats.ts`)

New module (~391 lines), all queries scoped by `AcademicScope` defaulting to
`CURRENT_SESSION` / `CURRENT_SEMESTER`:

| Helper | Returns |
|---|---|
| `getResultPipelineStats(scope, resultFilter)` | Stage counts (`SUBMITTED`, `HOD_APPROVED`, `SENATE_APPROVED`, `FINAL`), `finalised`, `inProgress`, `completionPct` |
| `getCourseAssignmentStats(scope, dept)` | Assignment list with `registeredStudents` per course code |
| `getDepartmentAcademicStats(dept, scope)` | Students, courses taught, active registrations, graded results, pipeline, grade distribution with pass rate |
| `getFacultyAcademicStats(faculty, scope)` | Aggregate over the faculty's departments (`departments: string[]`) |
| `getUniversityAcademicStats(scope)` | Aggregate over all faculties (null-filtered) |
| `getCourseRegResultCounts(courseCodes, scope)` | `Map<code, {registered, submitted, completionPct}>` |

Fixed during typecheck: duplicate `departments` key removed; `string|null`
arrays filtered before aggregation.

---

## 10. What Changed — Dashboard Wiring

- **`src/app/portal/lecturer/page.tsx`** — per assigned course (main + co),
  `getCourseRegResultCounts` keyed `session|semester|code` renders
  "X registered · Y submitted · Z% complete".
- **`src/app/portal/hod/page.tsx`** — "Department academic overview" section
  via `getDepartmentAcademicStats` (registered/entered/completion/pass rate +
  per-stage cards).
- **`src/app/portal/vc/results/page.tsx`** — "Academic Year Overview" section
  via `getUniversityAcademicStats` (students, courses taught, active
  registrations, pipeline completion, pass rate, per-faculty table).
- **`src/app/portal/results/page.tsx`** — LECTURER branch now loads the user's
  `CourseAssignment`s (main + team), filters registrations by
  `course.code|academicSession|semester` inside assignment keys, and builds the
  grade-entry course list from those registrations only.

---

## 11. Test Plan — Allocation & Registration (TESTS 1–15)

| Test | Scenario | Expected |
|---|---|---|
| TEST 1 | HOD allocates a course to a main and a co-lecturer | `ok`; assignment + team rows written |
| TEST 2 | Non-HOD role attempts `assignCourse` | `/Heads of Department/` |
| TEST 3 | HOD allocates a course outside their department catalogue | `/own department/` |
| TEST 4 | HOD assigns a non-lecturer as main | `/valid lecturer/` |
| TEST 5 | HOD assigns a lecturer from another department as main | `/main lecturer must belong/` |
| TEST 6 | HOD adds a co-lecturer from another department | `/Co-lecturers must belong/` |
| TEST 7 | Eligible student registers an offered course | `ok`; ACTIVE row |
| TEST 8 | Course with no ACTIVE offering | `/not offered to you/` |
| TEST 9 | Course whose offering level ≠ student level | `/not offered to you/` |
| TEST 10 | Programme-specific course of another programme | `/not offered to you/` |
| TEST 11 | Zero-capacity course | waitlisted (`/capacity/`) |
| TEST 12 | Tampered `courseId` (course not offered at all) | rejected |
| TEST 13 | Course with an unmet prerequisite | `/Prerequisite/` |
| TEST 14 | Drop a course the student is not registered for | rejected |
| TEST 15 | Finalisation creates immutable header | reference `CR-\d{4}-\d{6}`, `FINALIZED`, `totalUnits ≥ 18`, lock rejects further registration |

## 12. Test Plan — Lecturer & HOD (TESTS 16–25)

| Test | Scenario | Expected |
|---|---|---|
| TEST 16 | Main lecturer submits a grade on an assigned course | `ok`, status `SUBMITTED` |
| TEST 17 | Co-lecturer submits a grade on the same course | `ok`, grade replaced |
| TEST 18 | Lecturer with no assignment submits a grade | `/not assigned to teach/` |
| TEST 19 | Lecturer submits on a course assigned to another lecturer | `/not assigned to teach/` |
| TEST 20 | Tampered `courseId` for an unassigned course | `/not assigned to teach/` |
| TEST 21 | Lecturer attempts `approveResult` | `/cannot approve/` |
| TEST 22 | HOD approves a `SUBMITTED` result in their department | `ok`, `HOD_APPROVED`, approver stamped |
| TEST 23 | HOD approves a result outside their department | `/own department/`, no mutation, no audit |
| TEST 24 | HOD approves a result not at `SUBMITTED` | `/Not ready for your approval/` |
| TEST 25 | Non-HOD role attempts `approveResult` | `/cannot approve/` |

## 13. Test Plan — Dean, SBC, Governance, VC (TESTS 26–38)

| Test | Scenario | Expected |
|---|---|---|
| TEST 26 | Dean returns an `HOD_APPROVED` result in their faculty | `ok`, back to `SUBMITTED` |
| TEST 27 | Dean returns a result from another faculty | `/does not belong to your faculty/` |
| TEST 28 | Dean returns a result not at `HOD_APPROVED` | rejected |
| TEST 29 | Non-Dean attempts `returnResult` | `/Only Deans can return results/` |
| TEST 30 | SBC attempts approve/finalise | `/cannot approve/` and `/Only the Exams & Records office/` |
| TEST 31 | SBC attempts `submitGrade` | `/cannot enter grades/` |
| TEST 32 | SBC read-only oversight (view helpers) | stats readable, no mutation |
| TEST 33 | Governance members attempt mutations | rejected (approve/finalise/submit) |
| TEST 34 | `governanceExceptions` flags senate-approved non-FINAL results | exception `results-senate-approved` present; governance approve rejected |
| TEST 35 | Governance members view dashboards | readable |
| TEST 36 | Non-VC role reaches the VC workspace | REDIRECT (via `requireVC`) |
| TEST 37 | VC views university-wide academic stats | helpers return aggregates |
| TEST 38 | VC attempts mutation | REDIRECT (read-only by design) |

## 14. Test Plan — End-to-End Chain (TESTS 39–50)

| Test | Scenario | Expected |
|---|---|---|
| TEST 39 | E2E: HOD allocates the E2E course | assignment written, registrability defined |
| TEST 40 | E2E: student registers the offered course | ACTIVE row |
| TEST 41 | E2E: main lecturer submits the grade | `SUBMITTED` |
| TEST 42 | E2E: HOD approves the grade | `HOD_APPROVED` |
| TEST 43 | E2E: Exams & Records records Senate approval | `SENATE_APPROVED`, `published: true`, `approvedBy2Id` = Exams actor |
| TEST 44 | E2E: Dean exercises faculty oversight on a separate batch | return ok / scope respected |
| TEST 45 | E2E: Exams & Records finalises the Senate-approved result | `FINAL`, `finalisedAt` stamped |
| TEST 46 | E2E: FINAL is immutable (lecturer edit rejected) | `/finalised/` |
| TEST 47 | E2E: student can read their FINAL result | readable; same value |
| TEST 48 | E2E: shared pipeline stats reflect the finalised result | `completionPct`/`final` updated |
| TEST 49 | E2E: hash-chained audit log remains intact | `verifyChain` count > 0, `intact` true |
| TEST 50 | E2E: full chain respects stage order | audit shows `SUBMIT` (on registration), `APPROVE ×2`, `FINALIZE` (on result) |

---

## 15. Test Results

```
Test Files  17 passed (17)      (was 16)
     Tests  257 passed (257)    (was 207; +50 new)
```

All 50 new tests pass; all 207 pre-existing tests still pass (no regression).
The suite is self-contained: every fixture (users, courses, offerings,
assignments, registrations, results, fee accounts, sessions, audit rows) is
created and removed within the file; `verifyChain` is exercised on the live
database after the E2E chain.

---

## 16. Verification Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 41 warnings (pre-existing baseline unchanged) |
| `npm test` | 17 files / 257 tests passing |
| `npm run build` | succeeds; `/portal/results`, `/portal/vc/results`, lecturer/HOD dashboards all compile |

---

## 17. Regression Safety

- HOD Course Offerings (catalogue-scoped) — untouched.
- Student registration finalisation/locking, bursary, fees, transcripts,
  clearance smoke tests — untouched and still green (257 tests).
- Result pipeline stage order and `published` semantics — unchanged (TESTS
  22–28, 43).
- Exams & Records university-wide view — unchanged; the senate-approved queue
  is additive.
- DVC governance export — untouched.
- Login/redirect flow and guards — untouched.
- No unrelated modules modified (file list in §2 only).

---

## 18. RBAC — Unchanged

- `ACCESS_CONTROL_MATRIX` in `src/lib/constants.ts`: **not modified**.
- Role strings: **not modified**.
- No `DEAN_APPROVED` stage, no new roles/permissions, no committee changes.
- All authorization still flows through `can()`, `isHodRole()`, `stepUpGuard` /
  `requireStepUp`, `requireVC`, `requireGovernanceOversight`.

---

## 19. Database Safety Confirmation

- **NO schema changes.**
- **NO migrations created or applied.**
- **NO `db:push` / `db:reset` / `db seed` / `db migrate` executed.**
- Only application code + tests changed; tests create and fully remove their
  own rows (verified: zero residue after the suite).

---

## 20. Boundaries Intact

- HOD approvals queue (`hod/approvals`) — unchanged, still dept-scoped.
- Exams & Records university-wide view — unchanged.
- DEAN / SBC / DVC / GOV access to `/portal/results` — unchanged (still
  redirected to dashboard; F4, out of scope).
- VC workspace read-only posture — unchanged (view stats only, §13).

---

## 21. END-TO-END WORKFLOW STATUS

| # | Stage | Role | Authorization boundary | Tests | Status |
|---|---|---|---|---|---|
| 1 | Allocate course (main) | HOD | session dept + catalogue + lecturer role/dept | 1, 4, 5 | 🟢 |
| 2 | Allocate course (co-lecturer) | HOD | same dept, deduped, ≠ main | 1, 6 | 🟢 |
| 3 | Allocation guard | HOD only | `can(role, EXAMS_RECORDS, A)` | 2, 3 | 🟢 |
| 4 | Student registers course | Student | offering ACTIVE + level + programme + capacity + prerequisite | 7–13 | 🟢 |
| 5 | Drop/immutability | Student | ownership + status | 14, 15 | 🟢 |
| 6 | Finalise registration (lock) | Student | header + reference + total units | 15 | 🟢 |
| 7 | Lecturer enters grade (main) | LECTURER | CourseAssignment main | 16, 18, 19, 20 | 🟢 |
| 8 | Lecturer enters grade (co) | LECTURER | CourseAssignment team | 17 | 🟢 |
| 9 | Grade-entry guard | EXAMS_RECORDS | university-wide; LECTURER cannot approve | 21 | 🟢 |
| 10 | Approve grade | HOD | own department + SUBMITTED | 22–25 | 🟢 |
| 11 | Dean oversight (return) | DEAN | own faculty + HOD_APPROVED + step-up | 26–29 | 🟢 |
| 12 | Senate scrutiny (SBC) | SBC | read-only | 30–32 | 🟢 |
| 13 | Governance oversight | DVC/GOV | membership + read-only + exceptions register | 33–35 | 🟢 |
| 14 | VC oversight | VC | `requireVC` + read-only | 36–38 | 🟢 |
| 15 | Senate approval | EXAMS_RECORDS | `HOD_APPROVED → SENATE_APPROVED` + publish | 43 | 🟢 |
| 16 | Finalise result | EXAMS_RECORDS | `SENATE_APPROVED → FINAL` + step-up | 45, 30, 33 | 🟢 |
| 17 | FINAL immutability | all | edit/approve/return/finalise rejected | 46 | 🟢 |
| 18 | Student reads result | Student | ownership + FINAL visible | 47 | 🟢 |
| 19 | Aggregated stats | HOD/EXAMS/VC | stage-consistent helpers | 35, 37, 48 | 🟢 |
| 20 | Audit integrity | — | hash chain intact end to end | 49, 50 | 🟢 |

All 20 stages 🟢. The pipeline `SUBMITTED → HOD_APPROVED → SENATE_APPROVED →
FINAL` is reachable end to end and immutable after finalisation.

---

## 22. Remaining Findings (deferred, not fixed)

Unchanged from the RED report (out of scope by design — all yellow/⚪):

- **F3 🟡** Post-login landing ignores `landingForRole()` — UX.
- **F4 🟡** Sidebar "Results" bounces DEAN/SBC/DVC/GOV to dashboard — navigation.
- **F5 🟡** Dead `VC_MENU`, `/portal` + `/portal/students` 404s — dead code.
- **F6 🟡** No centralized route authorization (no `middleware.ts`) — defense in depth.
- **F7 🟡** CHAIRMAN vs MEMBER designations grant identical powers — product decision.
- **F8 ⚪** Remaining action negatives (senate actions, `createCourseOffering`) — the
  previously open `assignCourse`/`returnResult` negatives are now fully covered
  (TESTS 1–6, 26–29).
- **F9 🟡** SBC workspace discoverability — UX.
- **F10 ⚪** Interactive UI walkthrough not executed (requires authorized live test
  data / running server).

---

## 23. Recommended Next Milestone

1. **P2 — F4**: route each of DEAN/SBC/DVC/GOV from the sidebar "Results" entry
   to its own results surface.
2. **P2 — F3**: post-login redirect to `landingForRole(user.role)`.
3. **P3 — F5/F6**: remove dead code; introduce centralized route↔role
   authorization.
4. **P3 — F8 remainder**: action-level negatives for senate actions and
   `createCourseOffering`.
5. **P3 — F7/F9**: product decision on Chairman powers; SENATE sidebar entry.
6. **F10**: interactive UI walkthrough of the now-complete workflow with
   authorized temporary test data.

All of the above remain application-code/test-only; no schema or RBAC changes
required.
