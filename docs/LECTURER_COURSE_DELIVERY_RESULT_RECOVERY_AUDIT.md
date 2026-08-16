# Lecturer Course Delivery & Result Submission — Recovery Audit

**Date:** 2026-08-16
**Milestone:** Lecturer course delivery & result submission recovery (HoD assignment → lecturer results → HoD review).
**Mode:** Recovery — READ-ONLY audit plus minimal, additive application repairs. **No schema, migration, database, seed or RBAC changes were made.** No `prisma migrate reset` / `prisma db push` / `prisma migrate dev` / seed was run. All data in the persistent `data/pgdata` cluster was preserved.
**Auditor scope:** The lecturer result-delivery slice of the Exams & Records workflow: HoD course allocation and co-lecturer teams, the lecturer workspace (post results / backlog / course results / result correction / result files), HoD departmental results view and statistics, and the shared audit trail.
**Related prior audits:** `docs/RECOVERY_AUDIT.md` (portal baseline), `docs/DATABASE_RECOVERY_AUDIT.md`, `docs/EXECUTIVE_GOVERNANCE_RECOVERY_AUDIT.md`, `docs/END_TO_END_ACADEMIC_WORKFLOW_MILESTONE.md`.
**Commands run this session:** `npx tsc --noEmit` (clean), `npm run lint` (0 errors), `npm test` (all 264 pass), `npm run build` (success), plus read-only source reads/greps. The embedded PostgreSQL cluster was started (`scripts/start-db.ts`) for the integration suite.

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not exercised in this run

---

## 1. Executive summary

The lecturer course-delivery slice is **structurally complete and healthy**. The full chain — HoD allocation with co-lecturer teams → lecturer single-grade entry → lecturer CSV batch upload → HoD approval → Exams & Records Senate recording → finalisation — exists as real server actions and pages with server-side authorization, and the schema fully supports it (CourseAssignment / CourseAssignmentMember, CourseRegistration, Result, ResultFile, ResultCorrectionRequest, CourseOffering, hash-chained AuditLog).

The slice was **not fully consistent at the boundary** between the two authorization models, and four real defects were found and repaired (all application-level, all additive):

| # | Defect | Severity | Status |
|---|---|---|---|
| 1 | CSV batch upload (`postResultsAction`) authorized the **main lecturer only** — co-lecturers could never post a batch, while the single-grade path already allowed them | P1 | 🔴 → 🟢 **REPAIRED** |
| 2 | The `post-results` / `post-backlog` / `course-results` pages filtered assignments by `lecturerId` only, hiding co-lecturer courses | P2 | 🔴 → 🟢 **REPAIRED** |
| 3 | The CSV **NORMAL** path had no `CourseRegistration` (ACTIVE) validation — a lecturer could post grades for students who never registered the course | P1 | 🟡 → 🟢 **REPAIRED** |
| 4 | `requestResultCorrection` had **no course-assignment check** — any lecturer could request a correction for any course | P1 | 🔴 → 🟢 **REPAIRED** |
| 5 | `addCourseTeamLecturer` did not verify the added lecturer's department (the sibling `assignCourse` path did) | P2 | 🟡 → 🟢 **REPAIRED** |

One **newly implemented** capability: a server-rendered **registered-students roster** on the Post Results page, so a lecturer can cross-check a batch against the authoritative registration list before uploading.

