# Executive & Governance Layer — Recovery Audit

**Date:** 2026-08-15
**Mode:** READ-ONLY. No source, schema, migration, database, seed, RBAC, spreadsheet or data changes were made. The only file written is this audit document. See the "AUDIT SAFETY CONFIRMATION" at the end.
**Auditor scope:** Executive & Governance layer only — Vice-Chancellor (VC), Deputy Vice-Chancellor / Governance & Oversight (DVC), Senate Business Committee (SBC), Dean of Faculty, Head of Department (HOD) — plus the shared authorization, audit-logging and database structures those workspaces depend on.
**Related prior audits:** `docs/RECOVERY_AUDIT.md` (2026-08-14, full portal baseline), `docs/DATABASE_RECOVERY_AUDIT.md` (2026-08-14, schema/migrations), `docs/DEAN-WORKSPACE.md` (design notes for the Dean workspace).
**Commands run this session:** `npm test` (vitest), `npx tsc --noEmit`, `npm run lint`, read-only source reads and greps. `npm run db:start` was started (environmental; the cluster had been shut down — see §16).

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not verifiable in this run

---

## 1. Executive summary

The executive & governance layer is **structurally complete** — the VC, DVC/Governance, SBC, Dean and HOD workspaces all exist as real pages with server-side guards, and the schema fully supports them (16 migrations, hash-chained audit log, committee membership, senate business models, course offerings, registration headers). The build, typecheck and all **185 tests pass** once the local database is running.

However the layer is **not reachable or consistent in the demo** because of a set of role-wiring defects that the prior audits already flagged (§17 of `RECOVERY_AUDIT.md`) and that are **still present today**:

- 🔴 **HOD workspace redirect loop (P0).** `hod/page.tsx:18` guards `session.user.role !== "HOD"` but the seed account is `HOD_DEAN`, and `landingForRole("HOD_DEAN")` returns `/portal/hod` → infinite redirect. Every HOD page uses the same strict `"HOD"` guard.
- 🔴 **HOD result approval is unreachable (P1).** `approveResult` (module-actions.ts:1307) requires strict `role === "HOD_DEAN"` (line 1323) to move `SUBMITTED → HOD_APPROVED`, but the approvals page is gated on `"HOD"`. A `"HOD"` account can view the page yet has **no `HOD` row in the access matrix** (`can("HOD", …)` is empty), so approval always fails; a `"HOD_DEAN"` account never reaches the page.
- 🔴 **Dean workspace unreachable (P1).** `DEAN` is not in `ROLE_LABELS` (constants.ts:176-192), not in `ACCESS_CONTROL_MATRIX`, and no `DEAN` account is seeded; every Dean page guards `role !== "DEAN"`.
- 🔴 **SBC workspace unreachable (P1).** `SBC_CHAIRMAN` is in the matrix and `landingForRole` but **not** in `ROLE_LABELS`, and no account is seeded.
- 🟡 **DVC demo-blocked (P2).** `DVC_OVERSIGHT` exists and is seeded (`dvc@`), but `dvc/guard.ts` hard-gates on an **ACTIVE `CommitteeMembership` row** for the `GOVERNANCE_OVERSIGHT` committee; the seed creates none → the DVC demo user is bounced to `/portal/dashboard`.
- 🔴 **Phantom pipeline stage.** `src/lib/governance.ts` reasons about a `DEAN_APPROVED` result stage (`governanceStats`, `governanceExceptions`, `facultyComparison`, `RESULT_STAGE_ORDER`), but **no code path ever sets it** — the real pipeline is `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`. Governance reports for Dean-approval therefore always read zero.
- 🟡 **Seed provisioning gaps.** No `SBC_CHAIRMAN`, `DEAN`, `GOVERNANCE_OVERSIGHT_MEMBER`, `VERIFIER`, `DIRECTOR_ACADEMIC_PLANNING` users; no committee memberships; no senate matters/decisions/agendas; no appointments; no course offerings/assignments. `data/staff.csv` (793 rows) exists but has **no importer**.
- 🟡 **Git hygiene.** Only `init_postgres` and `email_verification` migrations are tracked; all 14 later migrations are **untracked** in git.

The good news for recovery: since `RECOVERY_AUDIT.md` and `DATABASE_RECOVERY_AUDIT.md` were written (both 8/14), the **application layer for course offerings and registration has been fully rebuilt** — real `createCourseOffering`/`setCourseOfferingStatus` server actions, a department-scoped offerings list, a working `[id]/detail` route, and a `Registration` header with an immutable reference and locking. These were the 🔴 "missing application" items in the prior audits and are now present and tested (§13).

No migration is required for any of the remaining executive-layer gaps; every finding is **application-level** (role strings, guards, seed data). See §18 for the priority roadmap.

---

## 2. Role architecture (constants, matrix, landing, helpers)

Defined in `src/lib/constants.ts` (775 lines). All roles are **plain strings** on `User.role`; there is no Role table (a deliberate design).

- `ROLE_LABELS` (176-192) — 15 roles: `APPLICANT`, `STUDENT`, `LECTURER`, `HOD_DEAN`, `REGISTRY`, `BURSARY`, `STUDENT_AFFAIRS`, `EXAMS_RECORDS`, `PG_SCHOOL`, `SIWES`, `TIMETABLE`, `IT_ADMIN`, `DVC_OVERSIGHT`, `VC`, `VERIFIER`.
- `ROLES = Object.keys(ROLE_LABELS)` (194).
- `ACCESS_CONTROL_MATRIX` (276-437) — per-role per-module permissions `P("R|W|A|S|V")`.
- `can(role, module, perm)` (≈440-460) → `ACCESS_CONTROL_MATRIX[role]?.[module] ?? []`.
- `visibleModules(role)` (≈452) → module keys with non-empty permission sets.
- `landingForRole(role)` (602-641) — see table below.

