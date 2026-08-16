# Executive & Governance Role / RBAC Recovery — Milestone Report

Status: **COMPLETE** — 2026-08-15
Audit source: `docs/EXECUTIVE_GOVERNANCE_RECOVERY_AUDIT.md`

## 1. Summary

This milestone restores the executive and governance roles that the audit found
partially wired: the legacy **HOD** role (redirect loop, strict guards, broken
approve action), the **Dean of Faculty** (previously a role with no
`ROLE_LABELS`/matrix entry and a phantom `DEAN_APPROVED` pipeline stage), the
**SBC Chairman** and **Governance & Oversight Committee Member** (labels/matrix
gaps, no demo accounts, no governance membership), and the **DVC** demo access
(no committee membership seeded, so the guard could never pass). The real
results pipeline `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL` is
unchanged; the phantom `DEAN_APPROVED` stage was removed from reporting.

## 2. Scope & constraints honoured

- No changes to `prisma/schema.prisma`; no new or modified migrations.
- No migrations / `db:reset` / `db:push` run; **no re-seed of the live database**
  performed (seed edits are file-only until explicitly authorized).
- No CSV/Google-Sheet import; `scripts/generate-demo-users.mjs` not run.
- No alteration of real staff/student records.
- CourseOffering / CourseRegistration / Registration architecture untouched.
- `ACCESS_CONTROL_MATRIX` not weakened — additions only grant the same
  permissions the equivalent role already holds.
- Server-side authorization remains authoritative.

## 3. Baseline (pre-change) verified state

- `npm test`: 14 files / 185 tests passing; `npx tsc --noEmit`: 0 errors;
  `npm run lint`: 0 errors / 41 warnings; `npm run build`: success.
- DB: embedded PostgreSQL 18.4 running; `DATABASE_URL` set to
  `postgresql://portal:password@localhost:5432/portal`.

## 4. Roles added

`src/lib/constants.ts` → `ROLE_LABELS`:

- `HOD` → "Head of Department" (legacy peer of `HOD_DEAN`)
- `DEAN` → "Dean of Faculty"
- `SBC_CHAIRMAN` → "Senate Business Committee Chairman"
- `GOVERNANCE_OVERSIGHT_MEMBER` → "Governance & Oversight Committee Member"

Labels flow automatically through `portal-shell.tsx`, the account page, the
`/api/v1/me` endpoint, and the help/health pages (`ROLE_LABELS[role] ?? role`).

## 5. RBAC matrix changes

`src/lib/constants.ts` → `ACCESS_CONTROL_MATRIX`:

- **`HOD`** row mirroring `HOD_DEAN` (`EXAMS_RECORDS` A, `GRAD_CLEARANCE` A,
  read/`RW` on the same modules). This is what makes `can("HOD", …)` pass in
  `approveResult` — the centralized path — without loosening anything.
- **`DEAN`** row — read-only oversight over `ADMISSIONS`, `EXAMS_RECORDS`,
  `PROFILES`, `GRAD_CLEARANCE`, `PG_RESEARCH`, plus `COMMUNICATIONS` `RW`.
  **No** approval permission: the Dean has no action in the results pipeline.
- **`GOVERNANCE_OVERSIGHT_MEMBER`** row mirroring `DVC_OVERSIGHT` (read-only
  across all modules except `HEALTH`, plus `SENATE` R).
- `SBC_CHAIRMAN` row already existed (`SENATE` RWA, `EXAMS_RECORDS` R,
  `COMMUNICATIONS` RW) — left intact.

`can()`, `permissionsFor()`, `visibleModules()` are unchanged; the new rows
simply populate them. The Dean's `returnResult` remains a bespoke,
Dean-gated server action (not a matrix `A`).

## 6. HOD normalization

All strict `session.user.role !== "HOD"` checks replaced with
`!isHodRole(session.user.role)` (helper from `src/lib/hod.ts`, pre-existing):

- `src/lib/module-actions.ts`: `assignCourse`, `unassignCourse`,
  `assignLevelAdviser`, `deactivateLevelAdviser`, `assignLevelCoordinator`,
  `unassignLevelCoordinator` and the `approveResult` HOD branch (now
  `isHodRole(session.user.role) && gradeStatus === "SUBMITTED"`).
- Page guards: `hod/page.tsx`, `hod/students/page.tsx`,
  `hod/students/[id]/page.tsx`, `hod/level-coordinators/page.tsx`,
  `hod/course-allocation/page.tsx`, `hod/level-advisers/page.tsx`,
  `hod/staff/page.tsx`, `hod/approvals/page.tsx`,
  `hod/students/export/route.ts`.
