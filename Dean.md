# Dean of Faculty — Account & Role Guide

**Portal:** University of Abuja Student & Staff Portal
**Role key:** `DEAN` (label: "Dean of Faculty")
**Landing page:** `/portal/dean` — "Dean Dashboard / Faculty Overview"
**Results surface:** `/portal/dean/results`
**Scope:** one faculty (derived from the authenticated session; all faculty-wide data is computed from the staff roster of that faculty)

This document is a complete walkthrough of the Dean account: how the role is
modelled, what the dashboard shows, what the Dean can and cannot do, the
boundaries enforced in code, and how the role fits into the university's
academic workflow.

---

## 1. Role Overview

The Dean is the **faculty-level oversight role**. Where the HoD runs the
academic business of a single department, the Dean watches the same business
**across every department in a faculty** — but almost entirely in read-only
mode. The Dean monitors pipelines (results, admissions, graduation clearance,
postgraduate research), compares departments against each other, communicates
with the faculty, and intervenes in exactly one place: returning a faulty
HoD-approved result to the department.

The role is deliberately **not** an approval role. The results pipeline is:

```
SUBMITTED  →  HOD_APPROVED  →  SENATE_APPROVED  →  FINAL
 (lecturer)      (HoD)          (Exams & Records / Senate)   (Exams & Records)
```

The Dean has **no state to approve** in that pipeline. The single Dean write
action against results is `returnResult`, a bespoke, role-gated server action
(`src/lib/module-actions.ts`) that moves an `HOD_APPROVED` result **backwards**
to `SUBMITTED` with a mandatory reason, so the department can correct it before
Senate finalisation.

The design intent is stated in the RBAC source itself
(`src/lib/constants.ts`):

> The Dean is a read-only oversight role over faculty-facing modules plus
> communications. The Dean has no approval action in the results pipeline …
> the only Dean write action is returnResult.

### Responsibilities in practice

- **Monitor the faculty results pipeline** — see what is awaiting HoD approval,
  what is HoD-approved and awaiting Senate, what has been published, and which
  CSV result files failed to parse.
- **Return defective results** — send an HoD-approved result back to the
  department with a documented reason (audited).
- **Oversee the student register** — view, filter and export the faculty's
  students, and open individual student profiles.
- **Review academic staff** — the lecturers across all departments in the
  faculty.
- **Monitor admissions, graduation/clearance and postgraduate activity** for
  the faculty, read-only.
- **Communicate** — publish faculty-scoped announcements (news, notices,
  deadlines) to students, staff or specific roles within the faculty.

---

## 2. RBAC Model

### Module permissions (`src/lib/constants.ts`)

```
DEAN: {
  ADMISSIONS:      P("R"),   // monitor admissions into the faculty
  EXAMS_RECORDS:   P("R"),   // read-only view of results
  PROFILES:        P("R"),   // view student/staff profiles
  GRAD_CLEARANCE:  P("R"),   // monitor graduation clearance
  PG_RESEARCH:     P("R"),   // monitor PG programmes & supervision
  COMMUNICATIONS:  P("RW"),  // publish faculty announcements
}
```

`R` = read, `W` = write, `A` = approve. The Dean holds **no `A` permission on
any module** — every other permission is read-only except Communications.

Notable **absences** (the Dean has no grant at all for): LMS, Accommodation,
SIWES, Timetable/Venue, Library, Fees, Transcript, Helpdesk, Senate. Those
modules do not appear in the Dean's navigation at all
(`visibleModules()` filters by the permission map).

### Routing (`landingForRole` / role labels)

- Login lands the Dean at `/portal/dean` ("Dean Dashboard", "Faculty overview").
- The results module routes to `/portal/dean/results`.
- The quick-action grid is defined by `DEAN_MENU` in `src/lib/constants.ts`.

### Guard pattern

Every Dean page follows the same server-side guard:

```ts
const session = await getCurrentSession();
if (!session) redirect("/login");
if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));
```

A user of any other role who navigates to a Dean URL is bounced to their own
workspace. If the Dean account has no faculty linked, the dashboard shows a
"contact the Registry" empty state instead of leaking data.

---

## 3. The Dashboard (`/portal/dean` — Faculty Overview)