### Executive/gov roles vs. their definitions

| Role string | In `ROLE_LABELS` | In `ACCESS_CONTROL_MATRIX` | In `landingForRole` | Seed account | Guard on workspace |
|---|---|---|---|---|---|
| `HOD_DEAN` | ✅ 180 | ✅ 312 | ✅ → `/portal/hod` (611) | ✅ `hod@` (seed.ts:118) | ❌ no HOD_DEAN guard; HOD pages want `HOD` |
| `HOD` | ❌ | ❌ | ✅ → `/portal/hod` (610) | ❌ | ✅ strict `role !== "HOD"` (all pages) |
| `DEAN` | ❌ | ❌ | ✅ → `/portal/dean` (613) | ❌ | ✅ strict `role !== "DEAN"` (all pages) |
| `SBC_CHAIRMAN` | ❌ | ✅ 336 | ✅ → `/portal/sbc` (636) | ❌ | ✅ strict `role !== "SBC_CHAIRMAN"` (sbc/guard.ts:10) |
| `DVC_OVERSIGHT` | ✅ 189 | ✅ 394 | ✅ → `/portal/dvc` (631) | ✅ `dvc@` (seed.ts:163) | ✅ via membership (dvc/guard.ts) |
| `GOVERNANCE_OVERSIGHT_MEMBER` | ❌ | ❌ | ✅ → `/portal/dvc` (632) | ❌ | ✅ via membership (dvc/guard.ts) |
| `VC` | ✅ 190 | ✅ 413 | ✅ → `/portal/vc` (634) | ✅ `vc@` (seed.ts:168) | ✅ strict (vc/guard.ts:8) |
| `VERIFIER` | ✅ 191 | ✅ 433 | ⚪ (no case → `/portal/dashboard`) | ❌ | n/a |

**Root cause of every executive-blocking finding:** the four workspaces (HOD, Dean, SBC, DVC) each guard on a role string that is **not consistently defined** across labels/matrix/landing/seed. The VC workspace is the only one that is internally consistent (`VC` exists everywhere and is seeded), which is why only the VC demo login works.

### Seed users (prisma/seed.ts)

15 rows (all `passwordHash` of `UniAbuja@2026`, email-verified): `applicant@`, `student@`, `pgstudent@` (STUDENT), `lecturer@` (LECTURER), **`hod@` (HOD_DEAN)**, `registry@`, `bursary@`, `studentaffairs@`, `exams@`, `pgschool@`, `siwes@`, `timetable@`, `itadmin@`, **`dvc@` (DVC_OVERSIGHT)**, **`vc@` (VC)**, `alumni@` (STUDENT).

Not seeded at all: **DEAN, SBC_CHAIRMAN, GOVERNANCE_OVERSIGHT_MEMBER, VERIFIER, DIRECTOR_ACADEMIC_PLANNING**, any `CommitteeMembership`, any `SenateMatter/SenateDecision/SenateAgenda`, any `Appointment`, any `CourseOffering`/`CourseAssignment`.

`hod@` and the other staff-role demo users carry **no `faculty`/`department`** value, so even after the guard mismatch is fixed, `departmentCourseCodes()`/`facultyDepartments()` would resolve to empty scopes (see §14).

---

## 3. Database architecture (schema + migrations)

- Provider: **PostgreSQL** via `@prisma/adapter-pg`. `DATABASE_URL=postgresql://portal:password@localhost:5432/portal?schema=public`. Local dev DB is embedded Postgres 18.4 (persistent `data/pgdata`, `scripts/start-db.ts`).
- Schema: `prisma/schema.prisma` — **1,264 lines**; datasource `postgresql`; generator `prisma-client` → `src/generated/prisma` (do not edit). The header comment still says "SQLite local / Postgres prod" — **stale, cosmetic only** (also flagged in RECOVERY_AUDIT §2).
- Migration folders: **16** (see table) + `migration_lock.toml`. **Only the first two are tracked in git**; migrations 3–16 are all **untracked** (`git status --short` shows `??` for every folder from `course_assignment` onward). This is the single most important git-hygiene finding.

| # | Migration | Purpose | Git |
|---|---|---|---|
| 1 | `20260809000000_init_postgres` | Full initial build (User, Session, AuditLog, Course, CourseRegistration, Result, fees, clearance, PG, SIWES, NYSC, etc.) | ✅ tracked |
| 2 | `20260809022915_email_verification` | EmailVerificationToken | ✅ tracked |
| 3 | `20260809040000_course_assignment` | CourseAssignment + User.department | ❌ untracked |
| 4 | `20260809050000_appointments` | Appointment | ❌ untracked |
| 5 | `20260809115509_add_student_category` | User.studentCategory | ❌ untracked |
| 6 | `20260811000000_lecturer_results` | ResultFile, ResultCorrectionRequest | ❌ untracked |
| 7 | `20260811010000_add_user_faculty` | User.faculty | ❌ untracked |
| 8 | `20260811194705_add_level_coordinator` | LevelCoordinator | ❌ untracked |
| 9 | `20260811210254_course_assignment_members` | CourseAssignmentMember | ❌ untracked |
| 10 | `20260811233845_add_level_advisor_assignments` | LevelAdvisorAssignment | ❌ untracked |
| 11 | `20260812080740_add_student_bio` | User.sex, dateOfBirth | ❌ untracked |
| 12 | `20260813032648_add_announcement_faculty` | Announcement.faculty | ❌ untracked |
| 13 | `20260813035219_add_senate_business_models` | SenateMatter, SenateDecision, SenateAgenda | ❌ untracked |
| 14 | `20260813045130_add_committee_membership` | CommitteeMembership | ❌ untracked |
| 15 | `20260814000000_add_course_offering` | CourseOffering (+ unique index) | ❌ untracked |
| 16 | `20260814073552_add_registration_header` | Registration header, CourseRegistration.registrationId, index renames | ❌ untracked |

