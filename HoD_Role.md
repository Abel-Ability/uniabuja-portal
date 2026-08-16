# Head of Department (HoD) — Account & Role Guide

**Portal:** University of Abuja Student & Staff Portal
**Role key:** `HOD` (label: "Head of Department")
**Landing page:** `/portal/hod` — "HoD Dashboard"
**Results surface:** `/portal/hod/approvals`
**Scope:** a single academic department within one faculty (both are derived from the authenticated session)

This document is a complete walkthrough of the HoD account: how you get in, what
you can see, what you can do, the boundaries enforced on you, and how your work
fits into the university's academic workflow.

---

## 1. Role Overview

The Head of Department runs the **academic business of a department**:

- **Offering** courses — deciding which courses run for which programme and
  level in a given session and semester.
- **Allocating** each course to a main lecturer, plus any co-lecturers.
- **Signing off** the results that lecturers post (grade approval).
- **Coordinating the department** — assigning level coordinators and level
  advisers, and viewing the student and staff registers.

The HoD is a **department-scoped role**. Every action is limited to the
department recorded on the HoD's own account — a HoD can never act on (or even
see) another department's records. Where a department spans a faculty, the
HoD's faculty is also enforced (e.g. when matching the master course catalogue).

The HoD is **not** a results *entry* role, and has **no authority** over
faculty-level or Senate-level approval. The results pipeline is:

```
SUBMITTED  →  HOD_APPROVED  →  SENATE_APPROVED  →  FINAL
  (lecturer)     (HoD)          (Exams & Records / Senate)   (Exams & Records)
```

The HoD performs exactly one write in that pipeline: **`SUBMITTED →
HOD_APPROVED`**.

---

## 2. Access & Entry Points

### 2.1 Sign-in landing

After login, an HoD is taken to `/portal/hod` (Department Overview). The route
map in `landingForRole("HOD")` guarantees this, and `isHodRole()` gates every
HoD page server-side: any non-HoD user who hand-types an `/portal/hod/…` URL is
redirected to their own landing page.

### 2.2 Sidebar

The HoD sidebar is the `HOD_MENU` catalogue:

| Sidebar entry | Route | Purpose |
|---|---|---|
| HoD Dashboard | `/portal/hod` | Department overview, stats, quick actions |
| Students | `/portal/hod/students` | Departmental student register + analytics |
| Staff | `/portal/hod/staff` | Academic staff in the department |
| Approvals | `/portal/hod/approvals` | Sign off submitted results |
| Course Allocation | `/portal/hod/course-allocation` | Assign courses to lecturers |
| Course Offerings | `/portal/hod/course-offerings` | Define which courses are offered |
| Level Advisers | `/portal/hod/level-advisers` | Assign/manage level advisers |
| Level Coordinators | `/portal/hod/level-coordinators` | Assign/manage level coordinators |

The dashboard entry is deduplicated with the menu start, so the sidebar shows
each destination once.

### 2.3 Results routing

The generic "Results" module (`/portal/results`) is **not** the HoD's home for
results work. The shared results page recognises the HoD role and redirects all
results work to the department's own queue:

- **`resultsForRole("HOD")` → `/portal/hod/approvals`** — the dedicated HoD
  approvals surface.
- When an HoD does land on `/portal/results`, the page renders the
  **HoD-specific branch**: a *department-scoped* pending pipeline (only
  `SUBMITTED` results for courses allocated to the HoD's department) and a
  *department-scoped* appeal queue (only appeals filed by the HoD's own
  students). The full pipeline and the full appeal register belong to
  Exams & Records.

### 2.4 Guarding

Every HoD page (and the shared results HoD branch, the CSV export route, and
every HoD server action) enforces:

1. A valid session, else redirect to `/login`.
2. `isHodRole(role)` (role string `HOD`), else redirect to
   `landingForRole(role)`.
3. A **session-derived** `faculty`/`department` — never trusted from the client
   or the URL.
4. Sensitive write actions additionally require a **step-up confirmation**
   (`stepUpGuard`).

---

## 3. Permission Matrix

The HoD's module rights come from the access-control matrix (`ACCESS_CONTROL_MATRIX`
in `src/lib/constants.ts`). Actions are resolved via `can(role, module, action)`
where actions are Read `R`, Write `W`, Add/Approve `A`, Submit `S`.

