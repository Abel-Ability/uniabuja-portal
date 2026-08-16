# Final End-to-End Academic Workflow — Live UAT, Integrity Audit & Recovery Checkpoint

**Milestone:** FINAL END-TO-END ACADEMIC WORKFLOW — FINAL LIVE UAT, INTEGRITY AUDIT & RECOVERY CHECKPOINT
**Date:** 16 Aug 2026
**Pre-change SHA:** `40f0fd1`
**Final SHA:** see completion tag `recovery-final-academic-workflow-uat-complete` (this milestone produced no code changes)
**Branch:** `main` (checkpoint branch `recovery/final-academic-workflow-uat`)
**Tags:** `recovery-pre-final-academic-workflow-uat` (preserved) → `recovery-final-academic-workflow-uat-complete`
**Status:** PASS — full academic pipeline verified end to end; all gates green; no code changes required

---

## 1. Executive Summary

This milestone is the final live UAT, integrity audit and recovery checkpoint for
the end-to-end academic workflow:

**HOD CourseOffering → HOD CourseAssignment (main + co-lecturers) → Student
registration & finalisation → Lecturer result submission (CSV) → HOD approval →
Senate approval → Dean faculty oversight → SBC read-only scrutiny → DVC/GOV
oversight → VC executive view → FINAL.**

Everything was verified against the **live embedded PostgreSQL database** through
the actual server-side action functions, plus read-only source audits. The
result pipeline stage order is preserved exactly as recovered and frozen:

```
SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL
```

**No `DEAN_APPROVED`. No `HOD_DEAN`. No schema changes. No RBAC changes. No
workflow changes. No destructive database commands.** The audit found **zero
defects** requiring remediation, so no regression tests were added and no source
files changed — the only new artifact is this report.

Live verification highlights:

- **289/289 integration tests pass** across 18 files (unchanged baseline, zero
  regressions) — including the lock-step end-to-end chain (TESTS 39–50) and the
  lock-step aggregation equality check (TEST 65).
- **Aggregation mathematics independently verified** by a read-only live probe:
  17/17 manual-vs-helper checks PASS across pipeline stage counts, governance
  stats and grade distribution on the live database (6 current-session results:
  `SUBMITTED=1, HOD_APPROVED=1, SENATE_APPROVED=2, FINAL=2`).
- **Every portal workspace page is server-side guarded** (swept all 31 workspace
  directories; HOD/DEAN/BURSARY/LECTURER/STUDENT via role gates, DVC/SBC/VC via
  dedicated `require*` guards).
- **Gates:** `tsc` 0 errors, `lint` 0 errors / 45 warnings (unchanged), `npm
  test` 289/289, `npm run build` succeeds.

---

## 2. Scope & Methodology

**In scope (read-only verification):** every stage of the academic pipeline,
role-based workspace/navigation/help integrity, aggregation mathematics, security
and tamper resistance, database safety, and gate re-verification.

**Not in scope (by design):** schema, RBAC matrix, role strings, approval-stage
changes, production data, and any redesign of recovered functionality.

**Evidence tiers used throughout:**

| Tier | Description |
|---|---|
| **Live integration test** | Existing vitest suite invoked against the running embedded PostgreSQL (module actions executed server-side). |
| **Live probe** | A temporary read-only script against the live DB, compared helpers to manually computed ground truth; script deleted afterwards. |
| **Source audit** | Read-only review of server actions/pages/guards. |

**Honest-evidence note:** no browser/UI automation tooling is available in this
environment. Interactive UI behaviour (clicks, rendering) is verified through the
server-side action/page code the UI invokes and the integration tests that
exercise it; this is explicitly labelled rather than claimed as a browser test.

---

## 3. Baseline (Pre-Milestone, Verified)

