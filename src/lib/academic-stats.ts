import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION, CURRENT_SEMESTER } from "@/lib/constants";

// Shared academic-workflow aggregation helpers (§16). Every dashboard in the
// portal (HoD, Dean, SBC, DVC/Governance, VC) counts the same quantities:
// pipeline stage counts, grade distribution, pass/completion rates and
// course-assignment coverage. These helpers keep those numbers in lock-step so
// the end-to-end workflow reports identical statistics at every level.
//
// Every helper is scoped by academic session/semester (defaulting to the
// current session) and returns the scope it applied, so consumers can render
// the exact context a number refers to.

export type AcademicScope = {
  academicSession?: string;
  semester?: number;
};

export type PipelineStage =
  | "SUBMITTED"
  | "HOD_APPROVED"
  | "SENATE_APPROVED"
  | "FINAL";

export const RESULT_STAGES: PipelineStage[] = [
  "SUBMITTED",
  "HOD_APPROVED",
  "SENATE_APPROVED",
  "FINAL",
];

function scopeWhere(scope: AcademicScope = {}) {
  return {
    academicSession: scope.academicSession ?? CURRENT_SESSION,
    semester: scope.semester ?? CURRENT_SEMESTER,
  };
}

export type ResultPipelineStats = {
  academicSession: string;
  semester: number;
  total: number;
  byStage: Record<PipelineStage, number>;
  finalised: number;
  inProgress: number;
  completionPct: number;
};

// Counts of result rows at each stage of the SUBMITTED → HOD_APPROVED →
// SENATE_APPROVED → FINAL pipeline. The same shape is used for the whole
// university, a faculty, a department and a single course.
export async function getResultPipelineStats(
  scope: AcademicScope = {},
  resultFilter: { user?: { department?: string; faculty?: string }; course?: { code?: string } } = {},
): Promise<ResultPipelineStats> {
  const where = { ...scopeWhere(scope), ...resultFilter };
  const rows = await prisma.result.groupBy({
    by: ["gradeStatus"],
    where,
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((r) => [r.gradeStatus, r._count._all]));
  const byStage: Record<PipelineStage, number> = {
    SUBMITTED: counts["SUBMITTED"] ?? 0,
    HOD_APPROVED: counts["HOD_APPROVED"] ?? 0,
    SENATE_APPROVED: counts["SENATE_APPROVED"] ?? 0,
    FINAL: counts["FINAL"] ?? 0,
  };
  const total = byStage.SUBMITTED + byStage.HOD_APPROVED + byStage.SENATE_APPROVED + byStage.FINAL;
  const finalised = byStage.FINAL;
  const inProgress = total - finalised;
  return {
    academicSession: where.academicSession,
    semester: where.semester,
    total,
    byStage,
    finalised,
    inProgress,
    completionPct: total === 0 ? 0 : Math.round((finalised / total) * 100),
  };
}

export type CourseAssignmentStats = {
  academicSession: string;
  semester: number;
  totalAssignments: number;
  withCoLecturers: number;
  withoutMainLecturer: number;
  studentsCovered: number;
  assignments: {
    courseCode: string;
    courseTitle: string;
    department: string;
    mainLecturer: string | null;
    coLecturerCount: number;
    registeredStudents: number;
  }[];
};

// Coverage of course allocation for a department (or the whole university when
// no department is given), including how many students are actually registered
// on each allocated course this session/semester.
export async function getCourseAssignmentStats(
  scope: AcademicScope = {},
  department?: string | null,
): Promise<CourseAssignmentStats> {
  const where = {
    ...scopeWhere(scope),
    ...(department ? { department } : {}),
  };
  const assignments = await prisma.courseAssignment.findMany({
    where,
    include: {
      _count: { select: { teamMembers: true } },
      lecturer: { select: { fullName: true } },
    },
    orderBy: { courseCode: "asc" },
  });

  const codes = assignments.map((a) => a.courseCode);
  const courses = codes.length
    ? await prisma.course.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } })
    : [];
  const courseIdToCode = new Map(courses.map((c) => [c.id, c.code]));
  const regRows = codes.length
    ? await prisma.courseRegistration.groupBy({
        by: ["courseId"],
        where: { ...scopeWhere(scope), status: "ACTIVE", course: { code: { in: codes } } },
        _count: { _all: true },
      })
    : [];
  const registeredByCode = new Map<string, number>();
  for (const row of regRows) {
    const code = courseIdToCode.get(row.courseId);
    if (code) registeredByCode.set(code, row._count._all);
  }

  return {
    academicSession: where.academicSession,
    semester: where.semester,
    totalAssignments: assignments.length,
    withCoLecturers: assignments.filter((a) => a._count.teamMembers > 0).length,
    withoutMainLecturer: 0,
    studentsCovered: [...registeredByCode.values()].reduce((s, n) => s + n, 0),
    assignments: assignments.map((a) => ({
      courseCode: a.courseCode,
      courseTitle: a.courseTitle,
      department: a.department,
      mainLecturer: a.lecturer?.fullName ?? null,
      coLecturerCount: a._count.teamMembers,
      registeredStudents: registeredByCode.get(a.courseCode) ?? 0,
    })),
  };
}