### Governance-relevant models (all present)

- **`Appointment`** (migration 4): `role`, `department`, `faculty`, `academicSession`, `appointedById`, status fields — chairs/appointments of offices.
- **`CommitteeMembership`** (migration 14): membership rows with `committee`, `userId`, `status ACTIVE`, expiry semantics — the **authorization boundary** for the Governance workspace (see §10).
- **`SenateMatter`** (migration 13): `reference` UNIQUE, `title`, `summary`, `category`, `status` workflow (`SUBMITTED → SCREENED → DECIDED`, `WITHDRAWN`), `submittedById`, `screenedById`.
- **`SenateDecision`** (migration 13): `matterId` UNIQUE (one decision per matter), `resolution`, `decisionBody`, `recordedById`.
- **`SenateAgenda`** (migration 13): `title`, `meetingDate`, `items` (JSONB array), `status`, `createdById`.
- **`CourseOffering`** (migration 15): `courseId → Course` (Restrict), `programmeId? → Programme` (SetNull), `academicSession`, `semester`, `level`, `status ACTIVE|INACTIVE`, unique `(courseId, programmeId, academicSession, semester, level)`. ⚠️ `programmeId` is nullable, so in Postgres duplicate rows with `programmeId = NULL` are **not** blocked by the unique index.
- **`Registration`** (migration 16): registration **header** — `registrationReference` UNIQUE (e.g. `CR-2025-000001`), `totalUnits`, `status SUBMITTED|FINALIZED|LOCKED|CANCELLED`, `submittedAt/finalisedAt/lockedAt`, unique `(userId, academicSession, semester)`. `CourseRegistration.registrationId` links rows to the header (`SET NULL` on header delete).

### RECOVERY assessment for the database

> **APPLICATION-LEVEL RECOVERY — NO MIGRATION REQUIRED.** The schema fully supports every executive/governance feature; no missing table, column, index or migration was found for this layer. The gaps are application-level role strings, guards and seed data (see §18). The live DB was recovered cleanly (Postgres logged "database system was not properly shut down; automatic recovery in progress" then "ready to accept connections") and the full test suite passes against it. ⚪ Caveat retained from `DATABASE_RECOVERY_AUDIT.md`: whether every migration is applied to *live* environments beyond this local one was not verified (read-only; `prisma migrate status` not run here either).

---

## 4. VC workspace audit

**Guard:** `src/app/portal/vc/guard.ts:8` → `if (session.user.role !== "VC")` then `redirect(landingForRole(session.user.role))`. Purely role-string based; **no membership, no step-up, no MFA gate** beyond the shared portal layout. 🟢 consistent — `VC` is labelled, matrixed, seeded.

**Surface:** 16 subpages under `/portal/vc` (`academic`, `admissions`, `audit`, `centres`, `communications`, `exceptions`, `faculties`, `governance`, `graduation`, `postgraduate`, `reports`, `research`, `results`, `staff`, `students`, `university-overview`) plus the dashboard page. All read-only university-wide views fed by `src/lib/governance.ts`; CSV exports are university-wide.

**Findings:**
- 🟢 Guard is correct and the demo login (`vc@`) works.
- 🟡 **Many subpages are partially scaffolded**: the lint run reports **~34 unused-import/assigned-but-unused warnings across the VC pages** (academic, admissions, audit, centres, faculties, graduation, page, postgraduate, reports, research, results, staff, students). These are compile-safe but indicate views that query data and render partial tables without stat cards / drill-downs. Not a blocker; matches RECOVERY_AUDIT §11.
- 🟡 `vc/page.tsx` computes `stats`/`pct` but several variables are unused (`CURRENT_SESSION`, `VC_MENU`, `pct`) — dashboard cards appear partially implemented.
- ⚪ No MFA/step-up enforcement anywhere in the VC tree (shared layout MFA only). Sensitive "institutional oversight" read views are fine read-only; but see §10 re: result-approval step-up (VC has no approval permission, so acceptable).

---

## 5. DVC / Governance & Oversight audit

**Guard:** `src/app/portal/dvc/guard.ts` `requireGovernanceOversight()`:
1. no session → `/login`;
2. `!isGovernanceRole(role)` (DVC_OVERSIGHT or GOVERNANCE_OVERSIGHT_MEMBER) → `landingForRole` (correctly **not** the DVC route for non-governance roles);
3. **no ACTIVE `CommitteeMembership` row for `GOVERNANCE_COMMITTEE`** → `redirect("/portal/dashboard")` (deliberately not `landingForRole`, which would bounce a DVC straight back in a loop — the guard comment documents this);
4. returns `{ session, membership }`.

**Authorization model (documented in code + `governance.ts`):** the **membership row is the authorization boundary**, not the DVC job title; the Chairman is a *designation on the same membership row*, not a separate permission set. This is the correct design for a governance committee.

**Findings:**
- 🟡 **Demo-blocked by missing seed**: `dvc@` is `DVC_OVERSIGHT` (passes step 2) but no `CommitteeMembership` row is seeded (step 3) → always redirected to `/portal/dashboard`. Every `/portal/dvc/*` page routes through this guard.
- 🟢 `src/lib/governance.ts` (~1,178 lines) is complete and **well tested** (`governance.test.ts` in the passing suite): university-wide stats, severity-ranked exception register, faculty/department comparison, monitors (course allocation, level coordination, results pipeline, admissions, graduation, PG), staff/student overviews, 12 CSV reports, `results.deanApproved` and the "results-dean-approved" exception — **both of which reference the phantom `DEAN_APPROVED` stage (see §12)**.
- 🟢 DVC subpage routing (`dvc/students/export`, `dvc/reports/export`) is scoped through the same guard.
- 🟡 `GOVERNANCE_OVERSIGHT_MEMBER` is in `landingForRole` but missing from labels/matrix — dead role string today.

