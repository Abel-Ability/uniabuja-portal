# Executive & Governance Functional UAT / Recovery Verification — Audit Report

Status: **COMPLETE** — 2026-08-15
Audit type: read-only, source-level functional/UAT baseline (no DB mutations)
Predecessor: `docs/EXECUTIVE_GOVERNANCE_LIVE_ACTIVATION_REPORT.md` (activation COMPLETE)
Classification legend: 🟢 VERIFIED · 🟡 PARTIAL · 🔴 BROKEN/MISSING · ⚪ NOT TESTABLE

## 1. Executive Summary

The executive & governance workspaces recovered in the previous milestone are
**reachable, correctly guarded, and internally consistent** at the source level.
All role landing destinations exist; every menu route for HOD and DEAN resolves;
the result pipeline is exactly `SUBMITTED → HOD_APPROVED → SENATE_APPROVED →
FINAL` with **no `DEAN_APPROVED` anywhere in live application code**; governance
access is gated on an ACTIVE committee membership; the Dean is read-only
(return-only); SBC/DVC/VC read-only boundaries hold; and every executive write is
audit-logged through the hash-chained `writeAudit`.

Two 🔴 defects were found (both application-code only, no migration needed):

1. **Cross-department result approval** — `approveResult` has no department-scope
   check, and the shared `/portal/results` HOD view lists all `SUBMITTED` results
   unfiltered, so an HOD can approve another department's grades from that page.
2. **VC reports CSV download is a dangling link** — `/portal/vc/reports` points
   at a non-existent API route.

Six 🟡 navigation/consistency items (post-login landing ignores
`landingForRole`, auto-sidebar "Results" link bounces DEAN/SBC/DVC/GOV back to
the dashboard, dead `VC_MENU`, `/portal` and `/portal/students` 404, no
centralized route guard, CHAIRMAN vs MEMBER designations share identical
powers) and one ⚪ item (interactive UI walkthrough not executed because it
would write session/audit rows) are documented in Section 23.

**Recommended next milestone:** HOD result-approval scope hardening (fix
`approveResult` + the shared results view + action-level negative tests) plus
the VC reports CSV fix — see Section 24.

## 2. Scope

- Read-only source-level functional/UAT audit of HOD/HOD_DEAN, DEAN, SBC,
  DVC/Oversight, Governance, VC.
- Verified: navigation/landing, per-page guards, RBAC matrix vs UI surfaces,
  result pipeline, senate/governance flows, audit coverage, UI↔server
  consistency, and the negative-authorization contract.
- Not performed (by instruction): interactive browser walkthrough that creates
  sessions or audit rows; any write to CourseOffering / CourseAssignment /
  Result / Senate / financial records. No DB-mutating commands run.

## 3. Roles Tested

🟢 `HOD_DEAN` (HOD alias) · 🟢 `DEAN` · 🟢 `SBC_CHAIRMAN` · 🟢 `DVC_OVERSIGHT` ·
🟢 `GOVERNANCE_OVERSIGHT_MEMBER` · 🟢 `VC` — all reachable, guarded, and
internally consistent.

## 4. Demo Accounts Used

Per the activation report; verified present with correct roles/scopes/memberships
(`scripts/activate-executive-governance-demo.ts verify` → 26/26 PASS):

| Email | Role | Faculty / Dept | Membership |
|---|---|---|---|
| hod@uniabuja.edu.ng | HOD_DEAN | Science / Computer Science | — |
| dean@uniabuja.edu.ng | DEAN | Science / Computer Science | — |
| sbc@uniabuja.edu.ng | SBC_CHAIRMAN | — | — |
| gov@uniabuja.edu.ng | GOVERNANCE_OVERSIGHT_MEMBER | — | GOVERNANCE_OVERSIGHT MEMBER/ACTIVE |
| dvc@uniabuja.edu.ng | DVC_OVERSIGHT | Science / Computer Science | GOVERNANCE_OVERSIGHT CHAIRMAN/ACTIVE |
| vc@uniabuja.edu.ng | VC | — | — |

## 5. Workspace / Route Map

Source of truth: `src/lib/constants.ts`, `src/app/portal/**`, per-role guards.