| Item | Baseline |
|---|---|
| `git rev-parse HEAD` | `40f0fd1` (prior navigation/help milestone report commit) |
| Working tree | 55 untracked files (junk only: probes, output txts, `data/`, `.kimchi/`, `orig_*`, `vercel-*`); **no tracked modifications** |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 45 warnings (pre-existing) |
| `npm test` | 18 files / **289 tests passing** |
| `npm run build` | succeeds (Next.js 16.3.0) |
| Database | embedded PostgreSQL running (`scripts/start-db.ts`); 37,960 students |
| Pipeline | `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL` (frozen) |

---

## 4. Checkpoint & Recovery State

| Item | Value |
|---|---|
| Checkpoint branch | `recovery/final-academic-workflow-uat` @ `40f0fd1` |
| Pre-milestone tag | `recovery-pre-final-academic-workflow-uat` |
| Prior preserved tags | `recovery-pre-navigation-help`, `recovery-role-navigation-help-complete` |
| Completion tag | `recovery-final-academic-workflow-uat-complete` (created in §22) |

The pre-milestone state is recoverable at any time via the tag. This is the
**third preserved recovery checkpoint** for the portal (navigation/help, then
this final academic-workflow checkpoint).

---

## 5. Role-Based Workspace Matrix (UAT §3) — **PASS**

Live verification: `navigation-help.test.ts` (16 tests) asserts landings, menus,
results routing and help for **every** role; a full workspace page-guard sweep
was performed across all 31 `src/app/portal/*` directories.

| Role | Login destination (`landingForRole`) | Sidebar (`dashboardForRole`) | Results destination (`resultsForRole`) | Server guard |
|---|---|---|---|---|
| STUDENT | `/portal/student` | Student Dashboard | shared `/portal/results` | role gate (5 pages) |
| LECTURER | `/portal/lecturer` | Lecturer Dashboard | shared `/portal/results` | role gate (8 pages) |
| HOD | `/portal/hod` | HoD Dashboard | `/portal/hod/approvals` | role gate (10 pages) |
| DEAN | `/portal/dean` | Dean Dashboard | `/portal/dean/results` | role gate (10 pages) |
| BURSARY | `/portal/bursary` | Bursary Dashboard | shared `/portal/results` | role gate (14 pages) |
| SBC_CHAIRMAN | `/portal/sbc` | SBC Dashboard | `/portal/sbc/results` | `requireSbcChairman` (6 pages) |
| DVC_OVERSIGHT / GOVERNANCE_OVERSIGHT_MEMBER | `/portal/dvc` | Oversight Dashboard | `/portal/dvc/academic` | `requireGovernanceOversight` (12 pages) |
| VC | `/portal/vc` | VC Dashboard | `/portal/vc/results` | `requireVC` (17 pages) |
| APPLICANT | `/portal/applications` | generic | shared | role gate |
| REGISTRY / IT_ADMIN | `/portal/admin` | generic | shared | role gate |
| EXAMS_RECORDS | `/portal/results` | generic | shared | role gate |
| VERIFIER | `/portal/results` | generic | shared | role gate |
| STUDENT_AFFAIRS / PG_SCHOOL / SIWES / TIMETABLE | own workspace | generic | shared | role gate |

Guard sweep: every one of the 31 workspace directories' pages carries a
server-side guard — HOD 10 pages/20 refs, DEAN 10/27, LECTURER 8/16, STUDENT
5/10, BURSARY 14/24, SBC 6/12, DVC 12/24, VC 17/34 (2 refs per page:
`requireSession`-style check + role redirect/`landingForRole`). No page was found
unguarded.

**Verdict: PASS** — every role lands on its own workspace, sees its own menu, is
routed to its own results surface, and every page is hard-gated server-side.

---

## 6. HOD — Course Offerings (UAT §4) — **PASS**

Source audit of `createCourseOffering` / `setCourseOfferingStatus`
(`src/lib/module-actions.ts:2370`):