---

## 6. SBC (Senate Business Committee) audit

**Guard:** `src/app/portal/sbc/guard.ts:10` → `if (session.user.role !== "SBC_CHAIRMAN")` → `redirect(landingForRole(...))`. Pure role-string; no membership requirement.

**Actions** (`src/app/portal/sbc/actions.ts`, all gated):
- `submitMatter` — `can(role, "SENATE", "W")`; creates `SenateMatter` with `nextMatterReference()`; audit `CREATE/SENATE_MATTER`.
- `screenMatter` — `can(role, "SENATE", "A")`; `SUBMITTED → SCREENED` (uses `canScreen`); audit `APPROVE`.
- `recordSenateDecision` — `can(role, "SENATE", "A")`; requires `SCREENED` (`canRecordDecision`), **transactionally** creates `SenateDecision` + flips matter to `DECIDED` (no direct decision insert path — good); audit `CREATE/SENATE_DECISION`.
- `withdrawMatter` — `can(role, "SENATE", "W")`; only pre-screening (`canWithdraw`); audit `UPDATE`.
- `createSenateAnnouncement` — `can(role, "COMMUNICATIONS", "W")`; scope restricted to `["STAFF","ROLE"]` (**PUBLIC deliberately excluded**); role audience allow-list `SBC_ROLE_AUDIENCES = [SBC_CHAIRMAN, DEAN, HOD, EXAMS_RECORDS, REGISTRY, DVC_OVERSIGHT, VC]`.
- `createSenateAgenda` — **`AGENDA_CREATOR_ROLES = ["REGISTRY", "EXAMS_RECORDS"]`**; the Chairman is deliberately absent from agenda creation (the comment explains agenda preparation belongs to the Senate registrar); audit `CREATE/SENATE_AGENDA`.

**Findings:**
- 🔴 **Unreachable in demo**: `SBC_CHAIRMAN` is in the matrix (`SENATE: RWA, EXAMS_RECORDS: R, COMMUNICATIONS: RW`) and in `landingForRole`, but **not in `ROLE_LABELS`** and **no seed account**.
- 🟢 The action surface is well-designed and audited; the workflow gates (`canScreen`/`canWithdraw`/`canRecordDecision`) in `src/lib/senate-constants.ts` are sound.
- 🟢 `sbc/page.tsx` reads `senateMatter` groupBy status, latest 6 `senateDecision`, upcoming `senateAgenda` — all present models.
- 🟡 The SBC row in the matrix (`SENATE: RWA`) is **stronger than the guard needs**: the "A" screen/decide and "W" withdraw are handled via explicit `can(...)` checks in actions, so the matrix "A/W" grant to the chairman is consistent, but `DEAN`/`HOD` in `SBC_ROLE_AUDIENCES` are dead targets while those roles don't exist.

---

## 7. Dean workspace audit

**Guard:** every page guards `session.user.role !== "DEAN"` → `redirect(landingForRole(...))` (dean/page.tsx:44, academic-management:25, students/[id]:37, postgraduate:28, results:31, communications:80, staff:27, admissions:28, graduation:27, students:233, export route:25, communications/actions.ts:28). No `middleware`; no route-level layout guard other than the shared portal layout.

**Faculty scoping (correct):** `src/lib/faculty.ts` (`isDeanOfFaculty`, `facultyDepartments`, `facultyProgrammeIds`, `facultyCourseCodes`, `facultyStudentIds`, `facultyStats`) plus `src/lib/student-stats.ts` (`fetchFacultyStudents`). Faculty comes **from the session, never the request**; an optional `department` query param is validated against the faculty's department list; exports write an audit entry and refuse any department outside the authenticated faculty (verified in `dean/students/export/route.ts` — 403 without a `faculty`, department whitelist applied).

**Findings:**
- 🔴 **`DEAN` does not exist as a role**: not in `ROLE_LABELS` (so no label), not in `ACCESS_CONTROL_MATRIX` (so `can("DEAN", …)` is empty), and no seed account → the whole workspace is unreachable in the demo.
- 🟡 `dean/page.tsx` renders an EmptyState "No faculty assignment" when `user.faculty` is missing — but no seeded user has a `faculty`, so even with a seeded DEAN account every Dean view would be empty until staff/roster data is restored (§14).
- 🟡 `DEAN_MENU` (9 items, grouped Academic Management / Student Affairs) exists in `constants.ts` (post-645) and `buildDeanNav()` is selected in `portal/layout.tsx` for the DEAN role — UI plumbing ready, role wiring missing.
- ⚪ `deans` result pipeline: Dean sees `SUBMITTED/HOD_APPROVED` counts and `returnResult` (module-actions.ts:2707) — a **faculty-scoped** "return to lecturer" (`HOD_APPROVED → SUBMITTED`, clears `approvedBy1/approvedAt1`) — the only Dean write action. No Dean approve step exists or is intended (design doc: read-only oversight, `SUBMITTED → HOD_APPROVED → SENATE_APPROVED` unchanged). **Conflict:** `governance.ts` nevertheless expects a `DEAN_APPROVED` stage (§12).

---

## 8. HOD workspace audit

**Guards — strict `"HOD"` (inconsistent with the seeded/matrixed `HOD_DEAN`):**
- `hod/page.tsx:18`, `course-allocation/page.tsx:17`, `level-coordinators/page.tsx:16`, `staff/page.tsx:26`, `students/page.tsx:252`, `students/[id]/page.tsx:36`, `level-advisers/page.tsx:16`, `approvals/page.tsx:17`, `students/export/route.ts:24` → `role !== "HOD"` → `redirect(landingForRole(...))`.
- **Exception — course-offerings tree uses `isHodRole()`** (accepts both `HOD` and `HOD_DEAN`): `hod/course-offerings/page.tsx:27`, `hod/course-offerings/[id]/detail/page.tsx:32`.