| ROLE | Landing (`landingForRole`) | Guard | Pages (exist) | Server actions (write) | DB models | Write caps | Read-only caps |
|---|---|---|---|---|---|---|---|
| HOD / HOD_DEAN | `/portal/hod` (`constants.ts:658-660`) | `isHodRole` (hod.ts:10-12) — admits HOD+HOD_DEAN (10/10 pages + actions) | 10: page, students(+detail), staff, approvals, course-allocation, course-offerings(+detail), level-advisers, level-coordinators | `approveResult`, `createCourseOffering`, `setCourseOfferingStatus`, `assignCourse`, `unassignCourse`, `addCourseTeamLecturer`, `removeCourseTeamLecturer`, `assignLevelAdviser`, `deactivateLevelAdviser`, `assignLevelCoordinator` | CourseOffering, CourseAssignment(+Member), Result, ResultFile, LevelAdviser/Coordinator, Student, Staff | approve results (A), create/manage offerings + allocations + advisers | students/staff read, approvals read |
| DEAN | `/portal/dean` (`constants.ts:661-662`) | strict `role==="DEAN"` (all 10 pages) | 10: page, students(+detail), staff, results, admissions, graduation, postgraduate, academic-management, communications | `returnResult` (module-actions:2707), `createFacultyAnnouncement` (dean/communications/actions:22) | Result, ResultFile, Application, User, Announcement | return HoD-approved results; faculty announcements | all module reads (EXAMS_RECORDS R only, matrix 346-353) |
| SBC_CHAIRMAN | `/portal/sbc` (`constants.ts:684-685`) | strict `requireSbcChairman` (sbc/guard.ts:7-13) | 6: page, communications, decisions, matters, reports, results | `submitMatter`, `screenMatter`, `recordSenateDecision`, `withdrawMatter`, `createSenateAnnouncement` (sbc/actions.ts) | SenateMatter, SenateDecision, SenateAgenda, Announcement, Result | SENATE RWA; create announcements; CANNOT create agenda (`AGENDA_CREATOR_ROLES`=REGISTRY/EXAMS_RECORDS, sbc/actions.ts:22); CANNOT finalise results | results read-only (matrix 365-369) |
| DVC_OVERSIGHT | `/portal/dvc` (`constants.ts:679-681`) | `requireGovernanceOversight` (dvc/guard.ts:16-29): role **AND** ACTIVE membership; no membership → `/portal/dashboard` | 12: page, academic, admissions, audit, communications, exceptions, graduation, postgraduate, reports(+export), staff, students, university-overview | none (workspace is read-only monitors) | Result, ResultFile, Application, Exception/GovernanceStats, AuditLog | none | read-only all modules (matrix 423-441) |
| GOVERNANCE_OVERSIGHT_MEMBER | `/portal/dvc` (same, `constants.ts:680-681`) | same as DVC (membership-based) | same 12 | none | same | none | read-only all modules (matrix 442-460) |
| VC | `/portal/vc` (`constants.ts:682-683`) | strict `requireVC` (vc/guard.ts:5-12) | 17: page, academic, admissions, audit, centres, communications, exceptions, faculties, governance, graduation, postgraduate, reports, research, results, staff, students, university-overview | none found (VC is read/approve via matrix only; no VC action file) | Result, ResultFile, Application, GovernanceStats, AuditLog | ADMIN_SYSTEM/COMMUNICATIONS/DPO/GRAD_CLEARANCE A (matrix 461-464) | read-only all modules; NO EXAMS A/S/W (approved via `can` tests constants.test.ts:114-131) |

Sidebar construction (all roles except BURSARY) is auto-generated from
`visibleModules(role)` in `src/app/portal/layout.tsx:37-52`; `HOD_MENU` /
`DEAN_MENU` are in-page grids; there are **no** `SBC_MENU`/`DVC_MENU`/
`GOVERNANCE_MENU`/`SENATE_MENU` constants; the SBC workspace is linked only from
inline links on `sbc/page.tsx:231-235`.

## 6. HOD UAT (hod@ — HOD_DEAN)