export type GradeDistribution = {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  P: number;
  gradedCount: number;
  passCount: number;
  passPct: number;
};

export type DepartmentAcademicStats = {
  academicSession: string;
  semester: number;
  department: string;
  students: number;
  coursesTaught: number;
  activeRegistrations: number;
  gradedResults: number;
  pipeline: ResultPipelineStats;
  gradeDistribution: GradeDistribution;
};

// One department's academic position for a session/semester.
export async function getDepartmentAcademicStats(
  department: string,
  scope: AcademicScope = {},
): Promise<DepartmentAcademicStats> {
  const { academicSession, semester } = scopeWhere(scope);
  const studentFilter = { user: { department } };

  const [students, coursesTaught, activeRegistrations, graded, pipeline] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", department } }),
    prisma.courseAssignment.count({ where: { ...scopeWhere(scope), department } }),
    prisma.courseRegistration.count({
      where: { ...scopeWhere(scope), status: "ACTIVE", user: { department } },
    }),
    prisma.result.findMany({
      where: { academicSession, semester, user: { department } },
      select: { total: true, grade: true },
    }),
    getResultPipelineStats(scope, studentFilter),
  ]);

  return {
    academicSession,
    semester,
    department,
    students,
    coursesTaught,
    activeRegistrations,
    gradedResults: graded.length,
    pipeline,
    gradeDistribution: gradeDistributionOf(graded),
  };
}

export type FacultyAcademicStats = {
  academicSession: string;
  semester: number;
  faculty: string;
  students: number;
  coursesTaught: number;
  activeRegistrations: number;
  gradedResults: number;
  pipeline: ResultPipelineStats;
  gradeDistribution: GradeDistribution;
  departments: string[];
};

// One faculty's academic position for a session/semester.
export async function getFacultyAcademicStats(
  faculty: string,
  scope: AcademicScope = {},
): Promise<FacultyAcademicStats> {
  const { academicSession, semester } = scopeWhere(scope);
  const studentFilter = { user: { faculty } };

  const [students, deptRows, coursesTaught, activeRegistrations, graded, pipeline] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", faculty } }),
    prisma.user.findMany({
      where: { role: "STUDENT", faculty },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.courseAssignment.count({ where: { ...scopeWhere(scope), faculty } }),
    prisma.courseRegistration.count({
      where: { ...scopeWhere(scope), status: "ACTIVE", user: { faculty } },
    }),
    prisma.result.findMany({
      where: { academicSession, semester, user: { faculty } },
      select: { total: true, grade: true },
    }),
    getResultPipelineStats(scope, studentFilter),
  ]);

  return {
    academicSession,
    semester,
    faculty,
    students,
    coursesTaught,
    activeRegistrations,
    gradedResults: graded.length,
    pipeline,
    gradeDistribution: gradeDistributionOf(graded),
    departments: deptRows.map((r) => r.department).filter((d): d is string => Boolean(d)).sort(),
  };
}

