// Faculty-wide oversight helpers for the Dean of Faculty workspace.
//
// The Dean's scope is the `faculty` string on their own account (e.g. "Physical
// Science"). Because student records only carry a department (not a faculty),
// every faculty-scoped query resolves the faculty's departments from the staff
// roster first and then narrows students, results, clearance and admissions to
// those departments. All helpers are read-only and are always enforced with the
// faculty in the WHERE clause so a manipulated URL can never surface another
// faculty's data.
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION, CURRENT_SEMESTER, type StudentCategory } from "@/lib/constants";

export interface FacultyScope {
  faculty: string;
  departments: string[];
  programmeIds: string[];
  courseCodes: string[];
}

export interface FacultyStudentCounts {
  total: number;
  active: number;
  undergraduate: number;
  postgraduate: number;
}

export interface FacultyResultStats {
  submitted: number;
  hodApproved: number;
  senateApproved: number;
  final: number;
  total: number;
}

export interface FacultyStats {
  scope: FacultyScope;
  students: FacultyStudentCounts;
  staff: { total: number; lecturers: number; active: number };
  programmes: number;
  courses: { everAllocated: number; currentSession: number };
  results: FacultyResultStats;
  pendingClearance: number;
  applications: { total: number; inPipeline: number };
  pg: { students: number; applications: number; supervision: number; theses: number };
  resultFiles: { total: number; failed: number };
  coordinators: number;
  advisers: number;
}

// The user is the active Dean of the given faculty. The Dean's account carries
// the faculty on the `faculty` field; this enforces it explicitly so a DEAN can
// never be presented as another faculty's scope.
export function isDeanOfFaculty(user: {
  role: string;
  faculty: string | null;
}, faculty: string): boolean {
  return user.role === "DEAN" && user.faculty === faculty;
}

// Departments that belong to a faculty, derived from the staff roster (staff
// records carry both faculty and department). Department-less staff rows and
// placeholder values are excluded.
export async function facultyDepartments(faculty: string): Promise<string[]> {
  if (!faculty) return [];
  const rows = await prisma.user.findMany({
    where: { faculty },
    select: { department: true },
    distinct: ["department"],
  });
  return rows
    .map((r) => r.department)
    .filter(
      (d): d is string =>
        typeof d === "string" && d.length > 0 && d !== "Unassigned" && d !== "N/A",
    )
    .sort((a, b) => a.localeCompare(b));
}

// Programme ids chosen by students currently in the faculty's departments.
// Applications link to programmes but not to faculties or departments, so this
// is the data-driven bridge used to scope the admissions pipeline.
export async function facultyProgrammeIds(
  faculty: string,
  departments: string[],
): Promise<string[]> {
  if (departments.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { role: "STUDENT", department: { in: departments }, programmeId: { not: null } },
    select: { programmeId: true },
    distinct: ["programmeId"],
  });
  return rows
    .map((r) => r.programmeId)
    .filter((p): p is string => p != null);
}

// Distinct course codes ever allocated to the faculty's departments
// (CourseAssignment carries faculty + department snapshots). Optional session
// narrows to that session's allocations.
export async function facultyCourseCodes(
  faculty: string,
  departments: string[],
  academicSession?: string,
): Promise<string[]> {
  if (departments.length === 0) return [];
  const rows = await prisma.courseAssignment.findMany({
    where: {
      department: { in: departments },
      ...(academicSession ? { academicSession } : {}),
    },
    select: { courseCode: true },
    distinct: ["courseCode"],
    orderBy: { courseCode: "asc" },
  });
  return rows.map((r) => r.courseCode);
}