| Check | Result | Evidence |
|---|---|---|
| Landing `/portal/hod` exists + guarded | 🟢 | `landingForRole` 658-660; `hod/page.tsx:19` `isHodRole` guard |
| HOD_DEAN accepted as HOD | 🟢 | `isHodRole` = {HOD, HOD_DEAN} (hod.ts:10-12), used on all 10 pages + actions + export route |
| Course Offerings page loads, dept-scoped | 🟢 | `hod/course-offerings/page.tsx:34-55` — catalogue filtered by session faculty+hostingDepartment; offerings filtered to dept codes |
| Faculty/department from auth context | 🟢 | `createCourseOffering` uses `session.user.faculty/department` (module-actions:2302-2306), never client |
| Cross-dept courses blocked | 🟢 | `courseInDepartmentCatalogue(faculty, department, course.code)` (module-actions:2318-2320, 2412-2414) |
| Course UUID (not code) | 🟢 | `createCourseOffering` reads `courseId` and resolves via `prisma.course.findUnique({where:{id}})` (2308, 2316) |
| Programme scoped to dept | 🟢 | `departmentProgrammeIds` (2340-2348) |
| Semester/level/session validation | 🟢 | session ∈ `academicSessions()` (2323); semester ∈ {1,2} and = course.semester (2328-2332); level ∈ department levels (2334-2338) |
| Duplicate prevention | 🟢 | pre-check + P2002 guard (2353-2371) |
| ACTIVE/INACTIVE status control, HOD-only | 🟢 | `setCourseOfferingStatus` `isHodRole`+stepUp, status enum, dept check, audit (2386-2419) |
| Detail page reachable | 🟢 | `hod/course-offerings/[id]/detail/page.tsx` exists, guard `isHodRole` (32) |
| Offerings ≠ Assignments | 🟢 | separate models/actions; CourseOffering (schema:1248) vs CourseAssignment; separate UIs |
| Results approval (dept-scoped page) | 🟢 | `hod/approvals/page.tsx:23-34` — SUBMITTED/HOD_APPROVED filtered by `departmentCourseCodes(dept)` |
| Cross-dept approval via shared results page | 🔴 | **F1** — `/portal/results` HOD branch unscoped (results/page.tsx:190-224) + `approveResult` no dept check (module-actions:1307-1339) |
| Level coordination/advisory exposed | 🟢 | `level-advisers` + `level-coordinators` pages exist, guarded, actions scoped+audited (module-actions:2425+) |
| Announcements/communications | 🟢 | COMMUNICATIONS: RW in matrix (316-329); `createAnnouncement` gated `can(COMMUNICATIONS,W)` (communications/actions:21) |

## 7. Dean UAT (dean@ — DEAN)

| Capability | RBAC (`constants.ts:346-353`) | UI/server behavior | Result |
|---|---|---|---|
| READ results (faculty scope) | EXAMS_RECORDS R | `dean/results/page.tsx:32-43` faculty-scoped via `facultyStats(faculty)`; StatCards Awaiting HoD / HoD-approved / Published (66-68) | 🟢 |
| WRITE | — | only `returnResult` (2707) + faculty announcements | 🟢 |
| APPROVE results | no A | `approveResult` → `can(EXAMS_RECORDS,A)` fails → "Your role cannot approve results." (1313-1315) | 🟢 |
| SUBMIT | no S | no submit surface for DEAN; `submitGrade` requires `S` (1245) | 🟢 |
| FINALIZE | no | no FINAL writer exists; SENATE_APPROVED requires EXAMS_RECORDS role (1328-1332) | 🟢 |
| RETURN HoD-approved | yes | `returnResult` DEAN-only, `gradeStatus==="HOD_APPROVED"`, faculty-scoped, resets to SUBMITTED + clears approver (2707-2743; faculty.ts:160) | 🟢 |
| UI agrees with RBAC | 🟢 | Dean page shows "Return" only for HOD_APPROVED, else "Read-only" (100-106); description "Approval runs HoD → Exams & Records" (62) | 🟢 |
| No DEAN_APPROVED in UI | 🟢 | grep: no DEAN_APPROVED in `src/` live code; only in tests/docs | 🟢 |
| Sidebar "Results" reaches Dean workspace | 🟡 | sidebar → `/portal/results` → redirects DEAN to `/portal/dashboard` (F4) | 🟡 |

## 8. SBC UAT (sbc@ — SBC_CHAIRMAN)

| Check | Result | Evidence |
|---|---|---|
| Senate workspace loads | 🟢 | 6 sbc pages exist, strict `requireSbcChairman` (sbc/guard.ts:7-13) |
| Matters visible per auth | 🟢 | `sbc/matters/page.tsx`; actions gated `can(SENATE,W/A)` (sbc/actions.ts:72,108,138,190) |
| Senate write ops (submit/screen/decision/withdraw) | 🟢 | all four actions workflow-gated via `canScreen/canRecordDecision/canWithdraw` + `MATTER_STATUSES`; decision only after SCREENED, atomic tx (133-181) |
| Approve where permitted | 🟢 | `can(SENATE,A)` for screening + decisions |
| Cannot finalise results | 🟢 | EXAMS_RECORDS: R only; `approveResult` requires A (1313) |
| Cannot create agenda | 🟢 | `AGENDA_CREATOR_ROLES = [REGISTRY, EXAMS_RECORDS]` (sbc/actions.ts:22) |
| Decisions/agenda reachable | 🟢 | `sbc/decisions/page.tsx`; agenda is create-by-Registry/Exams, viewed by SBC |
| No unauthorised admin modules | 🟢 | matrix: only SENATE/EXAMS_RECORDS/COMMUNICATIONS; sidebar auto-generated from those |
| UI actions not rejected by server | 🟢 | `sbc/results/page.tsx:34` explicitly "may not approve, edit or return"; no action column |
| Workspace discoverability | 🟡 | `SENATE` not in `PORTAL_MODULES`/`CROSS_CUTTING` → no sidebar entry; only inline links on `sbc/page.tsx:231-235`; post-login lands on `/portal/dashboard` (F3) |