export type UniversityAcademicStats = {
  academicSession: string;
  semester: number;
  students: number;
  coursesTaught: number;
  activeRegistrations: number;
  gradedResults: number;
  pipeline: ResultPipelineStats;
  gradeDistribution: GradeDistribution;
  faculties: { faculty: string; students: number }[];
};

// University-wide totals for a session/semester.
export async function getUniversityAcademicStats(
  scope: AcademicScope = {},
): Promise<UniversityAcademicStats> {
  const { academicSession, semester } = scopeWhere(scope);

  const [students, facultyRows, coursesTaught, activeRegistrations, graded, pipeline] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.findMany({
        where: { role: "STUDENT" },
        select: { faculty: true },
        distinct: ["faculty"],
      }),
      prisma.courseAssignment.count({ where: scopeWhere(scope) }),
      prisma.courseRegistration.count({
        where: { ...scopeWhere(scope), status: "ACTIVE" },
      }),
      prisma.result.findMany({
        where: { academicSession, semester },
        select: { total: true, grade: true },
      }),
      getResultPipelineStats(scope),
    ]);

  const faculties = await Promise.all(
    facultyRows
      .map((f) => f.faculty)
      .filter((faculty): faculty is string => Boolean(faculty))
      .map(async (faculty) => ({
        faculty,
        students: await prisma.user.count({ where: { role: "STUDENT", faculty } }),
      })),
  );

  return {
    academicSession,
    semester,
    students,
    coursesTaught,
    activeRegistrations,
    gradedResults: graded.length,
    pipeline,
    gradeDistribution: gradeDistributionOf(graded),
    faculties,
  };
}

function gradeDistributionOf(
  rows: { total: number | null; grade: string | null }[],
): GradeDistribution {
  const dist: GradeDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, P: 0, gradedCount: 0, passCount: 0, passPct: 0 };
  for (const r of rows) {
    if (!r.grade) continue;
    if (r.grade in dist) {
      dist[r.grade as keyof GradeDistribution] += 1;
      dist.gradedCount += 1;
      if (r.total !== null && r.total >= 40) dist.passCount += 1;
    }
  }
  dist.passPct = dist.gradedCount === 0 ? 0 : Math.round((dist.passCount / dist.gradedCount) * 100);
  return dist;
}

export type CourseRegResultCounts = {
  courseCode: string;
  registered: number;
  submitted: number;
  completionPct: number;
};

// Registered vs submitted counts per course code for a session/semester. Used
// by the lecturer dashboard to show, per assigned course, how many students
// registered and how many already have a submitted result.
export async function getCourseRegResultCounts(
  courseCodes: string[],
  scope: AcademicScope = {},
): Promise<Map<string, CourseRegResultCounts>> {
  const result = new Map<string, CourseRegResultCounts>();
  const codes = [...new Set(courseCodes)];
  for (const code of codes) {
    result.set(code, { courseCode: code, registered: 0, submitted: 0, completionPct: 0 });
  }
  if (codes.length === 0) return result;

  const courses = await prisma.course.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const idToCode = new Map(courses.map((c) => [c.id, c.code]));

  const regRows = await prisma.courseRegistration.groupBy({
    by: ["courseId"],
    where: { ...scopeWhere(scope), status: "ACTIVE", course: { code: { in: codes } } },
    _count: { _all: true },
  });
  const resRows = await prisma.result.groupBy({
    by: ["courseId"],
    where: { ...scopeWhere(scope), course: { code: { in: codes } } },
    _count: { _all: true },
  });

  for (const row of regRows) {
    const code = idToCode.get(row.courseId);
    if (code) result.get(code)!.registered = row._count._all;
  }
  for (const row of resRows) {
    const code = idToCode.get(row.courseId);
    if (code) result.get(code)!.submitted = row._count._all;
  }
  for (const entry of result.values()) {
    entry.completionPct =
      entry.registered === 0 ? 0 : Math.round((entry.submitted / entry.registered) * 100);
  }
  return result;
}