| Module | HoD rights | Meaning for the HoD |
|---|---|---|
| `EXAMS_RECORDS` | `A` | **Approve** results, appeals, misconduct cases and clearance items (not read-edit, not finalise) |
| `GRAD_CLEARANCE` | `A` | Sign off the **EXAMS** clearance item in graduation clearance |
| `ADMISSIONS` | `R` | Read admissions data |
| `ACCOMMODATION` | `R` | Read hostel/accommodation data |
| `LMS` | `R` | Read LMS content |
| `PROFILES` | `RW` | Manage staff & research profiles |
| `PG_RESEARCH` | `R` | Read postgraduate research records |
| `SIWES` | `R` | Read SIWES records |
| `TIMETABLE_VENUE` | `R` | Read timetables/venues |
| `LIBRARY` | `R` | Read library records |
| `COMMUNICATIONS` | `RW` | **Post and view** announcements |

Key restrictions (verified by tests in `constants.test.ts`):

- `can("HOD", "EXAMS_RECORDS", "R")` → **false** — the HoD does not read-edit
  results; it only approves them.
- `can("HOD", "FEES", "R")` → **false** — no fee data.
- `can("HOD", "ADMIN_SYSTEM", "R")` → **false** — no system administration.

---

## 4. Departmental Scope Model

The HoD's world is defined by **session-derived identity**, the **course
catalogue** and **allocation records**:

| Boundary | Derived from | Used for |
|---|---|---|
| `faculty` + `department` | HoD session | All queries and scope checks |
| Department courses | Master catalogue `Courses_UG` (faculty + hosting department) | Course Offerings, Course Allocation |
| Department course codes | `CourseAssignment` rows for the department (`departmentCourseCodes`) | Results queues, files, approvals |
| Department programmes | Students currently in the department (`departmentProgrammeIds`) | Offering programme picker |
| Department students/staff | User records with `department` = HoD department | Registers, staff list, appeals |

Every HoD page re-derives these boundaries on each request. A hand-edited URL
(e.g. `/portal/hod/students/<id>` or `/portal/hod/course-offerings/<id>`) is
still checked against the department before anything is rendered — an
out-of-scope record returns 404/redirect, never data.

---

## 5. The HoD Workspace Pages

### 5.1 Department Overview — `/portal/hod`

The dashboard shows:

- **Stat cards:** department students (undergraduate), lecturers, pending
  approvals, all-time course assignments.
- **Department academic overview** (current session/semester): active
  registrations, results entered, pipeline completion (`finalised/total`), pass
  rate (grade ≥ 40), and the four stage counts (`SUBMITTED`, `HOD_APPROVED`,
  `SENATE_APPROVED`, `FINAL`). This is the same stage-consistent aggregation
  used by the faculty and university views.
- **Pending results:** the latest `SUBMITTED` results for department courses,
  each with an **Approve (HoD)** button.
- **Recent result files:** the latest CSV uploads (`ResultFile` rows) for
  department courses, with lecturer, status and processed-row count.
- **Quick actions:** the full HoD menu as clickable cards.

### 5.2 Students — `/portal/hod/students`

A full departmental student dashboard + register, always limited to the HoD's
department:

- **Context cards:** department, faculty, current session, number of
  programmes, last-refresh time.
- **Key statistics** (whole-department, per selected session): total, active,
  male/female, undergraduate/postgraduate, average age (min sample size
  enforced). Clicking most cards filters the register below.
- **Students by level** bar chart (level derived from the registration number's
  admission year); click a level to filter.
- **Level coordination & advising:** who coordinates and advises each level this
  session, with a shortcut to manage coordinators.