## 9. Governance UAT (gov@ — GOVERNANCE_OVERSIGHT_MEMBER)

| Check | Result | Evidence |
|---|---|---|
| Landing `/portal/dvc` + membership requirement | 🟢 | `requireGovernanceOversight` (dvc/guard.ts:16-29): role AND ACTIVE `GOVERNANCE_OVERSIGHT` membership; no membership → `/portal/dashboard` |
| Membership recognised ACTIVE | 🟢 | activation verify + `membershipIsActive` (governance.ts:27-35); gov@ MEMBER/ACTIVE |
| Can view permitted governance info | 🟢 | dvc pages read-only monitors; `dvc/page.tsx` oversight dashboard |
| Cannot write Senate/results/financial | 🟢 | matrix read-only all modules (442-460); `can` negative tests (constants.test.ts:186-190) |
| Cannot approve/finalise results | 🟢 | no A on EXAMS_RECORDS; `approveResult` blocks |
| No DVC/VC-only functions exposed | 🟢 | shared 12 dvc pages; VC pages strict `requireVC` (VC fails dvc guard → `/portal/vc`) |
| Membership-based (not role-only) authz | 🟢 | dvc guard + governance.ts helpers; comment "authorization boundary is the membership" (guard.ts:10-15) |
| CHAIRMAN vs MEMBER powers | 🟡 | designation is display-only; identical matrix for both roles (governance.ts:44-53) — see F7 |

## 10. DVC UAT (dvc@ — DVC_OVERSIGHT)

| Check | Result | Evidence |
|---|---|---|
| Landing + oversight dashboard | 🟢 | `/portal/dvc` (landingForRole 679-681); dvc/guard membership-gated |
| Senate / fees / exec visibility | 🟢 | matrix R on SENATE+FEES+all modules; dvc/academic + dvc pages pipeline views |
| Read/write boundaries | 🟢 | read-only all modules (423-441); no action files under dvc/ |
| Membership separate from DVC role | 🟢 | guard keys off the membership row, not the job title (dvc/guard.ts:10-15) |
| No inherited GOVERNANCE_MEMBER extras | 🟢 | both roles' matrices are identical read-only; membership grants the workspace, not extra perms |
| No HOD/DEAN/SBC privileges | 🟢 | no A/W/S anywhere; `can` tests (constants.test.ts:100-104) |
| Sidebar "Results" reaches DVC results | 🟡 | sidebar `/portal/results` bounces DVC to dashboard (F4); DVC results seen via dvc/academic pipeline |

## 11. VC UAT (vc@ — VC)

| Check | Result | Evidence |
|---|---|---|
| Landing + executive dashboard | 🟢 | `/portal/vc` (landingForRole 682-683); 17 pages strict `requireVC` |
| Senate/governance visibility | 🟢 | `vc/governance/page.tsx` (governanceStats + roster), `vc/results/page.tsx` (resultsPipeline) |
| Results oversight | 🟢 | pipeline table + outstanding + recent activity (vc/results/page.tsx:29,60-107) |
| Financial oversight | 🟢 | matrix FEES R; fees dashboards read-only |
| Academic oversight | 🟢 | vc/academic, vc/faculties, vc/research, vc/university-overview |
| Executive approvals | 🟢 | ADMIN_SYSTEM/COMMUNICATIONS/DPO/GRAD_CLEARANCE A (461-464); no EXAMS A/S/W (constants.test.ts:114-131) |
| Audit visibility | 🟢 | `vc/audit/page.tsx` (verifyChain display) + dvc/audit |
| Reports CSV download | 🔴 | **F2** — `vc/reports/page.tsx:34` → `/api/portal/vc/reports/...` (no route) |
| Unbroken by recovery work | 🟢 | build success; VC_MENU unused (dead code, F5); guards intact |

## 12. Result Pipeline Verification

Canonical: `RESULT_STAGE_ORDER = ["SUBMITTED","HOD_APPROVED","SENATE_APPROVED","FINAL"]` (governance.ts:619).
No `DEAN_APPROVED` in live `src/` (only tests/docs). `DEAN_APPROVED` assertion in `governance.test.ts:76`.