**So the HOD layer is split in two authorization models:**
| Area | Role accepted | Result |
|---|---|---|
| Dashboard, approvals, students, staff, course-allocation, level-advisers, level-coordinators, exports | **strict `HOD`** only | unreachable for `HOD_DEAN` (seeded); and `HOD` has no matrix row → no module permissions |
| course-offerings list + detail | `HOD` or `HOD_DEAN` (`isHodRole`) | reachable by seeded `HOD_DEAN` ✅ |

**`src/lib/hod.ts`:** `HOD_ROLES = ["HOD","HOD_DEAN"]`, `isHodRole()`, `departmentCourseCodes()` (scoped by `user.department`), `departmentProgrammeIds()` — the helper already treats both roles as equivalent; the *pages* don't.

**module-actions role checks (HOD layer):**
- **Strict `role !== "HOD"`** → `assignCourse` (2127), `unassignCourse` (2203), `assignCourseMember` (2224), `removeCourseMember` (2262), `assignLevelAdviser` (2425/2431), `assignLevelCoordinator` (2494), `removeLevelCoordinator` (2558).
- **`isHodRole()`** → `createCourseOffering` (2290/2296), `setCourseOfferingStatus` (2386/2392).
- `approveResult` (1307): gated `can(role, "EXAMS_RECORDS", "A")` + step-up; line 1323 **strict `session.user.role === "HOD_DEAN"`** on `SUBMITTED → HOD_APPROVED`; line ~1331 `EXAMS_RECORDS` on `HOD_APPROVED → SENATE_APPROVED` (published). **Not `isHodRole()`** — so the exact role split is: HOD pages (strict `HOD`) never reach approvals; the approval action itself (strict `HOD_DEAN`) can only be reached by a role that can't load the page.

**Findings:**
- 🔴 **P0 redirect loop** — seeded `HOD_DEAN` hits `landingForRole("HOD_DEAN") = /portal/hod` → infinite redirect (hod/page.tsx:18).
- 🔴 **P1 HOD result approval broken** — the approvals page (`role === "HOD"`) is incompatible with the approval action (`role === "HOD_DEAN"`); `can("HOD", "EXAMS_RECORDS", "A")` is false anyway (no `HOD` matrix row).
- 🟢 Course-offerings CRUD is real, validated server-side (DB re-check, catalogue `courseInDepartmentCatalogue`, step-up) and department-scoped — the biggest single improvement since the 8/14 audits.
- 🟡 Seeded `hod@` has no `department`, so even after the loop fix, `departmentCourseCodes()` → empty → approvals/students/staff/course lists would be empty until staff/roster data returns.

---

## 9. Cross-role permission matrix (executive/governance roles × modules)

From `ACCESS_CONTROL_MATRIX` (P("R|W|A|S|V"), abbreviated):

| Module | HOD_DEAN | (HOD) | (DEAN) | DVC_OVERSIGHT | SBC_CHAIRMAN | VC |
|---|---|---|---|---|---|---|
| ADMISSIONS | R | — | — | R | — | R |
| FEES | — | — | — | R | — | R |
| EXAMS_RECORDS | **A** | — | — | R | R | R |
| ACCOMMODATION | R | — | — | R | — | R |
| TRANSCRIPT | — | — | — | R | — | R |
| LMS | R | — | — | R | — | R |
| PROFILES | RW | — | — | R | — | R |
| GRAD_CLEARANCE | **A** | — | — | R | — | **RA** |
| PG_RESEARCH | R | — | — | R | — | R |
| SIWES | R | — | — | R | — | R |
| TIMETABLE_VENUE | R | — | — | R | — | R |
| ADMIN_SYSTEM | — | — | — | R | — | **RA** |
| LIBRARY | R | — | — | R | — | R |
| COMMUNICATIONS | **RW** | — | — | R | **RW** | **RA** |
| HELPDESK | — | — | — | R | — | R |
| DPO | — | — | — | R | — | **RA** |
| HEALTH | — | — | — | — | — | R |
| SENATE | — | — | — | R | **RWA** | R |

Notes:
- `HOD_DEAN` is the **only** role with `A` on EXAMS_RECORDS (result approval) — this is what makes the HOD_DEAN-only `approveResult` reachable in theory; the page guard is the blocker.
- `DEAN`/`HOD`/`GOVERNANCE_OVERSIGHT_MEMBER` have **no rows at all** → `can()` is always false for them.
- `SBC_CHAIRMAN`'s `SENATE: RWA` is consistent with the sbc actions (W raise, A screen/decide, W withdraw).

---

## 10. Authorization boundary (CommitteeMembership + step-up + shared layout)

- **Shared portal layout** (`src/app/portal/layout.tsx:21-30`): every portal page runs this first — session → `/login`; `SUSPENDED/LOCKED` account → `/login?suspended=1`; missing MFA verification (`mfaVerifiedAt`) → MFA redirect. Executive workspaces get this by default.
- **CommitteeMembership gating** (DVC/Governance): the ONLY workspace that keys authorization off a DB membership row rather than the role string. Correct design; broken demo only.
- **Step-up (TOTP re-verification)** via `stepUpGuard`: required for result approval (`approveResult`), course-offering create/status, `resetUserPassword`, etc. ✅ present in the sensitive module-actions. **Not required** on any executive read page (VC/DVC/SBC/Dean/HOD), which is appropriate given their read-only surface.
- **No middleware** exists for the executive routes; guards are per-page/per-action. This is consistent across the codebase (no `src/middleware.ts`), so it is the established pattern rather than a defect.

---

## 11. Audit logging (hash-chained trail) & chain integrity

