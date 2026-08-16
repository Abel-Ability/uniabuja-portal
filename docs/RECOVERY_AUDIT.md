# Recovery Audit — UniAbuja Portal

**Date:** 2026-08-14
**Audit type:** Read-only (no source, schema, migration, database, spreadsheet or data changes)
**Auditor scope:** Baseline / build state, database, course architecture, Google Sheets, staff & student data, RBAC, all workspaces, route & file inventory, automated checks.
**Commands run:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` — results in §16.
**Status:** Full green build & test suite, but the demo dataset and role wiring are **incomplete for several workspaces** (see §17 and §18).

> Legend used in this document:
> 🟢 Working as intended · 🟡 Partially working / degraded · 🔴 Broken or unreachable · ⚪ Present in code but not verifiable in this run

---

## 1. Baseline & toolchain

| Item | Value |
|---|---|
| Framework | Next.js 16.3.0 (App Router, Turbopack) |
| React | 19.2.8 |
| TypeScript | ^5 |
| ORM | Prisma ^7.9.1, generator `prisma-client` → `src/generated/prisma` (do not edit) |
| Driver | `@prisma/adapter-pg` + `pg` (PrismaPg driver adapter) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `@custom-variant dark` in `globals.css` |
| Auth | HMAC-SHA256 signed cookie session (`SESSION_COOKIE = uap_session`, 4h TTL, 30-min idle), Prisma `Session` rows, MFA (TOTP), lockout after 5 failed attempts, rate limit 20/min/IP |
| Tests | Vitest 4.1.10 + jsdom (`npm test` = `vitest run`) |
| Package manager | npm |
| Local DB | embedded-postgres via `scripts/start-db.ts` (`npm run db:start`) |
| Demo password | `UniAbuja@2026` (forced change on first login), MFA at `/login/mfa` |
| Deployment target | Not identifiable from repo files in this audit (no `vercel.json`/deploy config found; earlier sessions deployed to Vercel) |

## 2. Database audit

- Provider: **PostgreSQL**. `prisma/schema.prisma` header comment still says "SQLite local / Postgres prod" — **stale**, the datasource is `postgresql`. Cosmetic only.
- Client: `src/lib/prisma.ts` lazily creates the `PrismaPg`-adapter client behind a global singleton; `DATABASE_URL` required at client creation.
- Migrations: **15 present**, from `20260809000000_init_postgres` through `20260814000000_add_course_offering`. No missing-migration warnings on build.
- Seed (`prisma/seed.ts`): wipes all tables (TRUNCATE CASCADE on Postgres) then creates:
  - **16 users, one per role** (APPLICANT, STUDENT ×3, LECTURER, HOD_DEAN, REGISTRY, BURSARY, STUDENT_AFFAIRS, EXAMS_RECORDS, PG_SCHOOL, SIWES, TIMETABLE, IT_ADMIN, DVC_OVERSIGHT, VC).
  - 3 programmes, 8 courses, announcements, invoices/payments, a clearance request, hostels, SIWES/logbook, PG application, senate matters, etc.
  - ⚪ I did **not** connect to the database in this audit, so live row counts are unverified; seed output above is from code inspection.
- Security feature present and covered by tests: **hash-chained, append-only audit log** (`src/lib/audit.ts`; `verifyChain()` used by DPO and governance views).

## 3. Course architecture

| Area | Status | Evidence |
|---|---|---|
| `Course` model | 🟢 Present, seeded (8 rows) | `prisma/seed.ts` |
| `CourseOffering` model + migration | 🟢 Schema/migration exists | `20260814000000_add_course_offering` |
| Create-offering **server action** | 🔴 **Missing** — HOD "Offering Creation Form" is a simulation that creates nothing ("In production, this would call a server action…") | `src/app/portal/hod/course-offerings/OfferingCreationForm.tsx` |
| HOD course-offerings list | 🟡 Empty `where` clause (no department filter); "View" links to `/portal/hod/course-offerings/[id]/detail` which **does not exist** (404) | `src/app/portal/hod/course-offerings/page.tsx` |
| `CourseAssignment` + allocation | 🟢 Real upsert via `assignCourse`/`unassignCourse` (`module-actions.ts:1812`), unique `courseCode_academicSession_semester`, lecturer + team members | `src/app/portal/hod/course-allocation/` |
| `registerCourse` (`module-actions.ts:1327`) | 🟡 Does **not** validate against `CourseOffering`; reads `Course` directly; semester from `course.semester`, session from `CURRENT_SESSION`; checks duplicate (ACTIVE/WAITLISTED), fee clearance (Invoice OPEN/OVERDUE/PARTIAL on TUITION/ACCEPTANCE + FeeAccount), capacity → WAITLISTED, prerequisites | |
| Student registration UI | 🟡 15-credit minimum is **client-side only** (`canSubmit = totalUnits >= 15`); registration reference is a cosmetic client string (not stored); no server-side lock-after-submit | `src/app/portal/student/course-registration/CourseRegistrationForm.tsx` |

## 4. Google Sheets integration

- `src/lib/sheets.ts` reads one spreadsheet: `SPREADSHEET_ID = "1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8"` via the gviz CSV endpoint.
- Tabs wired in code: `Fac_Dept_All`, `Centres2`, `Announcements`, `Academic_Calendar`, `Standard_Levies`, `Programme_Tuition`, `Courses_UG` (columns Code / Title / Faculty / Hosting Department / Semester / Unit).
- 10-minute in-memory TTL cache; falls back to last-good payload / empty array on fetch failure.
- 🔴 **No `Staff` or `Students` tab is referenced anywhere in `sheets.ts`** — staff/student population is *not* driven by Sheets in the current code (contrary to the target architecture's staff spreadsheet concept).

## 5. Staff & student data sources

- 🔴 **The ~792-staff dataset is NOT present in the codebase.** No occurrence of "792" anywhere in `prisma/` or `src/`. Seed creates only 15 staff-role demo users.
- 🔴 **No staff import/population mechanism** found: no staff CSV/JSON in repo, no Staff sheet tab, no staff API sync.
- Consequences:
  - `facultyDepartments()` (`src/lib/faculty.ts`) derives a faculty's departments from **LECTURER rows' `faculty` field** → empty for every faculty → Dean/VC faculty & department breakdowns render "No departments" and 0s.
  - Seed staff accounts carry **no `faculty`/`department`** value, so even the HOD/Dean demo accounts have empty scopes.
- ⚪ An external staff source (school feed / spreadsheet) is the only plausible origin of the 792 records; it is not wired in this restored codebase.

## 6. Roles & RBAC

Defined in `src/lib/constants.ts`: `ROLE_LABELS` (15 roles), `ACCESS_CONTROL_MATRIX` (R/W/A/S/V per module), `can()`, `visibleModules()`, `landingForRole()`, `PORTAL_MODULES`, `HOD_MENU`, `DEAN_MENU`, `VC_MENU`.

**Critical mismatches:**

| Issue | Status | Detail |
|---|---|---|
| HOD workspace guards on role **`"HOD"`**, but matrix/labels define only **`HOD_DEAN`** | 🔴 | `hod/page.tsx:18` `if (session.user.role !== "HOD") redirect(landingForRole(...))`. The seeded HOD account has role `HOD_DEAN`, so it is redirected to `/portal/hod` (its landing) → **infinite redirect loop**. Also `visibleModules("HOD")` and `can("HOD", …)` are empty. |
| Dean workspace guards on role **`"DEAN"`** | 🔴 | `dean/page.tsx:44`; `"DEAN"` is **not** in `ROLE_LABELS`/matrix, and **no seed account** has role DEAN → Dean workspace unreachable in demo. |
| SBC workspace | 🔴 | `SBC_CHAIRMAN` is in matrix + `landingForRole`, but **not** in `ROLE_LABELS` and **no seed account** → unreachable in demo. |
| Governance/Oversight (DVC) | 🔴 | DVC demo user exists (`DVC_OVERSIGHT`), but `dvc/guard.ts` requires an **ACTIVE `CommitteeMembership`** row for `GOVERNANCE_OVERSIGHT`; **seed creates none** → DVC is bounced to `/portal/dashboard`. (Governance code itself is complete and richly tested.) |
| `VERIFIER` | 🟡 | In matrix + labels, **no seed account** → no demo login for the verify role. |
| Post-login landing | 🟡 | Login (`src/app/login/actions.ts`) always redirects to `/portal/dashboard`, not `landingForRole(role)`; role workspaces are reached via dashboard quick actions / generic sidebar. |

Note: `HOD_DEAN` *does* exist in the matrix, so the generic portal sidebar renders modules for that role correctly; the break is specifically that the HOD/Dean **workspace pages** demand the narrower roles `HOD`/`DEAN`.

## 7. Workspaces status

| Workspace | Guard | Seed demo | Status |
|---|---|---|---|
| Applicant → `/portal/applications` | `landingForRole`/matrix | ✅ APPLICANT | 🟢 |
| Student → `/portal/student` | matrix | ✅ STUDENT | 🟢 (see §8 gaps) |
| Lecturer → `/portal/lecturer` (+ results, files, level-adviser, backlog) | matrix | ✅ LECTURER | 🟢 |
| Registry/Admin → `/portal/admin` | matrix | ✅ REGISTRY / IT_ADMIN | 🟢 |
| Bursary → `/portal/bursary` (+8 subpages) | matrix | ✅ BURSARY | 🟡 (§12) |
| Student Affairs → `/portal/hostels` | matrix | ✅ STUDENT_AFFAIRS | 🟢 |
| Exams & Records → `/portal/results` | matrix | ✅ EXAMS_RECORDS | 🟢 |
| PG School → `/portal/postgraduate` | matrix | ✅ PG_SCHOOL | 🟢 |
| SIWES → `/portal/siwes` | matrix | ✅ SIWES | 🟢 |
| Timetabling → `/portal/timetabling` | matrix | ✅ TIMETABLE | 🟢 |
| DVC/Governance → `/portal/dvc` | membership-gated | ✅ DVC_OVERSIGHT but **no membership row** | 🔴 demo-blocked |
| VC → `/portal/vc` (+15 subpages) | `requireVC` | ✅ VC | 🟡 (several subpages scaffolded — §11) |
| HOD → `/portal/hod` | role `"HOD"` | ⚠️ seeded as `HOD_DEAN` | 🔴 loop/unreachable |
| Dean → `/portal/dean` | role `"DEAN"` | ❌ none | 🔴 unreachable |
| SBC → `/portal/sbc` | `requireSbcChairman` | ❌ none | 🔴 unreachable |
| DPO → `/portal/dpo` | cross-cutting | (no specific role) | 🟢 |

## 8. Student workspace

- Routes: `/portal/student` (dashboard), `course-registration`, `courses`, `academic-progress`, `view-registration`. **No** student results, academic-calendar, or profile pages.
- 🟡 The **7-item student sidebar design is not implemented** — students get the generic `PortalShell` module sidebar (Dashboard + visible modules + Notifications + Account & Security).
- 🟡 Course registration: 15-credit minimum client-side only; no CourseOffering validation; no registration lock; cosmetic reference (§3).

## 9. HOD workspace (roles/guards)

- Pages guard `role !== "HOD"` (`page.tsx:18`, `approvals`, `students`, `staff`, `course-allocation`, `course-offerings`, `level-advisers`, `level-coordinators` all identical).
- Quick-action grid uses `HOD_MENU` — fine, but unreachable because of the role mismatch (§6).
- `departmentCourseCodes()` (`src/lib/hod.ts`) scopes by `user.department`; seed HOD has no department → empty scope even if reachable.

## 10. Dean workspace

- Pages guard `role !== "DEAN"`; dashboard requires `user.faculty` (`dean/page.tsx:46`) and shows an EmptyState "No faculty assignment" otherwise.
- Faculty scoping via `src/lib/faculty.ts` (read-only, `faculty` always in WHERE) and `src/lib/student-stats.ts` — **implemented correctly**, but depends on a staff roster that is not present (§5).
- Subroutes: students (+`[id]`, export), staff, results, admissions, graduation, postgraduate, academic-management, communications.

## 11. DVC / Governance / SBC / VC

- **Governance (`src/lib/governance.ts`, 1178 lines):** complete read-only oversight suite — university-wide stats, exceptions register (severity-ranked), faculty/department comparison, monitors (course allocation, level coordination, results pipeline, admissions, graduation, PG), staff/student overviews, and 12 CSV reports. **Well tested** (`governance.test.ts`). 🔴 Demo-blocked by missing CommitteeMembership.
- **DVC guard** (`dvc/guard.ts`): hard-gates on `isGovernanceRole` (DVC_OVERSIGHT / GOVERNANCE_OVERSIGHT_MEMBER) **plus** ACTIVE membership for `GOVERNANCE_OVERSIGHT`; chairman is a designation only.
- **SBC** (`sbc/guard.ts` → `requireSbcChairman`): pages exist (communications, decisions, matters, reports, results). 🔴 No demo account.
- **VC** (`vc/guard.ts` → `requireVC`): reachable with `vc@uniabuja.edu.ng`. 🟡 **Many VC subpages are partially scaffolded** — the lint run flags unused imports in `vc/{page,academic,admissions,centres,faculties,graduation,postgraduate,reports,research,results,staff,students}.tsx` (the majority of the 41 warnings).

## 12. Bursary workspace

- Dashboard (`src/app/portal/bursary/page.tsx`) is functional but with **four metrics hardcoded to 0** (`financiallyCleared`, `unreconciledTransactions`, `pendingRefunds`, `currentSessionRevenue` — code comments "Would need … data").
- 🟡 `recentPayments` is filtered by `userId: user.id` (line 29) — only the bursary user's own payments would appear, not the institution's. Likely a bug or placeholder.
- Subpages present: `accounts`, `calendar`, `clearance`, `communications`, `fees`, `payments`, `reconciliation`, `reports`.

## 13. Course architecture — summary table

| Component | Status |
|---|---|
| Course / CourseOffering / CourseAssignment / CourseRegistration models | 🟢 schema + migrations |
| CourseOffering create action | 🔴 missing (simulated form) |
| HOD offerings page scoping + detail route | 🟡 unscoped; detail link 404s |
| Registration vs CourseOffering | 🟡 no validation |
| 15-unit minimum server-side | 🔴 client-side only |
| Registration lock / reference storage | 🔴 absent |

## 14. Route inventory (from `next build`)

- **Public:** `/`, `/apply`, `/fees`, `/faculties`, `/institutes`, `/info`, `/notices`, `/policies`, `/staff`, `/student`, `/status`, `/verify`, `/verify-email`, `/login`, `/login/mfa`, `/login/change-password`.
- **API v1:** `/api/v1/announcements`, `/deadline`, `/health`, `/me`, `/verify/id`, `/verify/result`, `/verify/transcript`.
- **Portal (all present in build):** account, admin, applications, appointments, bursary(+8), communications, dashboard, dean(+8 incl. students/[id], students/export), dpo, dvc(+11 incl. students/export, reports/export), fees, graduation, health, help, helpdesk, hod(+7 incl. students/[id], students/export), hostels, lecturer(+7 incl. result-files/[id]), level-advisers, library, lms, notifications, postgraduate, profiles, results, sbc(+4), siwes, student(4), timetabling, transcripts, vc(+15).
- Build output shows **no route missing at compile time**; `/portal/hod/course-offerings/[id]/detail` is the known runtime 404 (page simply not written).

## 15. File inventory (highlights)

- Core lib: `constants.ts` (674 lines, RBAC + menus + helpers), `module-actions.ts` (2300+ lines, ~40 exported actions incl. registerCourse:1327, assignCourse:1812, submitGrade:1225, approveResult:1293, submitApplication:778), `prisma.ts`, `session.ts`, `sheets.ts`, `audit.ts`, `governance.ts`, `faculty.ts`, `senate.ts`, `hod.ts`, `student-stats.ts`, `level-advisers.ts`.
- Guards: `src/app/portal/{vc,sbc,dvc}/guard.ts`.
- Components: `src/components/ui` (Card, Table, StatCard, Badge, StatusBadge, EmptyState, SectionHeading, PageHeader…), `header.tsx`, `footer.tsx`, `portal-shell.tsx`, `theme-toggle.tsx`, `login-form.tsx`, `hbar.tsx`.
- Tests: 11 files, 137 tests — `audit.test.ts`, `hydration-check.test.tsx`, `governance.test.ts`, `constants.test.ts`, `captcha.test.ts`, `password.test.ts`, `module-actions.smoke.test.ts`, `student-stats.scope.test.ts`, `student-stats.test.ts`, `utils.test.ts`, `api/v1/api.test.ts`.

## 16. Automated checks (run this session, no fixes applied)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, **41 warnings** (majority: unused imports in VC workspace pages; 2 `next/image` `<img>` warnings; 1 unused `formData` in `module-actions.ts:2331`) |
| `npm test` (vitest run) | ✅ 11 files / 137 tests passed |
| `npm run build` | ✅ Production build succeeded (Turbopack, Next 16.3.0) |

## 17. Recovery comparison — CURRENT vs TARGET

| Area | TARGET (spec) | CURRENT (this codebase) | Status |
|---|---|---|---|
| Staff dataset (~792) | Seeded/imported with faculty+department | Only 15 demo users; no import mechanism | 🔴 |
| Student dataset | Bulk students with dept/faculty | 3 demo students | 🔴 |
| Student sidebar | 7-item student-specific nav | Generic module sidebar | 🟡 |
| Student academic calendar / profile pages | Present | Absent | 🟡 |
| Course offerings lifecycle | HOD defines offerings (create/scope) | Model only; simulated create; unscoped list; detail 404 | 🔴 |
| Registration integrity | Server-side credit min + lock + CourseOffering checks | Client-side only; no lock | 🟡 |
| HOD workspace | Role `HOD` works | Guard `HOD` vs seeded `HOD_DEAN` → redirect loop | 🔴 |
| Dean workspace | Role `DEAN` works | No DEAN account; guard role absent from matrix | 🔴 |
| SBC workspace | SBC chairman can sign in | No seed account; label missing | 🔴 |
| DVC/Governance | Membership-gated (correct) | Membership never seeded → demo-blocked | 🟡 |
| Bursary metrics | Real aggregates | 4 metrics hardcoded 0; payments scoped to own user | 🟡 |
| VC subpages | Fully built | Several partially scaffolded (unused imports) | 🟡 |
| Google Sheets | Staff/students via spreadsheet | Only 7 public-content tabs; no staff/student tabs | 🔴 |
| Audit log | Hash-chained append-only | ✅ Implemented + verified by tests | 🟢 |
| RBAC matrix | Full | ✅ 15 roles matrix; except HOD/DEAN guard mismatch | 🟢/🟡 |
| Build / lint / tests | Green | ✅ All green (41 pre-existing warnings) | 🟢 |

## 18. Database safety confirmation

- This audit performed **no writes**: no schema/migration change, no `db:reset`/`db:migrate`/`db:seed`, no data modification, no Google Sheets edits.
- The only file created is this audit document (`docs/RECOVERY_AUDIT.md`).
- `npm run build` wrote to `.next` (standard build artifact only).
- The audit log module and seed `TRUNCATE ... CASCADE` behavior are unchanged.

## 19. RECOVERY PRIORITY (proposed — for implementation AFTER this audit, with your approval)

1. **Priority 1 — role wiring & demo access (blocks most workspaces):**
   - Resolve HOD/DEAN guard vs `HOD_DEAN` mismatch (either seed/role-align to one role or update guards/matrix so `HOD` and `DEAN` exist consistently in `ROLE_LABELS`, `ACCESS_CONTROL_MATRIX` and `landingForRole`).
   - Seed a `CommitteeMembership` (ACTIVE) for the DVC demo user so Governance is reachable.
   - Add seed accounts/labels for `DEAN`, `SBC_CHAIRMAN` (and `VERIFIER` optional).
2. **Priority 2 — staff/student data restoration:**
   - Re-establish the staff roster import (792 records) with faculty + department, and the student bulk load (dept + faculty mapping); seed a real Dean account tied to a faculty.
3. **Priority 3 — course architecture:**
   - Real `createCourseOffering` server action; scope the HOD offerings list by department; create the missing offering detail route; make `registerCourse` validate against `CourseOffering`, enforce the credit minimum server-side, and add a server-side registration lock + stored reference.
4. **Priority 4 — polish/placeholders:**
   - Fix Bursary placeholder metrics and the own-user payments filter; finish VC scaffolded subpages; decide whether the student-specific 7-item sidebar + academic-calendar/profile pages are required for the demo.
5. **Housekeeping (no functional risk):** stale SQLite comment in `schema.prisma`; 41 lint warnings.

## 20. Open questions for you

- Should staff records be **re-imported from the spreadsheet** (a Staff tab / separate feed) or hand-seeded in `seed.ts`?
- For HOD/Dean: do you want a **single `HOD_DEAN` role** (guards updated) or **separate `HOD` and `DEAN` roles** added to the matrix + labels?
- Is the DVC demo account expected to double as the Governance Committee **Chairman**, or should a second membership row be seeded?
- Which VC subpages are intended to be "real" vs demo placeholders?