| Stage | Initiates | Approves | Reject/correct | Finalises | Server action (file:line) | UI route | Audit | Unauthorised attempt |
|---|---|---|---|---|---|---|---|---|
| SUBMITTED | LECTURER | HOD/HOD_DEAN (SUBMITTED→HOD_APPROVED) | lecturer correction (`requestResultCorrection`); Dean return not allowed here | — | `submitGrade` (module-actions:1239, guard S at 1245), `postResultsAction`/`postBacklogResultsAction` (lecturer/actions.ts:115,321) | `/portal/results` (lecturer), lecturer post-result pages, `hod/approvals` | `SUBMIT EXAMS_RECORDS RESULT` (1299); `SUBMIT EXAMS_RECORDS RESULT_FILE` (294-306) | `approveResult` w/o A → "Your role cannot approve results." (1313-1315) |
| HOD_APPROVED | HOD | EXAMS_RECORDS (→SENATE_APPROVED, `published:true`) | DEAN (`returnResult` → SUBMITTED) | — | `approveResult` (1307; HOD branch 1323-1327, EXAMS branch 1328-1332), `returnResult` (2707) | `hod/approvals` (dept-scoped), `/portal/results` (HOD — **unscoped, F1**), `dean/results` (return), `/portal/results` (EXAMS "Senate finalise" 220) | `APPROVE EXAMS_RECORDS RESULT` (1337); `UPDATE EXAMS_RECORDS RESULT` (returnResult) | DEAN try-approve → blocked (no A); HOD on wrong stage → "Not ready for your approval (current stage: …)" (1333-1335) |
| SENATE_APPROVED | EXAMS_RECORDS | — | — | **no FINAL writer exists** (FINAL only set by `seed.ts:284`; edit blocked once FINAL — submitGrade 1275-1277) | `approveResult` EXAMS branch | `/portal/results` (EXAMS); pipeline views | `APPROVE EXAMS_RECORDS RESULT` | SBC/DVC/GOV try → blocked (no A) |
| FINAL | — | — | — | — | — | student results (CGPA uses FINAL only), pipeline views | — | edits blocked once FINAL |

## 13. RBAC Verification

- `can()`/`visibleModules()` centralised in `constants.ts:494-502`; matrix entries for all six roles verified (316-353, 365-369, 423-464).
- Negative assertions in `constants.test.ts`: DEAN R only (160-162), SBC SENATE RWA but no EXAMS A (173-180), GOV read-only (186-190), HOD/HOD_DEAN A (63-66,153-156), DVC read-only (100-104), VC R + admin approvals but no EXAMS A/S/W (109-131), STUDENT no approve (52-55), LECTURER submit-only (58-60).
- Result: 🟢 all six roles behave per the matrix; server actions enforce the same matrix via `can()` / `isHodRole()` / membership checks, not just the UI.

## 14. Negative Authorization Tests

| Attempt | Contract | Enforcement | Result |
|---|---|---|---|
| DEAN approve | deny | `approveResult` `can(A)` false → error | 🟢 |
| DEAN submit | deny | `submitGrade` `can(S)` false | 🟢 |
| DEAN finalise | deny | no FINAL writer; SENATE_APPROVED needs EXAMS role | 🟢 |
| GOV approve/finalise | deny | read-only matrix; `approveResult` blocks | 🟢 |
| GOV HOD ops | deny | `isHodRole` false; no CourseOffering/Assignment W | 🟢 |
| DVC HOD/SBC/GOV-member ops | deny | matrix read-only; membership grants workspace only | 🟢 |
| SBC finalise | deny | EXAMS_RECORDS R only | 🟢 |
| HOD Senate-only finalisation / VC exec ops | deny | HOD has no SENATE; `requireVC`/dvc guard block workspace | 🟢 |
| STUDENT executive routes | deny | `isHodRole`/strict guards redirect to `landingForRole` (`/portal/student`) | 🟢 |
| HOD approve cross-department | **deny expected — NOT enforced** | see F1 (action + shared view unscoped) | 🔴 |

Coverage note: matrix-level negatives are unit-tested (constants.test.ts); **action-level** negatives for `approveResult`/`createCourseOffering`/`returnResult`/senate actions are **not** covered by any integration test (`module-actions.smoke.test.ts` covers bursary/fees/transcripts/clearance only) — F8.

## 15. Audit Trail Verification