// Student ids in the faculty (by department) — used to scope clearance, PG and
// NYSC-related views that link to the student's user record rather than a course.
export async function facultyStudentIds(
  departments: string[],
): Promise<string[]> {
  if (departments.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { role: "STUDENT", department: { in: departments } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export interface DepartmentOverviewRow {
  department: string;
  students: number;
  staff: number;
  programmes: number;
  coursesEver: number;
  coursesCurrent: number;
  coordinators: number;
  advisers: number;
  pendingResults: number;
  pendingClearance: number;
}

// Course code → department snapshot map for the faculty. Course codes are
// unique per department in this structure, so results/files can be attributed
// to a department through the assignment snapshot.
export async function facultyCourseCodeDepartmentMap(
  faculty: string,
  departments: string[],
): Promise<Map<string, string>> {
  if (departments.length === 0) return new Map();
  const rows = await prisma.courseAssignment.findMany({
    where: { faculty, department: { in: departments } },
    select: { courseCode: true, department: true },
    distinct: ["courseCode"],
  });
  return new Map(rows.map((r) => [r.courseCode, r.department]));
}

// Server-side guard used by Dean faculty-scoped actions (returnResult): a
// course only belongs to the Dean's faculty when it is allocated to one of the
// faculty's departments. Always derives the faculty from the session, never
// the client.
export async function isCourseInFaculty(
  faculty: string,
  courseCode: string,
): Promise<boolean> {
  if (!faculty || !courseCode) return false;
  const departments = await facultyDepartments(faculty);
  if (departments.length === 0) return false;
  const count = await prisma.courseAssignment.count({
    where: { faculty, courseCode, department: { in: departments } },
  });
  return count > 0;
}

// Per-department overview table for the Faculty Overview and Academic
// Management pages. All numbers are scoped to the faculty's departments and the
// current session where the metric is session-bound.
export async function facultyDepartmentOverview(
  faculty: string,
): Promise<DepartmentOverviewRow[]> {
  const departments = await facultyDepartments(faculty);
  if (departments.length === 0) return [];
  const deptFilter = { in: departments };

  const [studentsByDept, staffByDept, coordinatorsByDept, advisersByDept, pendingResults] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["department"],
        where: { role: "STUDENT", department: deptFilter },
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["department"],
        where: { role: "LECTURER", faculty, department: deptFilter },
        _count: { _all: true },
      }),
      prisma.levelCoordinator.groupBy({
        by: ["department"],
        where: { department: deptFilter, academicSession: CURRENT_SESSION },
        _count: { _all: true },
      }),
      prisma.levelAdvisorAssignment.groupBy({
        by: ["department"],
        where: { department: deptFilter, academicSession: CURRENT_SESSION, status: "ACTIVE" },
        _count: { _all: true },
      }),
      (async () => {
        const codes = await facultyCourseCodes(faculty, departments);
        if (codes.length === 0) return { rows: [] as { courseCode: string }[], map: new Map<string, string>() };
        const rows = await prisma.result.findMany({
          where: { gradeStatus: "SUBMITTED", academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, course: { code: { in: codes } } },
          select: { course: { select: { code: true } } },
        });
        const map = await facultyCourseCodeDepartmentMap(faculty, departments);
        return { rows: rows.map((r) => ({ courseCode: r.course.code })), map };
      })(),
    ]);

  // Distinct programmes per department from the student roster.
  const programmeRows = await prisma.user.findMany({
    where: { role: "STUDENT", department: deptFilter, programmeId: { not: null } },
    select: { department: true, programmeId: true },
    distinct: ["department", "programmeId"],
  });
  const programmesByDeptMap = new Map<string, number>();
  for (const p of programmeRows) {
    if (p.department == null) continue;
    programmesByDeptMap.set(p.department, (programmesByDeptMap.get(p.department) ?? 0) + 1);
  }

  // Current-session allocation counts per department.
  const currentByDept = await prisma.courseAssignment.groupBy({
    by: ["department"],
    where: { department: deptFilter, academicSession: CURRENT_SESSION },
    _count: { _all: true },
  });
  const everByDept = await prisma.courseAssignment.groupBy({
    by: ["department"],
    where: { department: deptFilter },
    _count: { _all: true },
  });

  const countBy = (rows: { department: string | null; _count: { _all: number } }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.department == null) continue;
      map.set(r.department, r._count._all);
    }
    return map;
  };

  const studentsMap = countBy(studentsByDept);
  const staffMap = countBy(staffByDept);
  const coordMap = countBy(coordinatorsByDept);
  const adviserMap = countBy(advisersByDept);
  const currentMap = countBy(currentByDept);
  const everMap = countBy(everByDept);

  // Pending results attributed per department via the code → department map.
  const pendingByDept = new Map<string, number>();
  for (const r of pendingResults.rows) {
    const dept = pendingResults.map.get(r.courseCode);
    if (!dept) continue;
    pendingByDept.set(dept, (pendingByDept.get(dept) ?? 0) + 1);
  }

  // Pending clearance per department via the requesting student's department.
  const pendingClearanceByDept = new Map<string, number>();
  const clearanceRows = await prisma.clearanceRequest.findMany({
    where: { status: "IN_PROGRESS", user: { role: "STUDENT", department: deptFilter } },
    select: { userId: true },
  });
  const clearanceStudentIds = clearanceRows.map((c) => c.userId);

  if (clearanceStudentIds.length > 0) {
    const clearanceUsers = await prisma.user.findMany({
      where: { id: { in: clearanceStudentIds } },
      select: { id: true, department: true },
    });
    for (const u of clearanceUsers) {
      if (u.department == null) continue;
      pendingClearanceByDept.set(u.department, (pendingClearanceByDept.get(u.department) ?? 0) + 1);
    }
  }

  return departments
    .map((dept) => ({
      department: dept,
      students: studentsMap.get(dept) ?? 0,
      staff: staffMap.get(dept) ?? 0,
      programmes: programmesByDeptMap.get(dept) ?? 0,
      coursesEver: everMap.get(dept) ?? 0,
      coursesCurrent: currentMap.get(dept) ?? 0,
      coordinators: coordMap.get(dept) ?? 0,
      advisers: adviserMap.get(dept) ?? 0,
      pendingResults: pendingByDept.get(dept) ?? 0,
      pendingClearance: pendingClearanceByDept.get(dept) ?? 0,
    }))
    .sort((a, b) => a.department.localeCompare(b.department));
}


