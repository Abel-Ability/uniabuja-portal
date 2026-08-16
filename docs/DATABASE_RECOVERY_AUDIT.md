# Database Schema Recovery Audit — UniAbuja Portal

**Date:** 2026-08-14
**Mode:** READ-ONLY. No schema, migration, database, seed, RBAC, spreadsheet or application code was modified. The only file written is this audit document.
**Source of truth:** the current restored `prisma/schema.prisma` (1,234 lines), the migration folders under `prisma/migrations/`, and read-only source greps of `src/`.

---

## A. Scope and method

This is the schema-and-migrations recovery audit (sections A–K below). All evidence was gathered read-only:

- `prisma/schema.prisma` read in full (1,234 lines, **77 models**).
- Migration SQL searched (`Get-ChildItem -Recurse prisma\migrations -Filter migration.sql`) for `CourseOffering|OfferingStatus|CourseRegistration|programmeId|academicSession|semester|level` → section D.
- Source tree searched (`src/app`, `src/components`, `src/lib`) for `course-offerings|CourseOffering|OfferingCreationForm` and `registerCourse|registerSelectedCourses` → sections E and F.
- Key files read in full: `src/lib/module-actions.ts` (registerCourse/dropCourse), `src/app/portal/hod/course-offerings/page.tsx`, `src/app/portal/hod/course-offerings/OfferingCreationForm.tsx`.
- No migration, reset, seed, DB write, or `prisma migrate status` executed (read-only).

---

## B. Complete model inventory (current restored schema)

The schema declares **77 Prisma models** (grep `^model` returns 76 because `FOIRequest` at line 949 is indented one space):

**AUTH & CORE:** `User`, `Session`, `EmailVerificationToken`, `PasswordHistory`, `AuditLog`, `FeatureFlag`

**ACADEMIC & PROGRAMMES:** `AcademicCalendarEntry`, `Programme`

**ADMISSIONS:** `Application`, `DocumentUpload`, `AdmissionOffer`

**FEES:** `FeeAccount`, `Invoice`, `Payment`, `Scholarship`, `Waiver`, `PaymentPlan`

**ACADEMIC RECORDS:** `Course`, `CourseRegistration`, `Result`, `MisconductCase`, `Appeal`

**ACCOMMODATION:** `Hostel`, `BedSpace`, `HostelApplication`, `MaintenanceRequest`

**TRANSCRIPTS / VERIFICATION:** `TranscriptRequest`, `VerificationRecord`

**LMS:** `LmsSyncLog`

**PROFILES & RESEARCH:** `StaffProfile`, `ResearchOutput`

**GRADUATION / CLEARANCE:** `ClearanceRequest`, `ClearanceItem`, `ClearanceItemApprovalLog`, `Convocation`, `GraduationRecord`

**ALUMNI:** `AlumniProfile`, `AlumniDonation`

**LIBRARY:** `LibraryHolding`, `LibraryLoan`, `LibraryHold`

**POSTGRADUATE:** `PGApplication`, `SupervisorAssignment`, `Thesis`

**SIWES:** `SIWESRecord`, `LogbookEntry`, `VisitationReport`

**NYSC:** `NYSCBatch`, `NYSCRecord`

**TIMETABLING:** `Venue`, `VenueBooking`, `TimetableEntry`

**COMMS / HELP / COMPLIANCE:** `Announcement`, `Notification`, `NotificationPreference`, `MessageTemplate`, `HelpTicket`, `ChatTranscript`, `Document`, `Consent`, `DataSubjectRequest`, `FOIRequest`, `BreachLog`, `ApiCredential`, `IdCard`

**HOD / ACADEMIC MANAGEMENT:** `CourseAssignment`, `CourseAssignmentMember`, `LevelCoordinator`, `LevelAdvisorAssignment`

**GOVERNANCE:** `Appointment`, `CommitteeMembership`, `SenateMatter`, `SenateDecision`, `SenateAgenda`

**RESULT PROCESSING:** `ResultFile`, `ResultCorrectionRequest`

**COURSE OFFERINGS:** `CourseOffering`

---

## C. Critical model check