**Deliberately NOT changed** (documented decisions, see §6): the partial-batch semantics of CSV uploads; the backlog (semester 0) rule that NORMAL-only registration validation; the architecture that keeps `CourseOffering` (registrability) and `CourseAssignment` (teaching authority) as separate authorities; and the existing stage pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`) — the milestone stops at the HoD review boundary, with no Dean/SBC/DVC/VC aggregation.

**Regression status:** `tsc` clean, ESLint 0 errors, all **264 tests pass** (7 new: TESTS 51–57 in `src/lib/academic-workflow.test.ts`), production build succeeds. No existing behaviour was weakened.

---

## 2. ALREADY WORKING (verified, no change required)

### 2.1 HoD course allocation (`src/lib/module-actions.ts`, `assignCourse` ~2171)
- 🟢 HoD-only via `isHodRole`; step-up guard applied (`stepUpGuard`).
- 🟢 Faculty/department derived from the **server-side session** — never from the client.
- 🟢 Catalogue check (`courseInDepartmentCatalogue`) keeps HoDs inside their own department's course catalogue.
- 🟢 Main lecturer must be a `LECTURER` **in the same department**; co-lecturers must also be same-department `LECTURER`s (existing test TEST 6 covers cross-department rejection).
- 🟢 Upsert keyed on `courseCode_academicSession_semester` (unique), team members replaced atomically.
- 🟢 Audit `COURSE_ASSIGNMENT` row written on create.
- 🟢 `unassignCourse` / `removeCourseTeamLecturer` are department-scoped.
- ⚪ `assignLevelAdviser` / `assignLevelCoordinator` (sibling functions) were not re-audited in depth — out of the result-delivery slice; noted in §7 as future work.

### 2.2 Single-grade entry (`submitGrade`, module-actions.ts ~1239)
- 🟢 Authorizes main **or** co-lecturer (`assignment.lecturerId === session.userId || teamMembers.some(...)`), keyed on the registration's course code/session/semester — the correct server-derived scope.
- 🟢 Requires an ACTIVE registration first.
- 🟢 `FINAL` results are immutable; edits re-submit as `SUBMITTED` and clear approver fields.
- 🟢 `can(role, "EXAMS_RECORDS", "S")` gate keeps non-teaching roles out (tests 31/33).

### 2.3 Result lifecycle & HoD review
- 🟢 `approveResult`, `returnResult`, `finaliseResult` enforce stage order and department/faculty scope (existing tests 22–29, 43–45).
- 🟢 Hash-chained audit log verified by `verifyChain` (TEST 49) and transition-history assertions (TEST 50).
- 🟢 HoD department results page and statistics are DB-backed (`academic-stats.ts`: `getResultPipelineStats`, `getCourseAssignmentStats`, `getCourseRegResultCounts`) and agree across levels (TESTS 48, 50).

### 2.4 Upload plumbing & safety rails (CSV path)
- 🟢 `MAX_FILE_BYTES` (512 KB), `MAX_ROWS` (500), `.csv` extension, CA/EXAM range validation (0–caMax / 0–100), `CA+EXAM ≤ 100`, computed `TOTAL`/`GRADE` (never client-supplied).
- 🟢 Matric resolution against `registrationNo`/`username`; unknown students fail their row only.
- 🟢 `ResultFile` snapshot (`rawCsv`, counts, status `PROCESSED|PARTIAL|FAILED`, `errorSummary`) and a `SUBMIT` audit row.
- 🟢 Uploaded-file route (`result-files/[id]/route.ts`) restricts downloads to the uploader.

### 2.5 Workspace navigation & role guards
- 🟢 Lecturer workspace pages guard `session.user.role !== "LECTURER"` and redirect via `landingForRole`.
- 🟢 Lecturer dashboard (`lecturer/page.tsx`) already lists main **and** co-lecturer assignments (the reference pattern this audit extended to the sub-pages).

---

## 3. REPAIRED

### 3.1 CSV batch upload now authorizes co-lecturers (P1) — `src/app/portal/lecturer/actions.ts`
**Before:** `postResults` resolved the assignment with `{ courseCode, academicSession, semester, lecturerId: user.id }` — main lecturer only. The single-grade path already allowed team members; the batch path silently locked co-lecturers out.
**After:** a shared server-side helper `isAssignedToCourse(userId, courseCode, academicSession, semester)` resolves the assignment with `OR: [{ lecturerId: userId }, { teamMembers: { some: { lecturerId: userId } } }]`. For backlog uploads (`semester === 0`) the semester clause is dropped, mirroring the backlog form's existing scoping. The course/session/semester are still never trusted on their own — they are matched **against** the assignment row.
**Tests:** TEST 51 (co-lecturer posts a 2-row PROCESSED batch, attribution `submittedById` = co-lecturer), TEST 52 (unassigned lecturer rejected).

### 3.2 Lecturer sub-pages now show co-lecturer assignments (P2) — `post-results`, `post-backlog`, `course-results` pages
**Before:** all three pages queried `where: { lecturerId: user.id }`, so a co-lecturer saw none of their courses.
**After:** all three use `OR: [{ lecturerId: user.id }, { teamMembers: { some: { lecturerId: user.id } } }]`, matching the dashboard.
**Tests:** covered indirectly by TEST 51/52; the page queries are server-rendered (typechecked; build passes).

### 3.3 CSV NORMAL rows require an ACTIVE registration (P1) — `src/app/portal/lecturer/actions.ts`
**Before:** the batch path validated scores and student existence but never checked registration — a lecturer could post grades for a student who was not registered for the course/session/semester (the single-grade path already enforced this via `submitGrade`).
**After:** for `kind === "NORMAL"`, each row now requires a `CourseRegistration` with `userId`, `courseId`, `academicSession`, `semester`, `status: "ACTIVE"`. Unregistered rows are reported per-row and the batch completes as `PARTIAL` (never aborted mid-way — see §6.1).
**Tests:** TEST 53 — a batch containing one registered and one unregistered student completes as `PARTIAL` with `processed: 1`, `failed: 1`, error `"is not registered for"`, and a persisted `ResultFile.status === "PARTIAL"`.

### 3.4 Correction requests now require an assignment (P1) — `src/app/portal/lecturer/actions.ts`
**Before:** `requestResultCorrection` validated the form and created a `ResultCorrectionRequest` for **any** course — a lecturer could request corrections for courses they were never assigned.
**After:** the request is gated by `isAssignedToCourse` (main or co-lecturer) for the given session/semester.
**Tests:** TEST 54 (unassigned lecturer rejected), TEST 55 (co-lecturer succeeds; request persisted as `SUBMITTED`).

### 3.5 `addCourseTeamLecturer` enforces department scope (P2) — `src/lib/module-actions.ts`
**Before:** the HOD was department-scoped on the *assignment* but not on the *added lecturer* — a same-department HOD could add a lecturer from any department to their team (the sibling `assignCourse` path rejected this).
**After:** `lecturer.department !== assignment.department` → `"Co-lecturers must belong to your department."`
**Tests:** TEST 56 (cross-department added lecturer rejected), TEST 57 (same-department added lecturer succeeds and persists a `CourseAssignmentMember`).

---

## 4. NEWLY IMPLEMENTED

### 4.1 Registered-students roster on Post Results (`src/app/portal/lecturer/post-results/page.tsx`)
The Post Results page now renders a **server-rendered roster of ACTIVE registrations** for the currently selected assignment (course + session + semester), with name / matric / programme columns. The roster is derived from `CourseRegistration` (the registrability authority) — **never** from an uploaded file — so a lecturer can reconcile a CSV batch against the authoritative list before submitting. Selection is driven by the same `course/session/semester` query params used by the upload form and falls back to the first assignment.

This is the only newly-implemented capability in this milestone; every other item was already present and merely verified or repaired.

---

## 5. NOT IMPLEMENTED (intentionally out of scope — with reasons)

| Item | Reason |
|---|---|
| Dean / SBC / DVC / VC aggregation of lecturer-delivery statistics | The milestone explicitly stops at the HoD review boundary. Dean and VC-level stats already exist in `academic-stats.ts` from prior milestones. |
| Blocking all batch rows when one fails | See §6.1 — the architecture models partial success (`ResultFile.status = PARTIAL`), which is the safer production behaviour for 500-row uploads and is preserved. |
| Semester-specific backlog assignment | Backlog (`semester 0`) work is scoped by course + session only, matching the backlog upload form and the existing single-grade lookup. Changing this would alter backlog semantics — deferred, documented in §6.3. |
| Roster for Backlog uploads | Backlog has no registration semantics in the current schema; there is nothing authoritative to roster against. Documented as a gap. |
| Normalising course codes at `assignCourse` time | The HoD catalogue check already requires an exact match against the uppercase catalogue, so stored assignment codes are uppercase in practice. The CSV path normalises its input before lookup as a safety net. Noted for consistency hardening in §7. |

---

## 6. Documented decisions

### 6.1 Partial-batch semantics are preserved (and tested)
A CSV row that fails validation (score out of range, unknown student, **unregistered student**) is reported per-row; valid rows are still upserted and the batch finishes as `PARTIAL`. This matches the existing `ResultFile` state machine (`PROCESSED | PARTIAL | FAILED`) and the requirement to be resilient for real 500-row sheets. TEST 53 pins the `PARTIAL` behaviour for the new registration check.

### 6.2 `CourseOffering` vs `CourseAssignment` remain distinct authorities
`CourseOffering` defines **who may register**; `CourseAssignment` defines **who may teach and grade**. Neither was merged or re-purposed: the roster and the NORMAL registration check use `CourseRegistration`/`CourseOffering`; every grading action uses `CourseAssignment` (including the new CSV/team/correction checks).

### 6.3 Backlog is unverifiable against registration
Semester-0 (backlog) has no registration records; the NORMAL-only registration check is therefore the correct scope, and the roster is not offered on the backlog page. This is a documented data-model gap, not a defect introduced here.

### 6.4 No schema or seed changes
All repairs are additive server-side authorization/validation. The persistent cluster (`data/pgdata`, 38,755 users, prior results) was not migrated, reset or re-seeded.

---

## 7. Verification & regression

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ 0 errors (49 pre-existing warnings, none in changed files) |
| `npm test` (Vitest, integration + all suites) | ✅ **264 pass / 0 fail** (was 261 pass / 3 fail before the fixture-case fix) |
| New tests | ✅ TESTS 51–57 in `src/lib/academic-workflow.test.ts` |
| `npm run build` | ✅ success |
| DB smoke | ✅ `{ users: 38755, results: 6, applications: 1 }` (Prisma ↔ PostgreSQL) |

### Test-coverage map for the repaired slice
- **TEST 51** — co-lecturer CSV batch success (`PROCESSED`, attribution).
- **TEST 52** — unassigned lecturer CSV batch rejected.
- **TEST 53** — NORMAL CSV row for unregistered student → `PARTIAL`, error summary, persisted status.
- **TEST 54** — correction request for unassigned course rejected.
- **TEST 55** — co-lecturer correction request succeeds and persists.
- **TEST 56** — cross-department co-lecturer rejected by `addCourseTeamLecturer`.
- **TEST 57** — same-department co-lecturer accepted by `addCourseTeamLecturer`.

The test fixtures' course codes were made deterministic uppercase (`Date.now().toString(36).toUpperCase()`) so the normalised CSV path and the stored assignment codes always agree — a fixture-correctness fix, not a behaviour change.

---

## 8. Files touched

| File | Change |
|---|---|
| `src/app/portal/lecturer/actions.ts` | `isAssignedToCourse` helper; co-lecturer CSV authz; NORMAL registration check; correction-request authz |
| `src/app/portal/lecturer/post-results/page.tsx` | OR-scoped assignments query; **new** registered-students roster |
| `src/app/portal/lecturer/post-backlog/page.tsx` | OR-scoped assignments query |
| `src/app/portal/lecturer/course-results/page.tsx` | OR-scoped assignments query |
| `src/lib/module-actions.ts` | `addCourseTeamLecturer` department check |
| `src/lib/academic-workflow.test.ts` | TESTS 51–57; fixture suffix uppercase; afterAll cleanup for `ResultFile`/`ResultCorrectionRequest` |

No changes: schema, migrations, seed, RBAC matrix, audit-log format, `course-results`/`result-correction`/`result-files` actions (already correct).

---

## 9. Recommendations (future work, not part of this milestone)

1. **P3 — Consistency hardening:** normalise course codes at `assignCourse`/`createCourse` time so stored codes are canonical uppercase (removes the theoretical case-mismatch window between stored assignment codes and normalised lookups).
2. **P3 — Backlog data model:** a `resultKind`-aware registration/backlog-eligibility model would let the backlog page show an authoritative roster and enable registration checks there.
3. **P2 — Cross-check `assignLevelAdviser` / `assignLevelCoordinator`** against the department-scope invariant now enforced in `addCourseTeamLecturer`.
4. **P2 — Git hygiene:** commit the untracked migrations (already flagged in the executive-governance audit).