- Role gate: HOD only + `stepUpGuard` (defense in depth).
- `faculty`/`department` derived from the **session**, never the client.
- Course must exist in the DB **and** pass `courseInDepartmentCatalogue` — a HOD
  can only create offerings for courses in their own department.
- Academic session from the existing session list; semester validated and forced
  to the course's designated semester; level restricted to the department's valid
  levels; programme (optional) must belong to the department.
- Status whitelist `ACTIVE | INACTIVE`.
- **Duplicate prevention:** pre-check `findFirst` (covers the nullable-`programmeId`
  case that Postgres treats as distinct) + unique-constraint `P2002` guard on
  `@@unique([courseId, programmeId, academicSession, semester, level])`.
- Audit entry `COURSE_OFFERINGS/CREATE` written on every change.

`CourseOffering` ≠ `CourseAssignment` — registrability is never conflated with
teaching authority.

**Verdict: PASS.**

---

## 7. HOD — Course Assignment & Team (UAT §5) — **PASS**

Source audit of `assignCourse` / `unassignCourse` / `addCourseTeamLecturer`
(`src/lib/module-actions.ts:2171`):

- Role gate: HOD only + `stepUpGuard`.
- `faculty`/`department` derived from the session; course must exist and be in the
  department's catalogue.
- Main lecturer: must be role `LECTURER` **and** in the same department.
- Co-lecturers: deduplicated, distinct from the main, each must be `LECTURER` in
  the same department.
- `courseTitle` taken from the database (`course.title`); client-supplied
  `faculty`/`department`/`courseTitle` ignored.
- Upsert keyed on `@@unique([courseCode, academicSession, semester])` → no
  duplicate assignments; team members are replaced atomically so the co-lecturer
  set always matches the submitted form.
- `unassignCourse` is department-scoped; audit written on every change
  (`EXAMS_RECORDS/CREATE|DELETE`).

Coverage: TESTS 1–6, 39.

**Verdict: PASS.**

---

## 8. Student Registration & Finalisation (UAT §6) — **PASS**

Live verification: `academic-workflow.test.ts` (TESTS 7–15, 40), 
`student-registration.test.ts`, `registration-finalisation.test.ts` (TEST 14:
unpaid fees block finalisation; immutability).

- Eligibility derived server-side from ACTIVE offerings (course + programme +
  level + session/semester) — TESTS 7–10.
- Capacity → waitlist (TEST 11); prerequisite enforcement (TEST 13).
- Tampered `courseId` rejected (TEST 12); drop only for own registrations (TEST 14).
- Finalisation creates an immutable registration header
  (`CR-\d{4}-\d{6}` reference, `FINALIZED`, `totalUnits ≥ 18`, registration
  locked against further changes) — TEST 15.
- Bursary fee clearance enforced at finalisation (registration-finalisation
  suite); fee-reblock / reconcile / waiver flows covered by
  `bursary-workspace.test.ts`.

**Verdict: PASS.**

---

## 9. Lecturer Result Submission (UAT §7) — **PASS**

Source audit of `postResults` (`src/app/portal/lecturer/actions.ts:137`) + live
tests (TESTS 16–20, 41, 46):

- Role gate: `LECTURER` only.
- **Assignment-scoped:** `isAssignedToCourse` verifies the actor is the main
  lecturer **or** a co-lecturer for the exact course + session + semester
  (backlog `semester 0` scoped by course + session only).
- Course/session/semester validated server-side (`SESSION_RE`, semester ∈ 0–2,
  `caMax` whitelist 20–70).
- CSV: 3-column format enforced (`MATRIC_NO, CA, EXAM`), ≤ 512 KB, `MAX_ROWS`
  cap, per-row bounds (CA 0–caMax, EXAM 0–100, CA+EXAM ≤ 100), TOTAL + GRADE
  computed automatically (`gradeForTotal`).
- Student resolved by registration number; NORMAL uploads additionally require
  the student's ACTIVE registration for that course/session/semester.