- Special cases: `portal/level-advisers/page.tsx` (HOD *or*
  `DIRECTOR_ACADEMIC_PLANNING`) and `portal/results/page.tsx` (queue selection
  — legacy `HOD` now sees the HOD approval queue and "Approve (HOD)" button).

The two remaining `appointment.role === "HOD"` matches are **data-field**
checks on appointment records, not session checks — left as-is.

## 7. Dean recovery

- Role added to labels and matrix (§4, §5) — sidebar and `visibleModules` now
  expose exactly the Dean's pages (admissions, results, profiles, clearance,
  PG, communications).
- Removed the broken "Approve (Dean)" button from
  `dean/results/page.tsx` (the gate would always reject a Dean, since no Dean
  approve path exists) and the phantom "Awaiting Dean approval" /
  "Awaiting Senate" stat cards.
- `dean/page.tsx` pipeline-watch grid relabelled to `HoD-approved` and the
  "Awaiting Dean Approval" quick-action badge corrected to "Review Faculty
  Results".
- Dean's only write action, `returnResult` (`HOD_APPROVED → SUBMITTED`,
  faculty-scoped), is unchanged and correctly gated.
- `DEAN_MENU` description updated to "Review and return result submissions".

## 8. SBC Chairman recovery

- Role label added (§4).
- Verified all `sbc/actions.ts` gates resolve via the matrix:
  `SENATE` W (submit/update matter), `SENATE` A (screen / record decision),
  `COMMUNICATIONS` W (publish announcement). Agenda creation stays limited to
  `REGISTRY` / `EXAMS_RECORDS` by design.
- SBC dashboard + results pages de-Phantomised (§11).

## 9. DVC / Governance & Oversight recovery

- The DVC guard (`dvc/guard.ts`) requires an **ACTIVE** `CommitteeMembership`
  on `GOVERNANCE_OVERSIGHT` — the existing, correct authorization mechanism.
  No bypass was introduced. The fix is in the seed (§12): `dvc@` is seeded as
  the committee **CHAIRMAN** and `gov@` as a **MEMBER**, both `ACTIVE`, which is
  what the guard checks.
- `GOVERNANCE_OVERSIGHT_MEMBER` added to labels/matrix so the `/portal/dvc`
  workspace renders correctly for ordinary members too.

## 10. VC consistency

- VC pages already correct; `vc/results/page.tsx` and `vc/academic/page.tsx`
  updated to the 4-stage pipeline (§11).

## 11. Phantom `DEAN_APPROVED` reconciliation

Chosen design (matches the audit's recommendation and the design doc): the Dean
is read-only; no `DEAN_APPROVED` stage exists. Removed the phantom from:

- `src/lib/governance.ts`: `GovernanceStats.results`, `governanceStats`
  counts/total, `governanceExceptions` (deleted the "results-dean-approved"
  exception), `facultyComparison`, and `RESULT_STAGE_ORDER`
  (now `["SUBMITTED", "HOD_APPROVED", "SENATE_APPROVED", "FINAL"]`).
  The "results-hod-approved" exception text was corrected to "Results awaiting
  Senate finalisation" (it previously claimed the Dean was next in line).
- `src/lib/faculty.ts`: `FacultyResultStats` and `facultyStats` no longer
  compute `deanApproved`.
- `dean/page.tsx`, `dean/results/page.tsx`, `vc/results/page.tsx`,
  `sbc/page.tsx`, `sbc/results/page.tsx`: removed the Dean-approved stat cards,
  stages and outstanding rows.
- `dvc/academic/page.tsx`: subtitle corrected (Dean has no approval stage).

No schema change: any legacy `DEAN_APPROVED` rows in the database are simply
not final, never counted, and never reported.

## 12. Seed changes (`prisma/seed.ts`, file-only)

- `hod@` and `lecturer@` now carry `faculty: "Science"`,
  `department: "Computer Science"` so the HOD and Dean workspaces have data.
- `dvc@` gains `faculty`/`department`.
- New demo accounts: `dean@` (DEAN, Science), `sbc@` (SBC_CHAIRMAN),
  `gov@` (GOVERNANCE_OVERSIGHT_MEMBER).
- Two `CommitteeMembership` rows (dvc@ CHAIRMAN, gov@ MEMBER — ACTIVE).
- Senate demo rows: two `SenateMatter`s (one SUBMITTED, one SCREENED + a
  recorded decision), one published `SenateAgenda`, and a DEAN-scoped
  announcement.
- New users were **appended** to the users array so the existing positional
  destructuring (which deliberately elides `pgschool` and `vc`) is preserved.

## 13. Read-only view consistency

The Dean's sidebar now exposes admissions, results, postgraduate and (via HOD
peer) the same read-only views `HOD_DEAN` sees. `HOD`/`DEAN` were added to the
view-mode role lists in `applications`, `postgraduate`, `timetabling`, `lms`,
`siwes`, `library` and `transcripts` pages, and to the staff-count query in
`portal/dashboard/page.tsx`.