| Model | Exists? | Notes |
|---|---|---|
| User | ✅ | Line 19. Single account/person model. |
| Session | ✅ | Line 121. |
| Staff | ❌ | **No `Staff` model.** Staff are `User` rows carrying `staffNo` (unique) + optional `StaffProfile`. |
| Student | ❌ | **No `Student` model.** Students are `User` rows carrying `registrationNo` (unique) + `studentCategory`. |
| Faculty | ❌ | **No `Faculty` model.** `faculty` is a free-form `String?` snapshot on `User` and `CourseAssignment`. |
| Department | ❌ | **No `Department` model.** `department` is a free-form `String?` snapshot on `User`, `CourseAssignment`, `LevelCoordinator`, `LevelAdvisorAssignment`, etc. |
| Programme | ✅ | Line 205. Relates to `User`, `Application`, `PGApplication`, `LevelAdvisorAssignment`, `CourseOffering`. |
| Course | ✅ | Line 350. |
| CourseOffering | ✅ | Line 1218 (see §G). |
| CourseAssignment | ✅ | Line 999 (see §G). |
| CourseRegistration | ✅ | Line 366 (see §F). |
| Result | ✅ | Line 380 (see Appendix). |
| Payment | ✅ | Line 292. |
| Invoice | ✅ | Line 277. |
| Fee | ❌ | **No `Fee` model.** Charges are `Invoice` rows / `Programme.tuitionCents` / `FeeAccount`. |
| Waiver | ✅ | Line 320. |
| Clearance | ⚠️ | No model literally named `Clearance`; clearance is `ClearanceRequest` + `ClearanceItem` + `ClearanceItemApprovalLog`. |
| AuditLog | ✅ | Line 159. |
| AcademicSession | ❌ | **No `AcademicSession` model.** `academicSession` is a free-form `String` field on many models; `AcademicCalendarEntry` is calendar data only. |
| Application | ✅ | Line 220. |

Other models clearly relevant to the portal (beyond the above): `AdmissionOffer`, `DocumentUpload`, `EmailVerificationToken`, `PasswordHistory`, `FeatureFlag`, `Scholarship`, `PaymentPlan`, `MisconductCase`, `Appeal`, `Hostel`, `BedSpace`, `HostelApplication`, `MaintenanceRequest`, `TranscriptRequest`, `VerificationRecord`, `LmsSyncLog`, `StaffProfile`, `ResearchOutput`, `Convocation`, `GraduationRecord`, `AlumniProfile`, `AlumniDonation`, `LibraryHolding/Loan/Hold`, `PGApplication`, `SupervisorAssignment`, `Thesis`, `SIWESRecord`, `LogbookEntry`, `VisitationReport`, `NYSCBatch`, `NYSCRecord`, `Venue`, `VenueBooking`, `TimetableEntry`, `Announcement`, `Notification`, `NotificationPreference`, `MessageTemplate`, `HelpTicket`, `ChatTranscript`, `Document`, `Consent`, `DataSubjectRequest`, `FOIRequest`, `BreachLog`, `ApiCredential`, `IdCard`, `CourseAssignmentMember`, `LevelCoordinator`, `LevelAdvisorAssignment`, `Appointment`, `CommitteeMembership`, `SenateMatter`, `SenateDecision`, `SenateAgenda`, `ResultFile`, `ResultCorrectionRequest`.

---

## D. Migration content search (what the SQL actually builds)

All 15 `migration.sql` files were searched for the course-registration/offering terms. **Only `CourseOffering`'s own migration matches `CourseOffering`; no migration anywhere mentions `OfferingStatus` or a `Fee` table.**

| Migration | Term matches found in SQL |
|---|---|
| `20260809000000_init_postgres` | `CourseRegistration` table created (SQL line 263): `userId`, `courseId`, `academicSession TEXT NOT NULL` (267), `semester INTEGER NOT NULL` (268), `status` default ACTIVE, `lmsSynced`, `createdAt`, PK (273). Unique index `CourseRegistration_userId_courseId_academicSession_semester_key` (952). FKs `CourseRegistration_userId_fkey` (1051) and `CourseRegistration_courseId_fkey` (1054), both `ON DELETE RESTRICT`. Also `Result_userId_courseId_academicSession_semester_key` (955); `programmeId TEXT` on User (18), Application (123, NOT NULL), PGApplication (158, NOT NULL); `User_programmeId_fkey` (997); `Application_programmeId_fkey` (1009); `PGApplication_programmeId_fkey` (1153); `level/semester INTEGER` on Course (254/255). |
| `20260809040000_course_assignment` | `academicSession TEXT NOT NULL` (14), `semester INTEGER NOT NULL` (15), unique `(courseCode, academicSession, semester)` (22). |
| `20260809050000_appointments` | `academicSession TEXT` (11). |
| `20260811000000_lecturer_results` | `academicSession`/`semester` on `ResultFile` (9/10) and `ResultCorrectionRequest` (39/40). |
| `20260811194705_add_level_coordinator` | `LevelCoordinator`: `level INTEGER NOT NULL` (4), `academicSession TEXT NOT NULL` (6), unique `(level, department, academicSession)` (16), FKs to `User` (19, 22). |
| `20260811233845_add_level_advisor_assignments` | `LevelAdvisorAssignment`: `academicSession` (4), `programmeId TEXT` nullable (7), `level` (8), indexes on `(adviserId, status)` (22) and `(department, academicSession)` (25), unique `(department, academicSession, level, programmeId)` (28), `programmeId_fkey` → `Programme ON DELETE SET NULL` (31). |
| `20260814000000_add_course_offering` | Full `CourseOffering` DDL — see below. |