- `writeAudit` (audit.ts:48-96): SHA-256, hash-chained (`prevHash`/`hash`), `GENESIS` root, canonical JSON sort, exact `createdAt` hashed to avoid drift; append-only (no UPDATE/DELETE grant).
- `verifyChain()` (audit.ts:99-129) used by audit review views.
- Executive writes audited: login/logout/change-password (login/actions.ts:147-156,218-230,238-248); `submitGrade` SUBMIT (1299); `approveResult` APPROVE (1337); `returnResult` UPDATE; course offering create/status (2374,2417); allocation/adviser actions (2275, etc.); all senate actions via `auditSbc` (sbc/actions.ts:43-64: actor/session/module/target/before/after); Dean announcement; profile updates.
- 🟢 No recovery work bypasses the audit mechanism. The activation script itself writes no audit rows (intentional, documented in the activation report), so the chain is unaffected.

## 16. UI vs Server Authorization Consistency

| Area | UI | Server/RBAC | DB scope | Verdict |
|---|---|---|---|---|
| HOD approvals (`/portal/hod/approvals`) | dept-scoped buttons | `approveResult` A + `isHodRole` | **action has no dept check** | 🟡 UI scopes, server doesn't (see F1 via shared page) |
| Shared `/portal/results` (HOD) | lists ALL SUBMITTED | approves any SUBMITTED | unscoped | 🔴 F1 |
| Dean results | "Return"/"Read-only" only | `returnResult` DEAN-only + faculty-scoped | faculty scoped | 🟢 |
| SBC matters/decisions | workflow buttons | workflow-gated + SENATE perms | row-status gated | 🟢 |
| SBC results | no actions | no A | read-only | 🟢 |
| DVC/GOV workspace | read-only monitors | membership-gated | read-only | 🟢 |
| VC workspace | read-only + downloads | strict VC | — | 🟡 VC reports CSV link broken (F2) |
| Sidebar "Results" (DEAN/SBC/DVC/GOV) | link shown | `/portal/results` redirects them to dashboard | — | 🔴 navigation (F4) |
| Guard strength vs server | HOD guard admits HOD+HOD_DEAN; server uses same `isHodRole` | consistent | consistent | 🟢 |
| Governance membership checked server-side | dvc guard checks membership; senate/result actions do NOT need membership (not part of those actions) | correct — membership gates the workspace only | consistent | 🟢 |
| Scope client-derived vs server-derived | all scope from `session.user` (faculty/department) | confirmed for offerings/allocations/return | consistent | 🟢 |

## 17. Broken / Missing Routes

- 🔴 `/api/portal/vc/reports/{slug}.csv` — referenced by `vc/reports/page.tsx:34`; no such route (only `/api/v1/*`). DVC equivalent exists (`/portal/dvc/reports/export`).
- 🟡 `/portal/students` — `VC_MENU` target (constants.ts:721); no page file (404).
- 🟡 `/portal` — no `page.tsx` (404); role dashboard lives at `/portal/dashboard`.
- 🟡 `/portal/senate`, `/portal/governance` — no top-level dirs; senate under `/portal/sbc`, governance/oversight under `/portal/dvc` + `/portal/vc` (by design, but note there is no URL alias).

## 18. Missing or Incomplete Features

- 🟡 FINAL stage has **no server-side finaliser** — nothing in the app transitions `SENATE_APPROVED → FINAL` (seed-only). The UI labels "Senate finalise" perform `HOD_APPROVED → SENATE_APPROVED` (publish). Grade display/CGPA reads FINAL. This is a product gap: finalisation is effectively implicit at publication.
- 🟡 No `middleware.ts`/layout-level route↔role validation — authorization is entirely per-page; a future page without a guard would default-open (defense-in-depth gap).
- 🟡 SBC workspace discoverability (no SENATE sidebar entry).
- 🟡 `VC_MENU` defined but never rendered (dead code).
- 🟡 CHAIRMAN vs MEMBER designation has no permission delta.

## 19. Security Concerns

- 🔴 **F1 — cross-department result approval** (HIGH). An HOD can approve another department's `SUBMITTED` results via the shared `/portal/results` page because neither the page query nor `approveResult` enforces department scope. Requires the action to verify `courseInDepartmentCatalogue(session.faculty, session.department, result.course.code)` (or dept-course codes) and the shared view to filter by the HOD's department codes (as `hod/approvals` already does).
- 🟢 No privilege escalation found in the six roles (matrix + guards consistent).
- 🟢 No plaintext secrets; `SESSION_SECRET` HMAC sessions; sessions revoked/expired; MFA gate in layout.
- 🟢 Audit chain append-only and integrity-verifiable.

## 20. Regression Findings