- `src/lib/audit.ts` (129 lines): `writeAudit()` appends rows with `prevHash` + SHA-256 `hash` over a canonical, key-sorted JSON of the record ("GENESIS" for the first row); `verifyChain()` (used by DPO/governance views) recomputes and returns `{ count, intact }`. No update/delete path exists in the app (append-only by construction).
- `AuditAction` union (audit.ts:9-28): `LOGIN LOGOUT CREATE READ UPDATE DELETE APPROVE SUBMIT PAY EXPORT VERIFY CONFIG REVOKE STEP_UP AUTH_FAIL MFA_FAIL FINALIZE LOCK RECONCILE`. **Missing `REJECT`/`DECISION`/`APPOINTMENT`** — e.g. `returnResult` (a Dean rejection) logs `UPDATE`, and `recordSenateDecision` logs `CREATE` under module `SENATE`; no dedicated action tokens exist. Not a defect per se, but a naming/audit-searchability gap.
- **Appointments** are audited under module `ADMIN_SYSTEM` with `CREATE/APPROVE/UPDATE` — acceptable, though there is no `APPOINTMENT` action.
- **Chain integrity evidence:** the audit tests (`src/lib/audit.test.ts`) assert `verifyChain()` returns `intact: true` for the live DB. `test-output-final.txt` (8/13 12:55) recorded **2 failures** where `verifyChain()` returned `intact: false` even after a fresh append — meaning at that time the DB's pre-existing rows had a **broken mid-chain link** (rows deleted mid-chain), which `scripts/repair-audit-chain.ts` (non-destructive recompute of prevHash/hash in `verifyChain` order) was written to fix. **In my run today (8/15) the audit tests pass**, so the chain currently verifies intact in the local DB. ⚪ The repair script is present but I did not execute it (write operation). The failure mode — chain breaks if rows are ever deleted mid-chain — is worth guarding against (an `AuditLog` cleanup path in tests does `deleteMany`; production DB role has no DELETE grant).

---

## 12. Phantom stage: `DEAN_APPROVED` in the result pipeline

- Real pipeline (schema comment + `module-actions.ts`): `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`. `approveResult` sets only `HOD_APPROVED` / `SENATE_APPROVED`; `returnResult` returns to `SUBMITTED`. **No code path sets `DEAN_APPROVED`.**
- `src/lib/governance.ts` references `DEAN_APPROVED` in multiple places: `governanceStats` / results pipeline counts, `governanceExceptions` (the "results-dean-approved" exception), `facultyComparison`, and `RESULT_STAGE_ORDER`. The result files page and VC reports would also rely on it.
- **Consequence:** the Governance/VC result-pipeline monitors that expect a Dean approval stage will always report 0 rows for that stage — a correctness (reporting) mismatch, not a crash. Two consistent options exist (do nothing / remove the stage, or add a genuine Dean approval step) — **neither is implemented in this read-only audit**; flagged for the roadmap (§18 P1).

---

## 13. Course offerings & registration — post-recovery status (vs 8/14 audits)

Both prior audits (RECOVERY_AUDIT §3/§13, DATABASE_RECOVERY_AUDIT §E/F/G) recorded the offering/registration **application layer** as 🔴 missing (simulated create form, unscoped list, missing detail route, no CourseOffering eligibility, no registration lock). **This is no longer true:**

| Item | 8/14 audit | Now (8/15) | Status |
|---|---|---|---|
| `createCourseOffering` server action | 🔴 missing (simulated) | ✅ real (module-actions.ts:2290-2296), server-side re-validation + catalogue check + step-up | 🟢 |
| `setCourseOfferingStatus` | 🔴 | ✅ (2386-2392) | 🟢 |
| HOD offerings list scoped by department | 🔴 empty `where: {}` | ✅ filters by `user.faculty` + `hostingDepartment` (course-offerings/page.tsx) | 🟢 |
| `[id]/detail` route | 🔴 404 | ✅ exists (`hod/course-offerings/[id]/detail/page.tsx`, guarded by `isHodRole`) | 🟢 |
| `registerCourse` checks ACTIVE offering + programme/level (`eligibleOfferingForStudent`) | 🔴 absent | ✅ present and enforced | 🟢 |
| Registration header (reference, lock, total units) | 🔴 absent | ✅ `Registration` model + migration 16; `finaliseRegistration` computes `totalUnits`, sets immutable `registrationReference`, locks | 🟢 |
| 15-unit minimum server-side | 🔴 client-only | ✅ server-enforced at finalisation (`MIN_REGISTRATION_UNITS` branch in module-actions.ts) | 🟢 |
| Tests for registration | 🔴 | ✅ `student-registration.test.ts` (16), `registration-finalisation.test.ts` (17), all passing | 🟢 |

Remaining minor caveats (not executive-layer): unique index on `CourseOffering` ignores `programmeId = NULL` duplicates (Postgres), and `registerCourse` still has a latent P2002 on `DROPPED/WITHDRAWN` re-registration (from DATABASE_RECOVERY_AUDIT §F) — both application/schema-nuance items, unchanged and out of the executive scope.

---

## 14. Staff / faculty / department data sources (why workspaces are empty)

- `scripts/generate-demo-users.mjs` writes `data/staff.csv` (793 lines: an HOD per department, a DEAN per faculty, LECTURER rows) and `data/students.csv` — **CSV/docx generation only**.
- **No importer exists**: zero references to `staff.csv`/`generate-demo-users` in `src/` or `scripts/` beyond the generator itself (verified by grep). The "~792 staff dataset" from the target architecture is **not wired into the app**.
- `facultyDepartments()` derives a faculty's departments from `LECTURER` rows carrying `faculty` → with only 1 seeded lecturer (no `faculty`), every faculty view returns "No departments". This is why, even after fixing role strings and adding a DEAN account, Dean/VC faculty dashboards show 0s until staff data is restored.
- `hod@`/`dvc@`/`vc@` seed users have no `faculty`/`department`.

---

## 15. Tests & CI state