- FINAL results immutable — lecturer edits rejected (TEST 46).

**Verdict: PASS.**

---

## 10. HOD Results Review (UAT §8) — **PASS**

Live tests (TESTS 22–25): HOD approves only `SUBMITTED` results in their own
department; cross-department and wrong-stage attempts rejected with no mutation
and no audit; non-HOD approval attempts rejected. `/portal/hod/approvals` is the
HOD results surface (guard verified in §5).

**Verdict: PASS.**

---

## 11. Dean Results Review (UAT §9) — **PASS**

Live tests (TESTS 26–29, 44, 66):

- Dean has **return-only** authority — `returnResult` moves `HOD_APPROVED →
  SUBMITTED`, requires step-up and an unconditional faculty-scope check.
- The Dean **cannot approve** — `approveResult` returns an error and leaves the
  row at `SUBMITTED` (TEST 66). This is the definitive no-`DEAN_APPROVED`
  confirmation: faculty level has **no new write authority**.
- Cross-faculty and wrong-stage returns rejected.

**Verdict: PASS.**

---

## 12. Senate Business Committee (UAT §10) — **PASS**

Live tests (TESTS 30–32) + guard sweep:

- Every SBC page is hard-gated by `requireSbcChairman` (any other role — HOD,
  Dean, DVC, VC — is redirected to its own landing).
- SBC attempts to approve/finalise/enter grades are rejected
  (`/cannot approve/`, `/Only the Exams & Records office/`, `/cannot enter
  grades/`).
- Read-only oversight helpers (results pipeline, decisions, matters) readable.

**Verdict: PASS.**

---

## 13. DVC / Governance Oversight (UAT §11) — **PASS**

Live tests (TESTS 33–35, 49–50) + guard audit:

- `requireGovernanceOversight` gates all 12 DVC pages on **an ACTIVE
  GOVERNANCE_COMMITTEE membership row** — the boundary is the membership, not
  the job title; a governance role without membership is sent to the dashboard
  (loop-safe by design).
- Governance mutation attempts rejected; oversight dashboards readable.
- `governanceExceptions()` register and hash-chained audit (`verifyChain`
  intact, TESTS 49–50) verified on the live DB.

**Verdict: PASS.**

---

## 14. VC Executive Oversight (UAT §12) — **PASS**

Live tests (TESTS 36–38) + guard audit:

- `requireVC` gates all 17 VC pages; non-VC roles redirected.
- VC reads university-wide stats via `getUniversityAcademicStats` /
  `resultsPipeline`; mutation attempts are impossible (read-only posture).

**Verdict: PASS.**

---

## 15. End-to-End Workflow Trace (UAT §13) — **PASS**

Live integration evidence: TESTS 39–50 execute a **single course** through the
entire chain against the live DB:

| Step | Actor | Result | Test |
|---|---|---|---|
| Allocate course (main + co) | HOD | assignment + team rows | 39 |
| Register course | Student | ACTIVE row | 40 |
| Submit grade | Main lecturer | `SUBMITTED` | 41 |
| Approve | HOD | `HOD_APPROVED` | 42 |
| Record Senate approval | Exams & Records | `SENATE_APPROVED`, `published: true` | 43 |
| Faculty oversight | Dean | return ok / scope respected | 44 |
| Finalise | Exams & Records | `FINAL`, `finalisedAt` stamped | 45 |
| Immutability | all | edits/approve/return/finalise rejected | 46 |
| Student reads result | Student | readable, same value | 47 |
| Pipeline reflects | HOD/EXAMS/VC | `completionPct` updated | 48 |
| Audit chain | — | hash chain intact | 49 |
| Stage order | — | `SUBMIT` (registration) → `APPROVE ×2` → `FINALIZE` | 50 |

Every transition above is enforced by a server-side action; the suite is
self-contained (all fixtures created and removed within the test file; zero
residue confirmed).

**Verdict: PASS.**