## 14. Files changed

- `src/lib/constants.ts` (labels, matrix, menu description)
- `src/lib/module-actions.ts` (isHodRole guards, approveResult branch)
- `src/lib/governance.ts` (DEAN_APPROVED reconciliation)
- `src/lib/faculty.ts` (facultyStats / interface)
- `prisma/seed.ts` (accounts, membership, senate demo rows)
- HOD pages: `src/app/portal/hod/*` (+ `hod/students/export/route.ts`)
- `src/app/portal/level-advisers/page.tsx`, `src/app/portal/results/page.tsx`
- `src/app/portal/dean/{page,results/page}.tsx`
- `src/app/portal/vc/results/page.tsx`, `src/app/portal/vc/academic/page.tsx`
- `src/app/portal/sbc/{page,results/page}.tsx`
- `src/app/portal/dvc/academic/page.tsx`
- `src/app/portal/{applications,postgraduate,timetabling,lms,siwes,library,transcripts,dashboard}` (view-mode lists)

## 15. Tests

- New `src/lib/hod.test.ts` — `isHodRole`/`HOD_ROLES` (positive + negative
  across every role).
- `src/lib/constants.test.ts` — matrix assertions for `HOD`, `DEAN`,
  `SBC_CHAIRMAN`, `GOVERNANCE_OVERSIGHT_MEMBER` (Dean cannot approve, SBC can
  run Senate but never touches the results pipeline, GOV reads like the DVC);
  role-label coverage for all `ROLES`.
- `src/lib/governance.test.ts` — `RESULT_STAGE_ORDER` equals the real
  four-stage pipeline and excludes `DEAN_APPROVED`.

## 16. Verification results

- `npx tsc --noEmit` → **0 errors**
- `npm run lint` → **0 errors / 41 warnings** (unchanged from baseline)
- `npm test` (DB running) → **15 files / 195 tests, all passing**
  (185 baseline + 10 new)
- `npm run build` → **success**

## 17. Demo accounts

All use password `UniAbuja@2026` (forced change on first login):

| Username | Role | Notes |
| --- | --- | --- |
| `hod@uniabuja.edu.ng` | HOD_DEAN | now has Science / Computer Science |
| `dean@uniabuja.edu.ng` | DEAN | faculty-scoped read-only oversight |
| `sbc@uniabuja.edu.ng` | SBC_CHAIRMAN | Senate business + read-only grades |
| `gov@uniabuja.edu.ng` | GOVERNANCE_OVERSIGHT_MEMBER | shares `/portal/dvc` |
| `dvc@uniabuja.edu.ng` | DVC_OVERSIGHT | ACTIVE committee CHAIRMAN membership |

**Live DB note:** the new accounts/membership exist only in `seed.ts` until a
re-seed is explicitly authorized (see §19).

## 18. Known limitations / deferred

- Live database not re-seeded → `dean@`/`sbc@`/`gov@` do not yet exist and the
  DVC guard still blocks `dvc@` on the live DB.
- Legacy `DEAN_APPROVED` rows may persist in the database; they are inert and
  unreported.
- `scripts/generate-demo-users.mjs` staff CSV import remains out of scope.
- Pre-existing ESLint warnings (41) untouched.

## 19. Risks & required authorization

- **Re-seeding is required to make the new roles usable in demo**: run
  `npm run db:reset && npm run db:seed` (drops the database) or a scripted
  `upsert` for the five accounts + two committee memberships. Neither was run.
- `DIRECTOR_ACADEMIC_PLANNING` still has no matrix row/label (its page-level
  special case remains); it is outside this milestone's role set.

## 20. Rollback

- All changes are source-only. Revert the listed files; the live database is
  untouched and requires no rollback. Re-running the suite restores the
  baseline (185 tests) automatically.

## 21. Next steps (STOP — do not proceed without instruction)

- Obtain authorization to apply the seed changes to the live DB.
- Consider a matrix row for `DIRECTOR_ACADEMIC_PLANNING` in a future milestone.
- Restore the staff roster via the approved import path (separate milestone).

**Milestone complete.**