- Test suite: **14 files / 185 tests** (`vitest run`), all passing **when the database is running**.
- ⚠️ **Environmental note:** on this machine the embedded Postgres cluster is **not auto-started**. My first `npm test` run failed 13 tests with `PrismaClientKnownRequestError` connection errors (and `/api/v1/health` reported `checks.database: false`) purely because the cluster was down; after starting it (`npm run db:start`, data persists in `data/pgdata`), the same suite passed **185/185 in 9.3s**. The DB is now running. Anyone running tests must start the DB first (`npm run db:start`), per `AGENTS.md`.
- Integration-heavy test files touching the live DB: `audit.test.ts`, `module-actions.smoke.test.ts`, `student-registration.test.ts`, `registration-finalisation.test.ts`, `bursary-workspace.test.ts`, `api/v1/api.test.ts`. A stale `test-output-final.txt` (8/13) showed 2 audit-chain failures (since repaired); current run is clean.
- `scripts/smoke.ts` and `scripts/repair-audit-chain.ts` exist as operational utilities (repair script NOT run — write op).

---

## 16. Automated checks (this session, read-only)

| Check | Result |
|---|---|
| `npm test` (vitest) | ✅ **14 files / 185 tests passed** (after `db:start`; DB was down initially — environmental) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, **41 warnings** (mostly unused imports in VC subpages; `<img>` in header/footer; unused `formData` at module-actions.ts:2782) |
| `npm run build` | ✅ Production build succeeded (Next 16.3.0 / Turbopack, 10.5s compile, TS clean). All executive routes present: `dean` (+8), `dvc` (+14 incl. exports), `hod` (+9 incl. course-offerings/[id]/detail, students/[id], export), `sbc` (+4), `vc` (+16 incl. exceptions, governance, university-overview) |
| DB recovery | ⚪ Postgres 18.4 auto-recovered from unclean shutdown; database `portal` present with prior data |

Note: the prior `lint-output.txt` (8/13) reported an error at `module-actions.ts:1532` (`no-require-imports`) that is **no longer present** — the file at 1520-1560 is normal TypeScript; the current lint is clean of errors. That log is stale.

---

## 17. Recovery status table — executive & governance layer

| Component | Status | Detail |
|---|---|---|
| VC workspace guard | 🟢 | `role !== "VC"` consistent; seeded; reachable |
| VC subpages content | 🟡 | several scaffolded (unused imports); read-only views |
| DVC/Governance guard (membership-gated) | 🟢 | correct design; Chairman = designation |
| DVC demo access | 🔴 | no `CommitteeMembership` seeded → bounced to dashboard |
| Governance module (`governance.ts`) | 🟢 | complete, tested; ⚠️ relies on phantom `DEAN_APPROVED` |
| SBC guard | 🟢 | strict role; actions well-gated + audited |
| SBC demo access | 🔴 | no seed account; role missing from `ROLE_LABELS` |
| Dean guard | 🟢 | correct strict role; faculty scoping sound |
| Dean demo access | 🔴 | no `DEAN` role/label/matrix/seed; `DEAN_MENU` ready |
| HOD guard | 🔴 | `HOD` vs `HOD_DEAN` mismatch → redirect loop (P0) |
| HOD result approval | 🔴 | page needs `HOD`, action needs `HOD_DEAN`, matrix has neither → broken (P1) |
| Course-offerings layer | 🟢 | real actions, scoped list, detail route, step-up |
| Registration header + lock | 🟢 | model + migration + server-side finalisation |
| Phantom `DEAN_APPROVED` | 🔴 | reporting only; no writer (P1) |
| Audit chain | 🟢 | verifies intact today; repair script present (not run) |
| Audit action vocabulary | 🟡 | no REJECT/DECISION/APPOINTMENT tokens |
| Seed provisioning | 🔴 | missing DEAN/SBC/GOV member users + memberships + senate rows |
| Staff/faculty/dept data | 🔴 | CSV exists; no importer; scopes empty |
| Migrations (all 16) | 🟢 present | ⚠️ 14 of 16 untracked in git |
| Build/typecheck/tests | 🟢 | tsc 0, lint 0 errors, 185/185 tests (DB up) |

---

## 18. RECOVERY PRIORITY roadmap (proposed — for implementation AFTER this audit, with your approval)

> Nothing in this section was implemented. Ordering is by demo reachability and correctness risk.

- **P0 — HOD redirect loop (blocks HOD workspace).** Resolve the `HOD` vs `HOD_DEAN` split. Recommended consistent shape (pick one):
  - **(a)** Keep `HOD_DEAN` everywhere: change the HOD pages/actions/export to `isHodRole()` (the helper already exists and the course-offerings tree already uses it), and either add a `HOD` row alias to the matrix or drop the `HOD` string entirely.
  - **(b)** Split roles properly: add `HOD` and `DEAN` to `ROLE_LABELS` + `ACCESS_CONTROL_MATRIX` + seed accounts, and align `approveResult`'s strict check to whichever role is real.