---

## 16. Aggregation Mathematics (UAT §14) — **PASS**

Two independent layers of evidence:

**1) Lock-step equality (TEST 65, live DB):** for a controlled two-course
dataset, department / faculty / university views agree exactly; per-stage counts
match a raw `groupBy` ground truth; historical-session rows are excluded from the
current-session pipeline; `resultsPipeline` and `governanceStats` are consistent
with the same stage counts.

**2) Independent live probe (read-only, deleted afterwards):** manual
computation from raw rows compared against the helper functions on the live
database. **17/17 checks PASS:**

- `pipeline.total` = manual total (6), each stage count (`SUBMITTED=1`,
  `HOD_APPROVED=1`, `SENATE_APPROVED=2`, `FINAL=2`) matches manual `groupBy`.
- `resultsPipeline(10000)` and `governanceStats()` reproduce the same counts.
- Pass/fail math over FINAL results: `passed(≥40) + failed(<40) == FINAL total`
  (2 = 2); `grade = F` subset consistent.
- Per-course registered vs submitted: for CSC201/202/203, MTH201/202 —
  `registered = submitted = 1`, `outstanding = 0`, `submitted ≤ registered` holds.
- `studentOverview.total` = 37,960 = manual student count.

Aggregation across course → department → faculty → university uses the shared
stage-consistent helpers in `src/lib/academic-stats.ts` (verified consistent
with the pipeline helpers in `src/lib/governance.ts`).

**Verdict: PASS.**

---

## 17. Security & Tampering (UAT §15) — **PASS**

Tamper/negative coverage, all live:

| Scenario | Test |
|---|---|
| Tampered `courseId` during registration | 12 |
| Tampered `courseId` during grade entry | 20 |
| HOD approves cross-department result | 23 |
| Dean returns cross-faculty result | 27 |
| SBC / GOV mutation attempts | 30, 31, 33, 38 |
| FINAL immutability | 46 |
| Dean cannot approve (no `DEAN_APPROVED`) | 66 |
| Help never exposes another role's capabilities | navigation-help suite |
| Unknown-role landing fallback | navigation-help suite |

Every mutation flows through `can()` / role gates / `stepUpGuard` /
`require*` guards and writes a hash-chained `audit()` entry; no identity field is
trusted from the client (verified in §§6–9 source audits).

**Verdict: PASS.**

---

## 18. Account-Specific Help (UAT §16) — **PASS**

Live verification: `navigation-help.test.ts` (TESTS: help section):

- Every role in the system receives accurate help content (`helpForRole` + a
  module-derived generic fallback for unknown roles).
- Help is **session-role scoped** — it never reveals another role's
  capabilities, and `?from=` context resolves only within the user's own role.
- Help sections mirror the sidebar.

**Verdict: PASS.**

---

## 19. Navigation Integrity (UAT §17) — **PASS**

Live verification: `navigation-help.test.ts`:

- Every role lands on its own workspace and is routed to its own results surface
  (asserted per role; dead VC menu links removed).
- Every menu is non-empty, has no duplicate hrefs, and every href points at an
  existing route.
- Dashboard entry matches menu start so the shell de-duplicates it.

**Verdict: PASS.**

---

## 20. Database Safety (UAT §18) — **PASS**

- **No** `prisma migrate reset`, `db push`, `migrate dev`, `db seed`, or other
  destructive/SQL commands were executed.
- No schema files changed (`prisma/schema.prisma` verified byte-identical
  intent: `Result.gradeStatus` enum `SUBMITTED | HOD_APPROVED | SENATE_APPROVED |
  FINAL` at line 422; no `DEAN_APPROVED`, no `HOD_DEAN`).
- Test fixtures are created and removed within their own suite — zero residue
  (consistent with prior milestones).
- The aggregation probe was read-only and deleted immediately after use.

**Verdict: PASS.**

---

## 21. Verification Gates (UAT §19) — **PASS**