- 🟢 Result pipeline intact (4 stages, no DEAN_APPROVED) — confirmed by grep across `src/` and pipeline tests.
- 🟢 HOD guard accepts HOD_DEAN everywhere (10/10 pages, all actions, export route).
- 🟢 DEAN read-only contract intact; `returnResult` faculty-scoped.
- 🟢 DVC/VC workspaces disjoint but both intact; governance membership gate enforced.
- 🟢 `module-actions.smoke.test.ts` bursary/fees/clearance/transcript flows unaffected.
- 🟡 Pre-existing (not introduced by recovery): dead `VC_MENU`, `/portal` + `/portal/students` 404, VC reports CSV dangling link, no middleware. The F1 cross-department approval and F4 sidebar bounce are pre-existing structural issues surfaced by this audit (recovery work added the HOD approvals page but left the shared pipeline view unscoped).

## 21. Test Results

| Gate | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | ✅ 0 errors | — |
| `npm run lint` | ✅ 0 errors, 41 warnings | warnings pre-existing (unused imports in vc/hod pages etc.); none introduced by audit |
| `npm test` | ✅ 15 files / 195 passed | all pass; failures: none; 195 is the pre-existing baseline (no new tests added this milestone) |
| `npm run build` | ✅ success | production build completes |

## 22. Database Safety Confirmation

- No DB-mutating commands run during this audit (no reset/seed/push/migrate/import).
- No schema changes, no record modifications, no audit rows created by the audit itself.
- All findings verified by source inspection; the running demo DB state is exactly as left by the activation milestone (19 users, 2 governance memberships, `AuditLog: 56`).

## 23. Finding Register (🔴/🟡/⚪ with required detail)

### F1 🔴 Cross-department result approval — HOD can approve other departments' results
- Files/routes/actions: `src/lib/module-actions.ts:1307-1339` (`approveResult`, no dept scope); `src/app/portal/results/page.tsx:190-224` (HOD branch query `gradeStatus:"SUBMITTED"` with no course/department filter, `take 50`, Approve button for every row); contrast `src/app/portal/hod/approvals/page.tsx:23-34` (correctly filters by `departmentCourseCodes(dept)`).
- Current behavior: HOD/HOD_DEAN (and any role with EXAMS_RECORDS A) can approve a SUBMITTED result whose course belongs to any department.
- Expected behavior: `approveResult` must reject results outside the HOD's department; the shared results view must filter by department codes.
- Impact: cross-department grade-approval integrity/authorization breach (HIGH).
- Recommended fix: in `approveResult`, after loading the result, require `courseInDepartmentCatalogue(session.user.faculty, session.user.department, result.course.code)` when `isHodRole(role)`; scope the `/portal/results` HOD query with `departmentCourseCodes`. Also add the same scope to the unscoped appeal queue on that page if HODs may review appeals.
- Schema migration required: No. Fixable entirely in application code: Yes.

### F2 🔴 VC Reports CSV download 404
- File/route: `src/app/portal/vc/reports/page.tsx:34` → `/api/portal/vc/reports/${r.slug}.csv`; no matching route (API tree is `/api/v1/*` only). DVC counterpart works: `/portal/dvc/reports/export?report=` (dvc/reports/export/route.ts).
- Current behavior: every "Download CSV" link on the VC reports page returns 404.
- Expected: a working, guarded CSV export (mirror the DVC export route: `requireVC` + audit + CSV) or link to the existing DVC export.
- Impact: functional (executive report download broken); no security impact.
- Fix: add `src/app/portal/vc/reports/export/route.ts` (or equivalent) reusing `governanceCsv`/`GOVERNANCE_REPORTS` and point the link at it.
- Schema migration required: No. Application code only: Yes.

### F3 🟡 Post-login landing ignores `landingForRole()`
- Files: `src/app/login/actions.ts:158-160` (login redirect) and `:231` (changePassword redirect) → `/portal/dashboard` for every role.
- Current: all six demo roles land on the generic dashboard after login/forced password change; role workspaces require an extra click or a typed URL.
- Expected: redirect to `landingForRole(user.role)` (e.g. HOD → `/portal/hod`).
- Impact: UX/discoverability (combined with F4/F9, users may not find their workspace). No security impact.
- Fix: use `landingForRole` after change-password/MFA. Application code only. No migration.

