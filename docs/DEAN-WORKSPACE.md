# Dean of Faculty Workspace

Faculty-scoped, read-only Dean workspace. The Dean sees a dedicated sidebar
(`DEAN_MENU`) and lands on `/portal/dean`, with nine faculty-wide views, all
enforced server-side against the Dean's own `faculty` value.

## Design decisions

- **Read-only everywhere.** The Access Control Matrix gives the Dean `R` on the
  relevant modules and no approval rights. No new approval step was added to
  the result pipeline (`SUBMITTED → HOD_APPROVED → SENATE_APPROVED` remains
  unchanged); the Dean's results page is pure oversight.
- **Faculty scope is enforced in the WHERE clause.** The Dean's account carries
  `faculty` (e.g. "Physical Science"). Student records only carry a department,
  so every query first resolves the faculty's departments from the staff
  roster (`facultyDepartments`) and then narrows students, results, clearance
  and applications to those departments. A hand-edited URL can never surface
  another faculty's data.
- **Scoping bridges.** `CourseAssignment` carries `faculty` + `department`
  snapshots, so course codes scope the results pipeline. Applications and PG
  applications have no department/faculty, so the programmes actually studied
  by faculty students (`facultyProgrammeIds`) scope the admissions and PG views.

## Files

### Navigation & routing

- `src/lib/constants.ts` — `landingForRole("DEAN")` → `/portal/dean`; new
  `DEAN_MENU` (9 items, grouped "Academic Management" / "Student Affairs").
- `src/app/portal/layout.tsx` — `buildMenuNav()` shared with the HOD sidebar;
  `buildDeanNav()` selected for the DEAN role.

### Shared helpers

- `src/lib/faculty.ts` (new) — `isDeanOfFaculty`, `facultyDepartments`,
  `facultyProgrammeIds`, `facultyCourseCodes`, `facultyStudentIds`,
  `facultyCourseCodeDepartmentMap`, `facultyDepartmentOverview`, `facultyStats`.
- `src/lib/student-stats.ts` — added `fetchFacultyStudents` and
  `fetchFacultyStudentById` (per-student department max level, so Law/Med
  students are placed on their correct session-derived level).

### Pages (all under `src/app/portal/dean/`)

| Route | Purpose |
| --- | --- |
| `/portal/dean` | Faculty Overview — stats, pipeline watch, department comparison, level/sex charts. |
| `/portal/dean/academic-management` | Course allocation, teaching load, coordinators and advisers per department. |
| `/portal/dean/results` | Faculty-wide grade pipeline + failed result files. |
| `/portal/dean/students` | Full faculty register and analytics (session/level/age/programme/category/status), department pill filter, CSV export. |
| `/portal/dean/students/[id]` | Student detail with coordinator/adviser from the student's department. |
| `/portal/dean/students/export` | CSV export route, session-scoped, faculty from the session. |
| `/portal/dean/staff` | All academic staff across the faculty with current-session roles and load. |
| `/portal/dean/admissions` | Applications for the faculty's programmes, grouped by pipeline stage. |
| `/portal/dean/graduation` | Clearance progress per department and per request. |
| `/portal/dean/postgraduate` | PG applications, supervisor roster and theses for the faculty. |
| `/portal/dean/communications` | Announcements relevant to the faculty and the notification log for its students/staff. |

## Security notes

- Every page checks `session.user.role === "DEAN"` before rendering and
  redirects non-Deans to their own landing route.
- Faculty, not the request, selects the scope; the optional `department` query
  parameter is validated against the faculty's department list before use.
- Exports write a `STUDENTS/EXPORT` audit entry and never accept a department
  outside the authenticated faculty.

## Verification

- `npm run lint` — clean (only pre-existing header/footer `<img>` warnings).
- `npm test` — all pass; `constants.test.ts` asserts the Dean landing route and
  `DEAN_MENU` shape.
- `npm run build` — succeeds; all 11 `/portal/dean/*` routes compile as dynamic.
- Note: `src/lib/audit.test.ts` needs a live database and can exceed Vitest's
  default 5s timeout on a cold connection; run with `--testTimeout=30000`.