`20260814000000_add_course_offering/migration.sql` (29 lines) verbatim essentials:

- `CREATE TABLE "CourseOffering"` (2): `id TEXT` PK (13), `courseId TEXT NOT NULL`, `programmeId TEXT` nullable (5), `academicSession TEXT NOT NULL` (6), `semester INTEGER NOT NULL` (7), `level INTEGER NOT NULL` (8), `status TEXT NOT NULL DEFAULT 'ACTIVE'`, `createdAt`/`updatedAt`.
- Indexes: `CourseOffering_courseId_idx` (17), `CourseOffering_programmeId_idx` (20), unique `CourseOffering_courseId_programmeId_academicSession_semester__idx` on `(courseId, programmeId, academicSession, semester, level)` (23).
- FKs: `courseId_fkey` → `Course ON DELETE RESTRICT` (26); `programmeId_fkey` → `Programme ON DELETE SET NULL` (29).

**Conclusions from D:** the offering table is the newest migration and matches the schema 1:1; `CourseRegistration` was born in `init_postgres` and no later migration touched it; there is **no `OfferingStatus` concept anywhere** (status is `ACTIVE|INACTIVE` on `CourseOffering.status`).

---

## E. Source wiring: `CourseOffering` / `OfferingCreationForm` / `course-offerings`

Grep of `src/app`, `src/components`, `src/lib` for `course-offerings|CourseOffering|OfferingCreationForm|prisma.courseOffering|courseOffering` (excluding generated Prisma client):

| File | References |
|---|---|
| `src/lib/constants.ts:630` | HOD_MENU link: `href: "/portal/hod/course-offerings"`, label "Course Offerings" |
| `src/app/portal/hod/course-offerings/page.tsx` | See below |
| `src/app/portal/hod/course-offerings/OfferingCreationForm.tsx` | See below |

`src/app/portal/hod/course-offerings/page.tsx` (169 lines):

- Guard (19): `if (session.user.role !== "HOD") redirect(landingForRole(session.user.role));` — **HOD only, but seed/matrix use `HOD_DEAN`** → the seeded HOD account is redirected away (loop-to-dashboard) and can never reach this page. App-level, not schema.
- Catalogue (23–28): `getCoursesUG()` (Google Sheets) filtered by `c.faculty === user.faculty && c.hostingDepartment === dept`.
- **Offering query (32–43) has an empty `where: {}`** — the comments even say "We'll filter by programme later" / "HOD scope = their department's programmes" but no filter is applied, so **every HOD sees every offering in the DB** (no department scoping in the query).
- `offeringMap` (46–52) dedupes on `${course.code}|${session}|${semester}|${programmeId||"all"}|${level}`.
- Programme list (58–64): distinct `programmeId` from `User` rows where `department = dept, role = "STUDENT"`.
- **"View" link (138) → `/portal/hod/course-offerings/${offering.id}/detail` — that route does NOT exist** (glob of `src/app/portal/hod/course-offerings/**` returns only `page.tsx` and `OfferingCreationForm.tsx`) → **404**.

`src/app/portal/hod/course-offerings/OfferingCreationForm.tsx` (263 lines, `"use client"`):

- **Does not create anything.** `handleSubmit` (71–151) validates course/session/semester consistency and then (124–147): comment *"Create the CourseOffering via server action … For now, we'll simulate the creation and show success"* — it only resets the form state. **No server action exists anywhere that writes `CourseOffering`** (grep found no `prisma.courseOffering.create` in `src`).
- **Duplicate check is broken** (108–115): compares `o.courseId === courseCode`, i.e. the offering's **Course UUID** against the **catalogue code** (e.g. "CSC101") — never equal, so duplicates are never detected (would also be blocked/enforced by the DB unique index in §D).
- If it ever reached a server action, `fd.append("courseId", courseCode)` (127) would stuff a course *code* into a UUID FK.
- Semester consistency check (100–105) is the only sound validation; the rest is client-only.

**Conclusions from E:** all HOD course-offering *schema* work survived the rollback; all *application* work is missing or broken (no create action, unscoped query, broken duplicate check, no detail route, role guard mismatch). This is app code, not database loss.

---

## F. Registration validation inventory (`registerCourse`)