// One-shot aggregation for the Faculty Overview and the faculty-wide pages.
// Everything is computed from the faculty scope in parallel — no N+1 queries.
export async function facultyStats(faculty: string): Promise<FacultyStats> {
  const departments = await facultyDepartments(faculty);
  const [programmeIds, courseCodes, currentSessionCodes] = await Promise.all([
    facultyProgrammeIds(faculty, departments),
    facultyCourseCodes(faculty, departments),
    facultyCourseCodes(faculty, departments, CURRENT_SESSION),
  ]);
  const scope: FacultyScope = { faculty, departments, programmeIds, courseCodes };

  const deptFilter = departments.length ? { in: departments } : undefined;

  const [
    students,
    activeStudents,
    undergraduateStudents,
    postgraduateStudents,
    staff,
    lecturers,
    activeStaff,
    resultStats,
    pendingClearance,
    applications,
    pipelineApplications,
    pgStudents,
    pgApplications,
    supervision,
    theses,
    resultFiles,
    failedFiles,
    coordinators,
    advisers,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", department: deptFilter } }),
    prisma.user.count({ where: { role: "STUDENT", department: deptFilter, status: "ACTIVE" } }),
    prisma.user.count({
      where: { role: "STUDENT", department: deptFilter, studentCategory: "UNDERGRADUATE" },
    }),
    prisma.user.count({
      where: { role: "STUDENT", department: deptFilter, studentCategory: "POSTGRADUATE" },
    }),
    prisma.user.count({ where: { role: "LECTURER", faculty } }),
    prisma.user.count({ where: { role: "LECTURER", department: deptFilter, faculty } }),
    prisma.user.count({
      where: { role: "LECTURER", department: deptFilter, faculty, status: "ACTIVE" },
    }),
    (async () => {
      const codes = scope.courseCodes;
      if (codes.length === 0) {
        return { submitted: 0, hodApproved: 0, senateApproved: 0, final: 0, total: 0 };
      }
      const rows = await prisma.result.groupBy({
        by: ["gradeStatus"],
        where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, course: { code: { in: codes } } },
        _count: { _all: true },
      });
      const get = (s: string) => rows.find((r) => r.gradeStatus === s)?._count._all ?? 0;
      const submitted = get("SUBMITTED");
      const hodApproved = get("HOD_APPROVED");
      const senateApproved = get("SENATE_APPROVED");
      const final = get("FINAL");
      return {
        submitted,
        hodApproved,
        senateApproved,
        final,
        total: submitted + hodApproved + senateApproved + final,
      };
    })(),
    prisma.clearanceRequest.count({
      where: { status: "IN_PROGRESS", user: { role: "STUDENT", department: deptFilter } },
    }),
    prisma.application.count({ where: { programmeId: { in: scope.programmeIds } } }),
    prisma.application.count({
      where: {
        programmeId: { in: scope.programmeIds },
        status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS"] },
      },
    }),
    prisma.user.count({
      where: {
        role: "STUDENT",
        department: deptFilter,
        studentCategory: "POSTGRADUATE" as StudentCategory,
      },
    }),
    prisma.pGApplication.count({
      where: { user: { role: "STUDENT", department: deptFilter } },
    }),
    prisma.supervisorAssignment.count({
      where: { pgStudent: { role: "STUDENT", department: deptFilter } },
    }),
    prisma.thesis.count({
      where: { pgStudent: { role: "STUDENT", department: deptFilter } },
    }),
    prisma.resultFile.count({ where: { courseCode: { in: scope.courseCodes } } }),
    prisma.resultFile.count({
      where: { courseCode: { in: scope.courseCodes }, status: "FAILED" },
    }),
    prisma.levelCoordinator.count({
      where: { department: { in: scope.departments }, academicSession: CURRENT_SESSION },
    }),
    prisma.levelAdvisorAssignment.count({
      where: { department: { in: scope.departments }, academicSession: CURRENT_SESSION, status: "ACTIVE" },
    }),
  ]);

  return {
    scope,
    students: {
      total: students,
      active: activeStudents,
      undergraduate: undergraduateStudents,
      postgraduate: postgraduateStudents,
    },
    staff: { total: staff, lecturers, active: activeStaff },
    programmes: scope.programmeIds.length,
    courses: {
      everAllocated: scope.courseCodes.length,
      currentSession: currentSessionCodes.length,
    },
    results: resultStats,
    pendingClearance,
    applications: { total: applications, inPipeline: pipelineApplications },
    pg: {
      students: pgStudents,
      applications: pgApplications,
      supervision,
      theses,
    },
    resultFiles: { total: resultFiles, failed: failedFiles },
    coordinators,
    advisers,
  };
}