The landing page is a faculty intelligence report, built from
`facultyStats()` / `facultyDepartmentOverview()` in `src/lib/faculty.ts` (the
faculty's departments are derived from its staff roster). Sections:

1. **Headline stats** — departments in the faculty, total/active students,
   academic staff (lecturers, active), programmes offered.
2. **Academic depth stats** — courses running this session (plus all-time
   allocations), postgraduate students/applications/supervisions/theses, level
   coordinators, level advisers.
3. **Pipeline watch** (read-only oversight) — results awaiting HoD,
   HoD-approved awaiting Senate, published (Senate-approved/final), clearance
   in progress, and failed result-file uploads. The subtitle states plainly:
   *"The Dean can review and return results; approval runs HoD → Exams &
   Records."*
4. **Department comparison table** — per department: students, staff, courses,
   coordinators, advisers, pending results (amber badge) and pending clearance
   (gold badge). Department names link to the filtered student register
   (`/portal/dean/students?department=…`).
5. **Distributions** — students by level and by sex (horizontal bar charts).
6. **Quick actions** — the `DEAN_MENU` grid, each tile badged with the exact
   action available ("Review Faculty Results", "Awaiting Dean Review", "View &
   Export Students", "Create & Publish", etc.), so the read-only nature of each
   destination is explicit in the UI.

Pages are `force-dynamic`; nothing faculty-scoped is cached across users.

---

## 4. Workspace Pages

| Route | Purpose | Authority |
|---|---|---|
| `/portal/dean` | Faculty Overview dashboard (above) | Read |
| `/portal/dean/students` | Faculty student register with search/filters | Read |
| `/portal/dean/students/export` | CSV export of the register, same filters | Read (audited) |
| `/portal/dean/students/[id]` | Individual student profile in the faculty | Read |
| `/portal/dean/staff` | Academic staff across the faculty's departments | Read |
| `/portal/dean/results` | Faculty results pipeline + return action | Read + `returnResult` |
| `/portal/dean/admissions` | Monitor admissions into the faculty | Read |
| `/portal/dean/graduation` | Graduation & clearance oversight | Read |
| `/portal/dean/postgraduate` | PG applications, supervisor roster, theses | Read |
| `/portal/dean/academic-management` | Departmental administration review | Read |
| `/portal/dean/communications` | Publish faculty announcements | Write |

### Results (`/portal/dean/results`)

Shows the pipeline summary (awaiting HoD / HoD-approved / published), a table
of the 50 most recent result records for the current session and semester
(student, department, course, total, grade, submitted-by, status), and a
"Failed result files" section flagging CSV uploads that did not parse so the
relevant department can re-upload.

The only action in the table is **Return**, offered exclusively on rows whose
status is `HOD_APPROVED`; every other row is marked "Read-only".

### Communications (`/portal/dean/communications`)

`createFacultyAnnouncement` (server action, audited) publishes an announcement
immediately (there is no draft stage). Categories: NEWS, NOTICE, DEADLINE,
ADMISSION, GENERAL. Audiences: FACULTY-wide, STUDENT, STAFF, or ROLE-targeted
(HoD, Lecturer, Dean, Exams & Records, PG School, Student Affairs).

---

## 5. The One Write Action: `returnResult`

Defined in `src/lib/module-actions.ts`, invoked from
`/portal/dean/results` via the `ReturnResultButton` client component. The
server action enforces, in order:

1. **Session & role** — must be an authenticated `DEAN`.
2. **Step-up guard** — re-authentication may be demanded (`stepUpGuard`).
3. **Mandatory reason** — an empty reason is rejected; the textarea is also
   `required` in the UI.
4. **State rule** — only `HOD_APPROVED` results can be returned; anything else
   is rejected with the current stage.
5. **Faculty scope** — the result's course must be taught in one of the Dean's
   faculty departments (verified via `courseAssignment`), so a Dean can never
   touch another faculty's results.
6. **Effect** — `gradeStatus` reverts to `SUBMITTED`, the HoD approval stamps
   (`approvedBy1Id` / `approvedAt1`) are cleared, and an audit record is
   written (`EXAMS_RECORDS / UPDATE / RESULT`) capturing the old status, new
   status and the Dean's reason.

The form is a two-step confirm (button → reason textarea → "Confirm return"),
with pending state during submission.

---

## 6. Enforced Boundaries

- **Faculty scope is always server-derived.** The faculty comes from the
  session, never from a form field or query string. In the CSV export, the
  optional `department` filter is validated against the Dean's own faculty
  departments, so a hand-edited URL cannot widen the scope.
- **No cross-faculty visibility.** Students, staff, results, admissions,
  clearance and PG data are all resolved through the faculty's department/
  course-code scope first.
- **No public announcements.** `PUBLIC` is deliberately excluded from the
  Dean's announcement scopes — a Dean may never publish university-wide.
- **No approvals anywhere.** No `A` grant on any module; no path to
  `SENATE_APPROVED` or `FINAL` from the Dean workspace.
- **Everything sensitive is audited** — result returns and CSV exports both
  write to the audit trail with session metadata.
- **Role gate on every route** — non-Dean users are redirected; unauthenticated
  requests to the export route get `401`, wrong roles `403`.

---

## 7. Place in the Workflow

The Dean sits **beside** the results pipeline, not on it:

- **Lecturers** upload results (`SUBMITTED`).
- **HoDs** approve (`HOD_APPROVED`) — the departmental gate.
- **The Dean** watches both stages and, on seeing a defective HoD-approved
  result, returns it to `SUBMITTED` with a reason — the faculty's quality
  check *before* Senate sees it.
- **Exams & Records / Senate** finalise (`SENATE_APPROVED` → `FINAL`).

For admissions, graduation clearance and postgraduate supervision the Dean is
purely a monitoring layer over data owned and acted on by Registry, Bursary,
Student Affairs, the PG School and departments. The Dean's lever in those
areas is communication: faculty announcements directed at the students, staff
or roles who need to act.

---

## 8. Key Source References

| Concern | Location |
|---|---|
| RBAC permission map & `DEAN_MENU` | `src/lib/constants.ts` |
| Faculty statistics & scoping | `src/lib/faculty.ts` |
| Student register, filters, CSV | `src/lib/student-stats.ts` |
| `returnResult` server action | `src/lib/module-actions.ts` |
| Faculty announcement action | `src/app/portal/dean/communications/actions.ts` |
| Dashboard | `src/app/portal/dean/page.tsx` |
| Results surface | `src/app/portal/dean/results/page.tsx` |
| CSV export route | `src/app/portal/dean/students/export/route.ts` |
| Companion role guide | `HoD_Role.md` |