Search: `registerCourse` exists **only** as `src/lib/module-actions.ts:1327` (`export async function registerCourse`). There is **no `registerSelectedCourses` symbol anywhere** in the source tree. Consumers: `src/app/portal/lms/course-forms.tsx:5,30–31`, `src/app/portal/lms/page.tsx:15,88`, `src/app/portal/student/course-registration/CourseRegistrationForm.tsx:6,52`.

Validation matrix for `registerCourse` (read in full, lines 1327–1385), split by where each check lives:

| Check | Present in `registerCourse`? | Layer |
|---|---|---|
| Session / auth | ✅ `getCurrentSession()`, redirect `/login` if none | Application |
| Role = STUDENT | ✅ `role !== "STUDENT"` → error | Application (role is a plain string; no DB role table) |
| Course exists | ✅ `course.findUnique({ where: { id: courseId } })` | Application → Course table (schema ✅) |
| Duplicate / already registered | ⚠️ partial: `findFirst` checks `ACTIVE` → "already registered", `WAITLISTED` → "on the waitlist" | Application; schema unique `(userId, courseId, academicSession, semester)` is the real guard. **Latent bug:** if a prior row is `DROPPED`/`WITHDRAWN`, the code falls through to `create` and hits a **P2002 unique-constraint violation (unhandled → 500)** instead of re-activating or erroring gracefully. |
| Fee clearance | ✅ unpaid `OPEN/OVERDUE/PARTIAL` invoices on `TUITION/ACCEPTANCE` + `feeAccount.clearanceStatus` | Application; schema has Invoice + FeeAccount (Appendix) |
| Capacity / waitlist | ✅ `enrolled >= course.capacity` → creates `WAITLISTED` row | Application; `Course.capacity Int @default(150)` (schema ✅) |
| Prerequisites | ✅ iterates `course.prerequisites` (Json array of codes), requires a published `Result` with `grade != "F"` | Application; `Course.prerequisites Json?` (schema ✅) |
| **CourseOffering eligibility** | ❌ **not checked at all** — `CourseOffering` is never queried by `registerCourse`; a student can register for a course with no ACTIVE offering (or an INACTIVE offering) for their programme/level | **Schema supports it (`CourseOffering` table + status), app does not use it** |
| **Programme match** | ❌ not checked (`User.programmeId` vs `CourseOffering.programmeId`) | Schema supports it, app does not use it |
| **Level match** | ❌ not checked (`CourseOffering.level` vs student level) | Schema supports it (level on offering; student level is not a stored `User` column — only registrations/results imply it) |
| **Registration window / session** | ❌ no window check; semester taken from `course.semester` (the Course's default semester), session hardcoded to `CURRENT_SESSION` | Schema: `academicSession` strings + `AcademicCalendarEntry` (entryType `REGISTRATION`) exist as a potential driver; app does not consult it |
| **ACTIVE status** | ❌ `CourseOffering.status` is never read | Schema field exists, unused |
| **15-unit minimum** | ❌ **server does not enforce it** — only client-side `canSubmit = totalUnits >= 15` in `CourseRegistrationForm.tsx` | Schema: `Course.units Int` only; no rule/trigger anywhere |

Registration row created (1378): `status: "ACTIVE", lmsSynced: true`, plus `LmsSyncLog` (1380) and `AuditLog` (1383). `dropCourse` (1387–1408) flips to `DROPPED`.

**Conclusions from F:** the server action's *real* validations are auth, course existence, fee clearance, capacity/waitlist, and prerequisites — all application-level over sound schema. **The offering/eligibility/level/programme/window/15-unit checks that the CourseOffering architecture implies are entirely absent** from the application and (for the 15-unit rule and window) have no schema backing either.

---

## G. Course architecture (CRITICAL)

### Target architecture vs schema

Target: `Courses_UG (Sheet) → Course → CourseOffering → Student eligibility → CourseRegistration`

Schema reality: `Course` is the catalogue table; `CourseOffering` (adds session/semester/level/programme) exists but **nothing links CourseRegistration to CourseOffering** — `CourseRegistration.courseId` points at `Course` directly. The eligibility step is therefore **not** wired through `CourseOffering` in the schema or the app.

Target (separate): `Course → CourseAssignment → Lecturer teaching/workload allocation` — **intact** (`CourseAssignment` is a lecturer-allocation model, unchanged).

### Question A–L

| Q | Answer | Exact schema (field names as written) |
|---|---|---|
| A. Does `Course` exist? | ✅ Yes | `Course` (350): `id`, `code @unique`, `title`, `units Int`, `level Int`, `semester Int`, `capacity Int @default(150)`, `prerequisites Json?`; relations `results`, `registrations`, `timetableEntries`, `assignments`, `offerings`. |
| B. Does `CourseOffering` exist? | ✅ Yes | `CourseOffering` (1218). |
| C. Does `CourseAssignment` exist? | ✅ Yes | `CourseAssignment` (999). |
| D. Separate models? | ✅ Yes | Two distinct models (`CourseOffering` 1218–1234, `CourseAssignment` 999–1032). |
| E. Does `CourseOffering` reference `Course`? | ✅ Yes | `courseId String` + `course Course @relation(fields: [courseId], references: [id], onDelete: Restrict)`. |
| F. `academicSession` field? | ✅ Yes | `academicSession String` (1224). |
| G. `semester` field? | ✅ Yes | `semester Int` (1225). |
| H. `level` field? | ✅ Yes | `level Int` (1226). |
| I. `programmeId` / programme relationship? | ✅ Yes (optional) | `programmeId String?` + `programme Programme? @relation(fields: [programmeId], references: [id], onDelete: SetNull)` (1222–1223). |
| J. ACTIVE/INACTIVE status? | ✅ Yes | `status String @default("ACTIVE") // ACTIVE | INACTIVE` (1227). |
| K. Uniqueness against duplicates? | ✅ (with caveat) | `@@unique([courseId, programmeId, academicSession, semester, level])` (1233). ⚠️ `programmeId` is nullable; in Postgres NULLs are distinct in a unique index, so duplicate offerings with `programmeId = NULL` are **not** blocked by the constraint. |
| L. `CourseAssignment` is lecturer/workload allocation? | ✅ Yes | `lecturerId` → `User` (Restrict), `assignedById` → `User`, `teamMembers CourseAssignmentMember[]`, `@@unique([courseCode, academicSession, semester])`. No student/eligibility content. |

`CourseAssignment` full field set (999): `courseId String?` (→ Course, SetNull), `courseCode String`, `courseTitle String`, `faculty String?`, `department String`, `lecturerId`, `assignedById`, `academicSession String`, `semester Int`, `createdAt`, `teamMembers`, indexes on `courseCode`, `lecturerId`, `(department, academicSession)`, unique `(courseCode, academicSession, semester)`.

`CourseAssignmentMember` (1022): `courseAssignmentId` (Cascade), `lecturerId` (Restrict), unique `(courseAssignmentId, lecturerId)` — teaching team, not student eligibility.

---

## H. Chronological migration table

15 migration folders, in the order they were created (newest last). D-column evidence is in §D.

| # | Migration | Purpose | Applies to |
|---|---|---|---|
| 1 | `20260809000000_init_postgres` | Initial build: User, Session, AuditLog, FeatureFlag, AcademicCalendarEntry, Programme, Application, DocumentUpload, AdmissionOffer, FeeAccount, Invoice, Payment, Scholarship, Waiver, PaymentPlan, **Course, CourseRegistration, Result**, MisconductCase, Appeal, hostels, transcripts, LMS, staff, clearance, convocation, alumni, library, PG, SIWES, NYSC, venues, comms, compliance | ✅ present |
| 2 | `20260809022915_email_verification` | EmailVerificationToken | ✅ |
| 3 | `20260809040000_course_assignment` | CourseAssignment + User.department | ✅ |
| 4 | `20260809050000_appointments` | Appointment | ✅ |
| 5 | `20260809115509_add_student_category` | User.studentCategory | ✅ |
| 6 | `20260811000000_lecturer_results` | ResultFile, ResultCorrectionRequest | ✅ |
| 7 | `20260811010000_add_user_faculty` | User.faculty | ✅ |
| 8 | `20260811194705_add_level_coordinator` | LevelCoordinator | ✅ |
| 9 | `20260811210254_course_assignment_members` | CourseAssignmentMember (teaching teams) | ✅ |
| 10 | `20260811233845_add_level_advisor_assignments` | LevelAdvisorAssignment | ✅ |
| 11 | `20260812080740_add_student_bio` | User.sex, User.dateOfBirth | ✅ |
| 12 | `20260813032648_add_announcement_faculty` | Announcement.faculty | ✅ |
| 13 | `20260813035219_add_senate_business_models` | SenateMatter, SenateDecision, SenateAgenda | ✅ |
| 14 | `20260813045130_add_committee_membership` | CommitteeMembership | ✅ |
| 15 | `20260814000000_add_course_offering` | **CourseOffering** + FK to Course/Programme + unique index (verified in SQL, 29 lines) | ✅ |

Evidence that the recent development work survived the rollback:

- **CourseOffering** — ✅ final migration `20260814000000_add_course_offering` (folder + SQL confirmed).
- **Student registration changes** — ✅ `CourseRegistration` was part of `init_postgres` and intact; no later migration touched it.
- **CourseAssignment changes** — ✅ `CourseAssignment` (3) + `CourseAssignmentMember` (9) both present.
- **Fees changes** — ✅ Fees models originate in `init_postgres`; no later fee migration. Present and intact.
- **Clearance changes** — ✅ `ClearanceRequest` originates in `init_postgres`; intact.
- **Role/RBAC database changes** — ✅ No migration ever introduced a Role table/enum (roles are strings); `Appointment` (4) and `CommitteeMembership` (14) are the only role-adjacent DB structures and both exist.

> Caveat: folder presence is confirmed, but **whether each migration was applied to the live database was not verified** (read-only). A `prisma migrate status` would confirm application state — deliberately not run. ⚪

---

## I. Recovery status table

Legend: 🟢 PRESENT / 🟡 PARTIAL / 🔴 MISSING / ⚪ UNVERIFIED

| Component | Status | Evidence |
|---|---|---|
| Course catalogue | 🟢 | `Course` (code unique, units, level, semester, capacity, prerequisites) |
| CourseOffering (schema + migration) | 🟢 | Model 1218 + migration 15; unique index; FK to Course/Programme |
| CourseOffering (application) | 🔴 | No create action (form is a simulation), empty `where` on list, broken duplicate check, missing `[id]/detail` route, `HOD` vs `HOD_DEAN` guard mismatch |
| CourseAssignment (workload) | 🟢 | Lecturer allocation model + members, separate from offerings |
| Course Registration schema | 🟡 | `CourseRegistration` (session/semester/status/multiple/history) but **no reference, no lock, no Offering link, no units** |
| Course Registration application | 🟡 | `registerCourse` covers auth/course/fee/capacity/prereqs; **no offering/programme/level/window/15-unit enforcement**; P2002 latent bug on DROPPED/WITHDRAWN rows |
| 15-unit rule | 🔴 | No schema rule; server does not enforce; client-side only (`CourseRegistrationForm`) |
| Results | 🟢 | `Result` + session/semester/status/2 approvers + ResultFile/corrections |
| Fees | 🟡 | Invoice/FeeAccount/Scholarship/Waiver/PaymentPlan; no `Fee` model, no per-session schedule |
| Payments | 🟢 | `Payment` (reference unique, channels, TSA sweep flag, RECONCILED status) |
| Financial Clearance | 🟡 | `FeeAccount.clearanceStatus` Boolean + BURSARY clearance item |
| Academic Clearance | 🟡 | Only via `EXAMS` clearance item; no explicit flag |
| Graduation / Clearance | 🟢 | `ClearanceRequest` (GRADUATION/WITHDRAWAL/SIWES) + items + approval log; Convocation; GraduationRecord |
| Audit | 🟢 | `AuditLog` hash-chained (prevHash/hash), append-only by convention |
| Academic Session | 🟡 | No `AcademicSession` table; free-form strings across ~10 models; `CURRENT_SESSION` in app code |
| Core User / Staff | 🟡 | `User` present; staff = User+staffNo; **no Staff model / roster data** |
| Student data | 🟡 | `User` + registrationNo/studentCategory; no Student model / bulk data |
| Faculty / Department / Programme | 🟡 | Programme model ✅; faculty/department are free-form snapshot strings, no reference tables |
| RBAC-related DB structures | 🟢 | Roles are strings on User; Appointment + CommitteeMembership exist; no Role table by design |
| Live DB application state | ⚪ | `prisma migrate status` not run (read-only) |

---

## J. Critical conclusions (9 questions)

1. **Is the CourseOffering architecture still present?** — **Yes.** The `CourseOffering` model (`courseId`, `programmeId?`, `academicSession`, `semester`, `level`, `status ACTIVE|INACTIVE`, unique index) and migration `20260814000000_add_course_offering` both survived the rollback. What is missing is **application** wiring (create action, department-scoped list, offering detail route, registration eligibility), not schema.

2. **Is CourseAssignment still separate from CourseOffering?** — **Yes.** Two independent models. `CourseAssignment` remains a pure lecturer/workload-allocation model with no student-eligibility content.

3. **Can the current schema support the intended Student Course Registration architecture?** — **Partially.** It supports session- and semester-specific registration, statuses, multiple courses, and historical rows. It **cannot** express: a registration reference, registration locking/finalisation, a link from a registration to a specific CourseOffering, or stored credit totals. The 15-unit rule has no schema backing.

4. **Is there evidence that recent Student Registration database work was lost?** — **No schema-level loss.** `CourseRegistration` is intact from `init_postgres` with a sound unique key. Any recent registration *enhancements* (reference, lock, offering-eligibility) would have been application-level and are absent — but there is no missing registration migration.

5. **Is there evidence that recent HOD Course Offering work was lost?** — **No schema-level loss.** The offering table is the newest migration and is fully present. Lost work is confined to app code (no create-offering action; unscoped list; broken duplicate check; missing detail route).

6. **Are the financial models needed for the future Bursary workspace already present?** — **Mostly yes.** Invoice, Payment, Waiver, Scholarship, PaymentPlan, FeeAccount and Programme.tuitionCents cover the core. Gaps are additive, not blocking: no explicit `Fee`/`Charge` model, no per-session fee schedules, no Refund/Credit structure.

7. **Are migrations missing that appear necessary for functionality previously known to exist?** — **No missing migration is evident.** All 15 folders are present, the latest being the CourseOffering one, and the schema is internally consistent (`tsc`/build pass). The known gaps (offering creation, registration lock/reference, fee schedules, refunds) never had migrations in this restore window. Live-DB application state is ⚪ unverified (`prisma migrate status` not run, read-only).

8. **Is the database safe to continue development on?** — **Yes at the schema level.** The schema compiles, `next build` succeeds, and `tsc`/lint/vitest all pass. Two caveats before *implementation* resumes: (a) confirm the live database is actually migrated to `20260814000000` via `prisma migrate status`; (b) fix the app-level role/guard mismatches (HOD/DEAN/SBC/DVC demo access) identified in `docs/RECOVERY_AUDIT.md` — those are code issues, not schema issues.

9. **Single most important recovery action + what MUST NOT be done yet.**
   - **Most important next action (still read-only / planning):** rebuild the **application** layer for offerings first — a real `createOffering` server action (with server-side duplicate/semester/programme/level validation), a department-scoped list query, the missing `[id]/detail` route, and wiring `registerCourse` to require an **ACTIVE** offering matching `User.programmeId` + student level + `CURRENT_SESSION`/semester. The schema already supports all of this; no migration is required for the offering-eligibility gap.
   - **Actions that MUST NOT be taken yet (until the audit is reviewed and recovery is authorised):** do **not** run `prisma migrate status`/`db migrate`/`db push`/`db reset`/`db seed`; do **not** add new migration(s) (e.g. for registration reference/lock) before confirming the live DB is migrated to head and the app gaps are agreed; do **not** change roles/RBAC in the DB; do **not** import staff/student datasets into any live table without a plan; do **not** touch Google Sheets or seed data.

---

## K. Database safety confirmation

During this audit:

- ✅ No migration executed (`prisma migrate`/`db push`/`db reset` not run).
- ✅ No database reset executed.
- ✅ No seed executed.
- ✅ No database records changed (no Prisma client write used).
- ✅ No staff records changed.
- ✅ No student records changed.
- ✅ No Google Sheets modified.
- ✅ No RBAC / schema / application code modified.
- The only write was this document (`docs/DATABASE_RECOVERY_AUDIT.md`). (Earlier today `npm run build` wrote `.next` build artifacts only.)

---

## Appendix: additional architectural findings retained from prior audit

### Student registration details
Model **`CourseRegistration`** (366): `id`, `userId` → `User`, `courseId` → `Course`, `academicSession String`, `semester Int`, `status String @default("ACTIVE")` (`ACTIVE | DROPPED | WITHDRAWN | WAITLISTED`), `lmsSynced Boolean @default(false)`, `createdAt`, `@@unique([userId, courseId, academicSession, semester])`. **No registration reference; no lock/finalise/confirmed field; no units; no relation to CourseOffering.** Registration is Course-level, not Offering-level. Rows are retained per session (history preserved).

### 15-credit-unit requirement
- **Database support:** only `Course.units Int` (353). No `units`/`credits`/`totalUnits` on `CourseRegistration`; no schema-level rule/trigger/constraint.
- **Application-level:** the 15-unit minimum exists today **only** in client-side React (`CourseRegistrationForm` computes `canSubmit = totalUnits >= 15`) and is not enforced by `registerCourse` in `module-actions.ts`.

### Academic session / semester / level / programme / department / faculty fields
| Model | Field | Type | Notes |
|---|---|---|---|
| CourseRegistration | `academicSession` | String | free-form, e.g. "2025/2026" |
| CourseRegistration | `semester` | Int | 1 or 2 (0 = backlog by convention) |
| Course | `semester` / `level` | Int | course default semester; level 100–800 |
| Course | `programme` | — | no programme field on Course |
| CourseOffering | `academicSession` / `semester` / `level` | String / Int / Int | |
| CourseOffering | `programmeId` | String? → Programme | nullable |
| CourseAssignment | `academicSession` / `semester` / `department` / `faculty` | … | snapshot strings |
| LevelCoordinator | `academicSession` / `level` / `department` | … | unique (level, department, session) |
| LevelAdvisorAssignment | `academicSession` / `level` / `department` / `programmeId` | … | unique (department, session, level, programmeId) |
| User | `department` / `faculty` / `studentCategory` / `programmeId` | String? / String? / String? / String? → Programme | snapshots |
| AcademicCalendarEntry | `entryType` | String | `SESSION | REGISTRATION | FEE_DEADLINE | EXAM | HOLIDAY | CONVOCATION | NYSC | RESULT` — not a session table |

There is **no `AcademicSession` table**; `academicSession`/`session` values are plain strings duplicated across ~10 models. `CURRENT_SESSION = "2025/2026"` lives in app code.

### Fees and payments
| Model | Purpose | Relates to |
|---|---|---|
| FeeAccount | per-user account: `balanceCents Int @default(0)`, `clearanceStatus Boolean @default(false)` ("fee clearance blocks registration & exams") | `User` (1:1) |
| Invoice | `module` (`TUITION | ACCEPTANCE | HOSTEL | TRANSCRIPT | CONVOCATION | SIWES | LIBRARY`), `amountCents`, `dueOn`, `status` (`OPEN | PAID | OVERDUE | WAIVED | PARTIAL`) | `User`; `Payment[]`, `PaymentPlan?`, `Waiver?` |
| Payment | `reference @unique`, `channel` (`CARD | TRANSFER | MOBILE_MONEY | USSD | REMITA`), `status` (`PENDING | SUCCESS | FAILED | RECONCILED`), `tsaSwept` | `User`; optional `Invoice` |
| Waiver / Scholarship / PaymentPlan | fee concessions | `User` + approvers |
| Programme | `tuitionCents Int`, `durationYears`, `capacity` | `User` via `programmeId` |

Missing: no `Fee`/`Charge` model; no `Refund`/`Credit`; no per-session fee schedule (`Invoice` has no `academicSession`); financial clearance is a single Boolean.

### Clearance
`ClearanceRequest` (`clearanceType GRADUATION | WITHDRAWAL | SIWES`, status `IN_PROGRESS | COMPLETED | HOLD`) → `ClearanceItem` (`department BURSARY | LIBRARY | HOSTEL | SPORTS | EXAMS | SIWES`, status `PENDING | SIGNED_OFF`) → `ClearanceItemApprovalLog` (approval trail). Financial ✅ BURSARY item + FeeAccount.clearanceStatus; Library ✅; Graduation ✅; academic ⚠️ only via EXAMS item.

### Results
`Result` (380): `userId` → User, `courseId` → Course, `academicSession`, `semester`, `caScore?/examScore?/total?/grade?`, `gradeStatus` (`SUBMITTED | HOD_APPROVED | SENATE_APPROVED | FINAL`; app also stores `DEAN_APPROVED` — plain String, fine), `submittedById`, `approvedBy1Id`, `approvedBy2Id`, `approvedAt1/2`, `published`, `resultKind NORMAL | BACKLOG`, `misconductRef?`, unique `(userId, courseId, academicSession, semester)`. **No relation to CourseAssignment.** `ResultFile` (CSV batch) + `ResultCorrectionRequest` exist.

### Staff and role architecture
- Roles are **plain strings** on `User.role` (24), comment "one of Role enum values in constants.ts". **No `Role` model, no Prisma enum, no role relationship table.**
- Students = `registrationNo` + `studentCategory`; staff = `staffNo`; no Staff/Student tables.
- Role values in app code/seed: `APPLICANT`, `STUDENT`, `LECTURER`, `HOD_DEAN`, `REGISTRY`, `BURSARY`, `STUDENT_AFFAIRS`, `EXAMS_RECORDS`, `PG_SCHOOL`, `SIWES`, `TIMETABLE`, `IT_ADMIN`, `DVC_OVERSIGHT`, `VC`, `VERIFIER`; guards/landing also use `HOD`, `DEAN`, `SBC_CHAIRMAN`, `GOVERNANCE_OVERSIGHT_MEMBER` (guard/matrix mismatch is app code — see `docs/RECOVERY_AUDIT.md`).
- Governance-adjacent schema: `Appointment.role` (comment `HOD | DEAN | DIRECTOR_ACADEMIC_PLANNING …`) and `CommitteeMembership` (`committee`, `designation CHAIRMAN | MEMBER`, `status ACTIVE|INACTIVE`, unique `(committee, userId)`).

### Audit architecture
`AuditLog` (159): denormalized `actorUserId/actorUsername` (no FK, survives user deletion), `action/module/target`, `before/after Json`, `prevHash String?` + `hash String @unique` (SHA-256 chain, `GENESIS` root; verified by `verifyChain()` in `src/lib/audit.ts`), append-only by application convention (no DB trigger).

---

*This audit is read-only and complete. No recovery or implementation work was performed, per instructions.*