- **P1 — HOD result approval.** Once the role shape is fixed, make `approveResult` accept the same role the approvals page accepts (`isHodRole`), so a reachable HOD can approve; confirm `can(...EXAMS_RECORDS, "A")` resolves for that role.
- **P1 — Phantom `DEAN_APPROVED`.** Either remove the stage from `governance.ts`/`RESULT_STAGE_ORDER` (Dean is read-only by design) or introduce a real Dean approval step. Do not leave a stage no writer can produce.
- **P1 — Demo reachability for Dean/SBC/DVC.** Seed `DEAN`, `SBC_CHAIRMAN`, `GOVERNANCE_OVERSIGHT_MEMBER` (+`VERIFIER`) accounts, add missing labels/matrix rows, and seed ACTIVE `CommitteeMembership` rows for the DVC demo user; add senate matter/decision/agenda demo rows.
- **P2 — Staff/roster restoration.** Import `data/staff.csv` (793 rows) with `faculty`/`department` (an importer script is required), and give seeded executive users their `faculty`/`department`. This is what makes Dean/VC/HOD views non-empty.
- **P3 — Audit vocabulary.** Add `REJECT`, `DECISION`, `APPOINTMENT` to `AuditAction` and use them in `returnResult`, `recordSenateDecision`, and appointment actions.
- **P4 — Polish.** Finish the scaffolded VC subpages; audit-verify `Appointment` UI paths (`proposeAppointment` needs `DEAN`/`DVC_OVERSIGHT` — dead while `DEAN` doesn't exist).
- **Housekeeping (no functional risk):** commit migrations 3–16 (they are untracked); fix the stale SQLite header comment in `schema.prisma`; 41 lint warnings.

---

## 19. Risks & next milestone

**Risks:**
1. **Untracked migrations (14/16)** — if the working tree were reset/re-cloned, the schema would be silently lost. **Highest-priority housekeeping item.**
2. **Inconsistent role strings** are the root of all demo blockers; fixing one without the others (labels/matrix/landing/seed/guards) recreates a mismatch elsewhere.
3. **Phantom `DEAN_APPROVED`** can mislead governance reporting into "no Dean approvals happening" when in fact no Dean approval exists — someone may "fix" it by adding a pipeline step that the Dean (read-only by design) cannot perform.
4. **Chain-integrity fragility** — `verifyChain` breaks if any audit row is deleted mid-chain (tests proved this on 8/13); guard against future cleanup paths.
5. **Empty scopes** — demo users have no faculty/department, so even fixed guards show empty views until staff data is restored.

**Next milestone (suggested):** complete P0 (HOD role shape) + P1 demo-seeding and the `DEAN_APPROVED` decision, then restore the staff roster. The schema needs **no changes** for any of this.

---

## 20. Open questions

1. **Role model:** do you want a single `HOD_DEAN` role (guards/actions switch to `isHodRole`), or separate `HOD` and `DEAN` roles added to labels/matrix/seed? (Same question stands for `GOVERNANCE_OVERSIGHT_MEMBER` vs `DVC_OVERSIGHT`.)
2. **Dean approval:** should the Dean be able to approve results (add a `DEAN_APPROVED` stage for real), or is `returnResult` + read-only oversight the intended design (remove the phantom stage from governance reporting)?
3. **Demo data:** should executive demo accounts be hand-seeded with `faculty`/`department`, or is a `staff.csv` importer the preferred path?
4. **DVC demo:** should the DVC demo user be the Governance Committee chairman (one membership row) or a member (a second row)?
5. **Audit actions:** is adding `REJECT`/`DECISION`/`APPOINTMENT` action tokens desired for the audit trail?
6. **Migrations:** OK to commit migrations 3–16 (untracked) in a single housekeeping change?

---

## NO-IMPLEMENTATION CONFIRMATION

This audit performed **no implementation**. In particular, **nothing was changed** with respect to:

- ✅ No change to `HOD`/`DEAN`/`SBC_CHAIRMAN`/`DVC_OVERSIGHT`/`GOVERNANCE_OVERSIGHT_MEMBER`/`VC` role strings, `ROLE_LABELS`, `ACCESS_CONTROL_MATRIX`, `landingForRole`, `HOD_MENU`/`DEAN_MENU`/`VC_MENU`.
- ✅ No change to any guard (`hod/page.tsx:18`, `dean/*`, `sbc/guard.ts`, `dvc/guard.ts`, `vc/guard.ts`, export routes).
- ✅ No change to `approveResult`, `returnResult`, `recordSenateDecision`, `createCourseOffering`, `setCourseOfferingStatus`, `registerCourse`, `finaliseRegistration`, appointment actions.
- ✅ No change to `prisma/schema.prisma`, no new or edited migration, no `db:generate`/`db:migrate`/`db:seed`/`db:reset`.
- ✅ No `CommitteeMembership`, `Senate*`, `Appointment`, `CourseOffering`, `Registration` or any other database row was created, updated or deleted by this audit.
- ✅ No Google Sheets, staff/student records or seed data were modified.
- ✅ The only DB-related action was **starting the local embedded PostgreSQL cluster** (`npm run db:start`) so the read-only test suite could run; no data was changed (recovery log: "automatic recovery in progress … ready to accept connections").
- ✅ `scripts/repair-audit-chain.ts` (a write script) was **not executed**.

---

## AUDIT SAFETY CONFIRMATION

During this audit:

- ✅ No source code, RBAC, guard, schema, migration, or seed file was modified.
- ✅ No database records were written, updated or deleted by this audit.
- ✅ No migrations were run; no `db:push`/`db:migrate`/`db:seed`/`db:reset`.
- ✅ No staff or student records were changed; no Google Sheets were modified.
- ✅ `npm run db:start` was started (environmental) and the cluster is running with its pre-existing data.
- ✅ The only file written during this audit is **`docs/EXECUTIVE_GOVERNANCE_RECOVERY_AUDIT.md`**.

**FINAL STATUS:**
- **Build/typecheck/tests:** 🟢 `tsc` 0 errors · lint 0 errors/41 warnings · **185/185 tests pass** (with the database running) · `next build` succeeds with all executive routes.
- **Executive workspaces:** VC 🟡 (reachable, partial content) · DVC 🔴 demo-blocked (membership not seeded) · SBC 🔴 no demo account · Dean 🔴 role not defined/seeded · HOD 🔴 P0 redirect loop.
- **Schema:** 🟢 complete for this layer — **NO MIGRATION REQUIRED** (application-level recovery only).
- **Git hygiene:** 🔴 migrations 3–16 untracked — commit as housekeeping.
- **Scope:** READ-ONLY audit only; no implementation performed or authorised by this document.