### F4 🟡 Auto-sidebar "Results" link bounces DEAN / SBC_CHAIRMAN / DVC_OVERSIGHT / GOVERNANCE_OVERSIGHT_MEMBER
- Files: `src/app/portal/layout.tsx:37-52` (sidebar from `visibleModules`); `src/app/portal/results/page.tsx:381` (`redirect("/portal/dashboard")` fallthrough).
- Current: these four roles have EXAMS_RECORDS: R → sidebar shows "Results" → `/portal/results` has no branch for them → redirected back to the dashboard (loop). Their real results surfaces (`/portal/dean/results`, `/portal/sbc/results`, DVC pipeline views) are not in the sidebar.
- Expected: either `/portal/results` routes each role to its own results page, or the sidebar hides/relabels the link for roles with no branch.
- Impact: broken navigation/dead-end; DVC/GOV/SBC rely on inline links.
- Fix: add branches in `results/page.tsx` for these roles (or per-role redirect), or restrict sidebar generation. Application code only.

### F5 🟡 Dead `VC_MENU` + `/portal/students` + `/portal` 404s
- Files: `src/lib/constants.ts:718-723` (`VC_MENU`, includes `/portal/students`); imported unused at `src/app/portal/vc/page.tsx:11`; no `src/app/portal/students` or `src/app/portal/page.tsx`.
- Current: VC_MENU never rendered; its "Students" entry 404s; `/portal` itself 404s.
- Expected: either render the menu, point it at existing routes (`/portal/vc/students`), or delete it; add `/portal` → `/portal/dashboard` redirect.
- Impact: broken links/dead code (cosmetic-to-functional). Fix: application code only.

### F6 🟡 No centralized route authorization (no `middleware.ts`)
- Current: all authz is per-page/per-action; nothing validates path↔role at the layout/edge.
- Expected: a guard layer (middleware or layout segment) so a newly added executive route can't default-open.
- Impact: defense-in-depth gap; not an active vulnerability today (all audited pages are guarded).
- Fix: add route↔role checks in `portal/layout.tsx` or middleware for the six workspaces. No migration.

### F7 🟡 CHAIRMAN vs MEMBER designations grant identical powers
- File: `src/lib/governance.ts:44-53` ("the Chairman is still a member with the same powers").
- Current: designation is display-only; matrix is identical for both governance roles.
- Expected: if the product requires distinct Chairman powers, add a permission delta; otherwise document as intended.
- Impact: minor; no current functional break. Fix: product decision; application code only if changed.

### F8 🟡 No action-level negative tests for executive write actions
- Current: `constants.test.ts` covers the matrix; `module-actions.smoke.test.ts` covers bursary/fees/transcripts/clearance — not `approveResult`, `createCourseOffering`, `assignCourse`, `returnResult`, or the senate actions. F1 is therefore untested at integration level.
- Expected: integration tests that (a) assert a non-HOD role can't approve, (b) assert an HOD can't approve another department's result, (c) assert DEAN can't approve/finalise, (d) assert SBC can't finalise.
- Fix: extend `module-actions.smoke.test.ts` (or a new executive test) with seeded-session negative cases. Tests only; no migration.

### F9 🟡 SBC workspace discoverability
- Current: `SENATE` module produces no sidebar entry (`PORTAL_MODULES`/`CROSS_CUTTING` exclude it); SBC navigation exists only as inline links on `sbc/page.tsx:231-235`. Combined with F3, a freshly logged-in SBC sees no Senate link.
- Impact: UX/discoverability. Fix: add a SENATE sidebar entry or a role-conditional menu. Application code only.

### F10 ⚪ Interactive UI walkthrough not executed
- Not testable non-destructively in this session: rendering role pages requires a live session, which would create Session/AuditLog rows (a DB write, prohibited by this milestone) and the app is not being served at a stable URL for automated assertions. Source-level UAT + production build + 195 unit/integration tests stand in its place. Recommended: run the interactive walkthrough in the next milestone when temporary test data is authorized.

## 24. Recommended Remediation Priorities + Proposed Next Milestone

Priorities:
1. **P1 — F1** cross-department approval scope (server action + shared view + tests). Security.
2. **P1 — F2** VC reports CSV export route. Functional.
3. **P2 — F4** sidebar results routing for DEAN/SBC/DVC/GOV. Navigation.
4. **P2 — F3** post-login `landingForRole`. UX.
5. **P3 — F5/F6/F7/F8/F9** dead code, centralized guard, designation powers, action-level tests, SBC discoverability.

**Proposed next milestone — "HOD Result-Approval Scope Hardening":**
Add server-side department scope to `approveResult`, scope the shared
`/portal/results` HOD branch and its appeal queue to the HOD's department,
add a guarded VC reports CSV export (fixes F2), and add action-level negative
integration tests for the executive write actions (F8). All changes are
application-code only — no schema changes, no migrations, no account or RBAC
matrix modifications — followed by the standard gates (`tsc`, `lint`,
`npm test`, `build`) and an interactive UI walkthrough (authorized test data
only) to retire F10.