| Gate | Baseline | After | Status |
|---|---|---|---|
| `npx tsc --noEmit` | 0 errors | 0 errors | PASS |
| `npm run lint` | 0 errors / 45 warnings | 0 errors / 45 warnings | PASS |
| `npm test` | 18 files / 289 passed | 18 files / 289 passed | PASS |
| `npm run build` | succeeds | succeeds | PASS |

The audit found **zero genuine defects**, so no regression tests were added and
no source files changed (previous count 289 preserved; no new warnings
introduced).

---

## 22. Commit & Tag (UAT §20)

Only the meaningful artifact of this milestone — this report — was staged and
committed (junk files excluded per standing decision). Final record:

- **Pre-change SHA:** `40f0fd1`
- **Final SHA:** the report commit itself, tagged `recovery-final-academic-workflow-uat-complete` (this milestone produced no code changes, so the report commit is the completion commit)
- **Branch:** `main`; checkpoint branch `recovery/final-academic-workflow-uat` preserved
- **Tags:** `recovery-pre-final-academic-workflow-uat` (preserved) → `recovery-final-academic-workflow-uat-complete`
- **Files changed:** `docs/FINAL_END_TO_END_ACADEMIC_WORKFLOW_UAT_REPORT.md` (this file) only

---

## 23. STOP Conditions Status (UAT §21)

| Condition | Met? |
|---|---|
| Schema change required | **No** — none needed |
| RBAC weakening required | **No** — matrix untouched |
| Approval-stage change required | **No** — pipeline frozen and proven |
| `HOD_DEAN` reintroduction required | **No** — absent and unneeded |
| Reverting prior recovery required | **No** — all prior work preserved |
| Production data endangered | **No** — read-only verification only |
| Unclear authorization boundary | **No** — every boundary verified |
| Unexplained aggregation discrepancy | **No** — 17/17 probe checks + lock-step equality |

No STOP was triggered. **No blocked state.**

---

## 24. Regression Safety

- All 289 pre-existing tests (incl. bursary, transcripts, clearance, governance,
  student stats, navigation/help) still pass — no regressions.
- Pipeline stage order and `published` semantics unchanged (TESTS 22–28, 43).
- RBAC (`ACCESS_CONTROL_MATRIX`), role strings, and all `require*` guards
  unchanged.
- No unrelated modules modified (only this report was added).

---

## 25. Remaining Findings & Deferred Items

No new findings from this milestone. Standing deferred items (from prior
milestones, unchanged, all ⚪/🟡 and out of scope for a verification checkpoint):

- Interactive browser UI walkthrough (F10) — requires browser tooling; not
  performed. All server-side behaviour this milestone verifies was exercised
  through the live integration tests and probes instead.

---

## 26. Final Summary & Sign-off

The end-to-end academic workflow is **verified live, end to end, and free of
defects**:

1. Pipeline `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL` is reachable,
   enforced and immutable after finalisation — proven by TESTS 39–50 and TEST 66.
2. Every write action is authorized server-side from a session-derived scope —
   proven by source audit (§§6–9) and tamper tests (§17).
3. Aggregation mathematics agree at every level — proven by TEST 65 and the
   17/17 independent live probe (§16).
4. Every role lands, navigates, helps and is guarded correctly — proven by the
   role-matrix sweep (§5) and the navigation/help suites (§§18–19).
5. Database safety held throughout — no destructive commands, zero residue (§20).
6. All gates green (§21): tsc 0 errors, lint 0 errors/45 warnings, tests
   289/289, build succeeds.

**Overall status: PASS.** The portal is confirmed healthy and recoverable at the
new completion tag.

---

*Report written during the FINAL END-TO-END ACADEMIC WORKFLOW milestone.
Evidence = live integration tests + read-only source audits + independent live
probe (deleted). No browser/UI automation was used; server-side code the UI
invokes was verified instead.*