- **Analytics:** sex, age bracket, academic session, programme, category and
  status distributions; cross-tabs (Programme × Level, Level × Sex, Level ×
  Status); age statistics (mean/median/min/max); demographic indicators. Every
  chart reflects the current filters and recomputes together.
- **Filters:** session, level, programme, category, sex, status, age bracket,
  search (name or matric number). Persisted in the query string.
- **Student register:** paginated table (registration number, name, programme,
  level, admission session, status, level adviser) with a **View** link per
  student.
- **Export CSV:** downloads the *exactly filtered* register as CSV. The export
  route re-checks the HoD role and department server-side and writes an
  `EXPORT` audit entry; the department always comes from the session, so a
  hand-edited query string cannot widen the scope.
- **Data quality:** counts of missing DOB/sex/programme/level/category/status
  and duplicate registration numbers (records are never changed automatically).

**Student detail — `/portal/hod/students/[id]`:** a read-only record (identity,
academic, and advising: level coordinator + adviser). No editing privileges.
The department is part of the query, so a hand-edited URL cannot surface a
student from another department.

### 5.3 Staff — `/portal/hod/staff`

Departmental academic staff register (lecturers only, this department):

- **Stat cards:** total staff, active staff, staff with public profiles,
  current-session courses assigned.
- **Staff list:** staff number, name, designation, contact, status, current
  roles (e.g. "200 Level Coordinator", "Programme · 300 Level Adviser"),
  current-session course load, last login.

### 5.4 Approvals — `/portal/hod/approvals`

The HoD's **dedicated results surface**:

- **Stats:** awaiting approval, recently approved (HoD), result files,
  department/faculty.
- **Pending approvals:** `SUBMITTED` results for department courses, filtered
  to undergraduate students, newest first (up to 50), each with an
  **Approve (HoD)** button.
- **Recently signed off:** the latest `HOD_APPROVED` rows.
- **Recent result files:** uploads for department courses.

Approving a result moves it `SUBMITTED → HOD_APPROVED`, stamps
`approvedBy1Id`/`approvedAt1`, and writes an `APPROVE` audit entry. The action
`approveResult` re-checks department scope server-side (`departmentCourseCodes`)
and only approves rows currently at `SUBMITTED` — anything else is rejected with
"Not ready for your approval".

### 5.5 Course Allocation — `/portal/hod/course-allocation`

Assign courses to lecturers for a session and semester:

- **Course list** comes from the department's share of the `Courses_UG`
  catalogue (faculty + hosting department + semester), never hand-typed.
- **Lecturers** are only lecturers of this department.
- **Main lecturer:** required; must be a `LECTURER` in this department.
- **Co-lecturers:** optional, any number; must be distinct, must be lecturers in
  this department, and cannot be the main lecturer.
- **Duplicate prevention:** one allocation per course + session + semester
  (upsert on the unique key), so re-allocating replaces the previous assignment
  rather than creating a duplicate.
- **Team management:** the current allocations list supports **adding a
  co-lecturer**, **removing a co-lecturer**, and **unassigning** a course
  (department-scoped). Every change writes an audit entry.

Allocation is a *teaching* decision. It does **not** make a course registrable —
that is Course Offerings' job. Conversely, offering a course does not assign
lecturers.

### 5.6 Course Offerings — `/portal/hod/course-offerings`

A course offering defines **which programme, level, session and semester** a
course from the departmental catalogue is available to students:

- **Create a course offering:** pick a course (only the HoD department's
  catalogue), an optional programme (only the department's programmes), a level
  (only the department's valid levels), a session (from the official session
  list), the semester (must match the course's designated semester), and a
  status (`ACTIVE` or `INACTIVE`).
- **Offerings table:** course code/title/units, programme, level, session,
  semester, status, with per-row actions to **activate/deactivate**.
- **Offering detail (`/portal/hod/course-offerings/[id]`):** course and offering
  information with a status toggle. The offering's course must belong to the
  HoD's faculty/department or the page 404s.

Rules enforced server-side (`createCourseOffering` / `setCourseOfferingStatus`):

- Only HoDs can create/manage offerings (plus step-up confirmation).
- The course must exist in the DB **and** in the HoD's catalogue entry
  (`courseInDepartmentCatalogue`).
- **Duplicate prevention:** no two offerings for the same course + programme +
  session + semester + level (pre-check + database unique-constraint guard).
- Only `ACTIVE` offerings make a course eligible for student registration;
  `INACTIVE` pauses new registrations while keeping history. Deactivating an
  offering never affects a lecturer's course assignment.

### 5.7 Level Advisers — `/portal/hod/level-advisers`

Assign a lecturer as the level adviser for each level of the department (100 →
max level), for a session and optionally a single programme:

- Re-assigning a scope re-activates/replaces the existing assignment and keeps
  history (previous assignments remain on record).
- **Deactivate** ends the current adviser (stamped with an end date).
- Only HoDs can assign/deactivate, and only within their own department.

### 5.8 Level Coordinators — `/portal/hod/level-coordinators`

Assign one lecturer to coordinate each level of the department for a session:

- One coordinator per level + department + session (upsert on the unique key —
  re-assigning a level replaces its current coordinator).
- **Unassign** removes the coordinator (department-scoped, audited).

---

## 6. Server Actions Available to the HoD

Every action below is a server action that re-validates role, department and
stage before any write, and records a hash-chained audit entry:

| Action | Purpose | Key guards |
|---|---|---|
| `approveResult` | `SUBMITTED → HOD_APPROVED` | HoD-only via `can("EXAMS_RECORDS","A")`; dept scope; stage check; step-up |
| `createCourseOffering` | Create an offering | HoD-only; catalogue membership; validation; duplicate guard |
| `setCourseOfferingStatus` | Activate/deactivate an offering | HoD-only; status whitelist |
| `assignCourse` | Allocate a course (main + co) | HoD-only; dept scope; lecturer role/dept |
| `unassignCourse` | Remove an allocation | HoD-only; dept scope |
| `addCourseTeamLecturer` | Add a co-lecturer | HoD-only; dept scope; distinct |
| `removeCourseTeamLecturer` | Remove a co-lecturer | HoD-only; dept scope |
| `assignLevelAdviser` / `deactivateLevelAdviser` | Manage level advisers | HoD-only; dept scope |
| `assignLevelCoordinator` / `unassignLevelCoordinator` | Manage level coordinators | HoD-only; dept scope |
| `reviewAppeal` | Review an appeal | `EXAMS_RECORDS` A; **dept-scoped to own students**; step-up |
| `logMisconductCase` / `advanceMisconductCase` | Log/advance misconduct cases | HoD permitted; step-up on advance |
| `signOffClearance` | Sign off the **EXAMS** clearance item | HoD maps to `EXAMS` clearance department; step-up |
| (Communications) | Post announcements | `COMMUNICATIONS` RW via `can()` |

What the HoD **cannot** do (enforced server-side, covered by tests):

- Enter or edit grades on any course (`submitGrade` is LECTURER/EXAMS_RECORDS).
- Approve results for other departments or at the wrong stage.
- Finalise results — that is Exams & Records only (`finaliseResult`).
- Read-edit results (`EXAMS_RECORDS R` is false), touch fees, or administer the
  system.

---

## 7. The HoD in the Results Pipeline

```
Lecturer (main/co)          HoD                      Exams & Records        Exams & Records
posts grades (CSV/row)  ──▶ SUBMITTED ──▶ approve ──▶ HOD_APPROVED ──▶ SENATE_APPROVED ──▶ FINAL
                              ▲             (dept-scoped, step-up)
```

- The HoD only sees `SUBMITTED` results for courses **allocated to their
  department**.
- Approval is one-click and audited; the result becomes `HOD_APPROVED` and is
  queued for the Exams & Records unit to record Senate approval, then finalise.
- The HoD's pending queue and the shared `/portal/results` pipeline use the same
  departmental boundary (`departmentCourseCodes`), so the two views always agree
  (verified by TESTS 1, 5, 7 in `executive-recovery.test.ts` and the
  academic-workflow suite).

---

## 8. Oversight & Auxiliary Surfaces

- **Appeals:** the HoD reviews grade and misconduct appeals **filed by students
  of their own department** (`hodScopedAppeals` + `reviewAppeal` dept check).
- **Misconduct:** HoDs may log and advance misconduct cases (step-up on advance).
- **Clearance:** the HoD signs off the **EXAMS** item of graduation clearance
  (`signOffClearance`, `CLEARANCE_DEPTS.HOD = "EXAMS"`).
- **Communications:** the HoD can post and view announcements (module `RW`).
- **Profiles:** department staff and research profiles (module `RW`).

---

## 9. Security & Integrity Controls

- **Server-side authorization is authoritative.** Faculty, department, course
  code, programme and student identity are always derived from the session, the
  database, or the master catalogue — never from hidden form fields, query
  strings or hand-edited URLs.
- **Every write is audited** through the hash-chained `audit()`/`writeAudit`
  pipeline (module `EXAMS_RECORDS`, `GRAD_CLEARANCE`, `COMMUNICATIONS` etc.), so
  the chain can be verified end to end.
- **Step-up confirmation** (`stepUpGuard`) protects destructive or
  high-impact actions (approvals, assignment changes, clearance sign-off,
  misconduct advance).
- **Department isolation** is enforced at the query level *and* re-checked in
  each action: cross-department approvals, appeals, offerings, allocations and
  student views are all rejected.
- **No `DEAN_APPROVED` / `HOD_DEAN`:** the pipeline is exactly
  `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`, and the Dean has no
  approval authority at all (return-only).

---

## 10. Help & Guide

The portal's **Help & Guide** page provides HoD-specific guidance covering
course offerings, allocation, level advisers/coordinators, approvals, and the
dashboard; the "start here" workflow is:

1. Confirm the courses offered this session (Course Offerings).
2. Allocate each course to a main lecturer and co-lecturers (Course Allocation).
3. Set level advisers and coordinators early in the session.
4. Clear the pending approvals shown on the dashboard.

The help content mirrors the sidebar exactly, never mentions other roles'
capabilities, and is only ever rendered for the HoD's own session role.

---

## 11. Test Coverage

The HoD surface is covered by live integration tests:

| Suite | What it proves |
|---|---|
| `executive-recovery.test.ts` | HoD approves own-department results; cross-department approval rejected with no mutation/no audit; pending pipeline lists only own-department rows; stage transitions intact; appeals scoped to own students |
| `academic-workflow.test.ts` | Allocation scoping/guards (TESTS 1–6, 39); registration eligibility (7–15); lecturer submission (16–20, 41); HoD approval (22–25, 42, 63, 66); offerings scoped + duplicate-guarded (60); aggregation (65) |
| `constants.test.ts` | Matrix: HoD approves but does not read-edit results; no fees; no admin |
| `hod.test.ts` | `isHodRole` true only for `HOD` |
| `navigation-help.test.ts` | HoD lands on `/portal/hod`, results route to `/portal/hod/approvals`, help covers HoD |

---

## 12. Quick Reference

- **Login →** `/portal/hod`
- **Sidebar:** Dashboard, Students, Staff, Approvals, Course Allocation, Course
  Offerings, Level Advisers, Level Coordinators
- **Results:** Approvals (and the HoD branch of `/portal/results`)
- **Core write:**
  `approveResult` (`SUBMITTED → HOD_APPROVED`), offerings, allocations, level
  advisers/coordinators, appeals, misconduct, EXAMS clearance, announcements
- **Cannot:** enter/edit grades, finalise results, act outside the department,
  touch fees or admin
- **Guards:** session + `isHodRole` + session-derived faculty/department +
  step-up on sensitive writes
- **Every action audited;** pipeline frozen at
  `SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL`
