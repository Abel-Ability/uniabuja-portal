// Governance & Oversight Committee — read-only, university-wide helpers.
//
// This workspace monitors the institution as a whole. Nothing in this module
// writes application data: it aggregates real records (results, admissions,
// clearance, PG supervision, course allocation, level coordination, fees,
// helpdesk, audit) and derives an exceptions register for the committee. Every
// query is scoped server-side; no client-supplied scope is trusted. The
// authorization boundary is a CommitteeMembership row (see dvc/guard.ts), and
// the Chairman is a designation, not an extra permission set.
import { prisma } from "@/lib/prisma";
import {
  COMMITTEES,
  COMMITTEE_LABELS,
  MEMBERSHIP_DESIGNATIONS,
  MEMBERSHIP_STATUSES,
  CURRENT_SESSION,
  CURRENT_SEMESTER,
} from "@/lib/constants";
import { facultyStats } from "@/lib/faculty";
import { getResultPipelineStats, type PipelineStage } from "@/lib/academic-stats";

// ---------------------------------------------------------------------------
// Committee membership & authorization
// ---------------------------------------------------------------------------

export const GOVERNANCE_COMMITTEE = COMMITTEES.GOVERNANCE_OVERSIGHT;

// A membership row grants access only while ACTIVE and not expired.
export function membershipIsActive(
  row: { status: string; endDate: Date | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  if (row.status !== MEMBERSHIP_STATUSES.ACTIVE) return false;
  if (row.endDate && row.endDate.getTime() < now.getTime()) return false;
  return true;
}

// Roles that are granted the committee workspace when they hold a valid
// membership row. The DVC's ordinary role is unchanged; the workspace is
// granted by membership, not by job title.
export function isGovernanceRole(role: string): boolean {
  return role === "DVC_OVERSIGHT" || role === "GOVERNANCE_OVERSIGHT_MEMBER";
}

// Header identity: the Chairman is still a member with the same powers, so the
// label only distinguishes the designation.
export function membershipDesignationLabel(designation: string | null | undefined): string | undefined {
  if (designation === MEMBERSHIP_DESIGNATIONS.CHAIRMAN) {
    return `Chairman — ${COMMITTEE_LABELS[GOVERNANCE_COMMITTEE]}`;
  }
  if (designation === MEMBERSHIP_DESIGNATIONS.MEMBER) {
    return `Member — ${COMMITTEE_LABELS[GOVERNANCE_COMMITTEE]}`;
  }
  return undefined;
}

export type CommitteeMembershipRow = {
  id: string;
  committee: string;
  userId: string;
  designation: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// The user's active membership for the given committee, or null. Pages that
// need the designation call this after the guard.
export async function getActiveCommitteeMembership(
  userId: string,
  committee: string,
): Promise<CommitteeMembershipRow | null> {
  const row = await prisma.committeeMembership.findFirst({
    where: { userId, committee },
    orderBy: { createdAt: "desc" },
  });
  return membershipIsActive(row) ? row : null;
}

// The committee roster (used by the dashboard) — members plus their designation.
export async function governanceCommitteeRoster() {
  const rows = await prisma.committeeMembership.findMany({
    where: { committee: GOVERNANCE_COMMITTEE },
    include: {
      user: { select: { id: true, fullName: true, username: true, staffNo: true, department: true, faculty: true } },
    },
    orderBy: [{ designation: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    designation: r.designation,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
    active: membershipIsActive(r),
    member: r.user,
  }));
}

// ---------------------------------------------------------------------------
// University-wide statistics (Oversight Dashboard / University Overview)
// ---------------------------------------------------------------------------

export interface GovernanceStats {
  faculties: number;
  departments: number;
  programmes: number;
  students: { total: number; active: number; undergraduate: number; postgraduate: number };
  staff: { total: number; academic: number; nonTeaching: number; active: number };
  results: {
    submitted: number;
    hodApproved: number;
    senateApproved: number;
    final: number;
    total: number;
  };
  pendingClearance: number;
  applications: { total: number; inPipeline: number; admitted: number };
  pg: { students: number; applications: number; supervision: number; theses: number };
  resultFiles: { total: number; failed: number };
  coordinators: number;
  advisers: number;
}

function distinctValues<T>(
  rows: { [k: string]: unknown }[],
  key: string,
): T[] {
  return rows
    .map((r) => r[key])
    .filter((v): v is T => typeof v === "string" && v.trim().length > 0 && v !== "Unassigned" && v !== "N/A");
}

export async function governanceStats(): Promise<GovernanceStats> {
  const [
    facultiesRows,
    departmentsRows,
    programmes,
    totalStudents,
    activeStudents,
    undergraduateStudents,
    postgraduateStudents,
    totalStaff,
    academicStaff,
    nonTeachingStaff,
    activeStaff,
    resultRows,
    pendingClearance,
    applicationsTotal,
    applicationsInPipeline,
    admitted,
    pgStudents,
    pgApplications,
    supervision,
    theses,
    resultFilesTotal,
    resultFilesFailed,
    coordinators,
    advisers,
  ] = await Promise.all([
    prisma.user.findMany({ where: { faculty: { not: null } }, select: { faculty: true }, distinct: ["faculty"] }),
    prisma.user.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"] }),
    prisma.programme.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "STUDENT", studentCategory: "UNDERGRADUATE" } }),
    prisma.user.count({ where: { role: "STUDENT", studentCategory: "POSTGRADUATE" } }),
    prisma.user.count({ where: { staffNo: { not: null } } }),
    prisma.user.count({ where: { staffNo: { not: null }, faculty: { not: "Non-Teaching" } } }),
    prisma.user.count({ where: { staffNo: { not: null }, faculty: "Non-Teaching" } }),
    prisma.user.count({ where: { staffNo: { not: null }, status: "ACTIVE" } }),
    prisma.result.groupBy({
      by: ["gradeStatus"],
      where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
      _count: { _all: true },
    }),
    prisma.clearanceRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.application.count(),
    prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS"] } } }),
    prisma.application.count({ where: { status: "ADMITTED" } }),
    prisma.user.count({ where: { role: "STUDENT", studentCategory: "POSTGRADUATE" } }),
    prisma.pGApplication.count(),
    prisma.supervisorAssignment.count(),
    prisma.thesis.count(),
    prisma.resultFile.count(),
    prisma.resultFile.count({ where: { status: { in: ["FAILED", "PARTIAL"] } } }),
    prisma.levelCoordinator.count({ where: { academicSession: CURRENT_SESSION } }),
    prisma.levelAdvisorAssignment.count({ where: { academicSession: CURRENT_SESSION, status: "ACTIVE" } }),
  ]);

  const getCount = (rows: { gradeStatus: string; _count: { _all: number } }[], s: string) =>
    rows.find((r) => r.gradeStatus === s)?._count._all ?? 0;

  const submitted = getCount(resultRows, "SUBMITTED");
  const hodApproved = getCount(resultRows, "HOD_APPROVED");
  const senateApproved = getCount(resultRows, "SENATE_APPROVED");
  const final = getCount(resultRows, "FINAL");

  return {
    faculties: distinctValues<string>(facultiesRows, "faculty").length,
    departments: distinctValues<string>(departmentsRows, "department").length,
    programmes,
    students: {
      total: totalStudents,
      active: activeStudents,
      undergraduate: undergraduateStudents,
      postgraduate: postgraduateStudents,
    },
    staff: {
      total: totalStaff,
      academic: academicStaff,
      nonTeaching: nonTeachingStaff,
      active: activeStaff,
    },
    results: {
      submitted,
      hodApproved,
      senateApproved,
      final,
      total: submitted + hodApproved + senateApproved + final,
    },
    pendingClearance,
    applications: { total: applicationsTotal, inPipeline: applicationsInPipeline, admitted },
    pg: { students: pgStudents, applications: pgApplications, supervision, theses },
    resultFiles: { total: resultFilesTotal, failed: resultFilesFailed },
    coordinators,
    advisers,
  };
}

// ---------------------------------------------------------------------------
// Exceptions register
// ---------------------------------------------------------------------------

export type ExceptionSeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";

export const EXCEPTION_SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};

export const EXCEPTION_SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
};

export interface GovernanceException {
  id: string;
  category: string;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  count: number;
}

function makeException(
  id: string,
  category: string,
  severity: ExceptionSeverity,
  title: string,
  detail: string,
  count: number,
): GovernanceException {
  return { id, category, severity, title, detail, count };
}

export async function governanceExceptions(): Promise<GovernanceException[]> {
  const [departmentsRows, coordinators, advisers, courseCount, unassignedCourses] = await Promise.all([
    prisma.user.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"] }),
    prisma.levelCoordinator.findMany({
      where: { academicSession: CURRENT_SESSION },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.levelAdvisorAssignment.findMany({
      where: { academicSession: CURRENT_SESSION, status: "ACTIVE" },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.course.count(),
    prisma.course.count({ where: { assignments: { none: { academicSession: CURRENT_SESSION } } } }),
  ]);

  const departments = distinctValues<string>(departmentsRows, "department");
  const coveredCoordinators = new Set(coordinators.map((c) => c.department));
  const coveredAdvisers = new Set(advisers.map((a) => a.department));
  const departmentsWithoutCoordinators = departments.filter((d) => !coveredCoordinators.has(d));
  const departmentsWithoutAdvisers = departments.filter((d) => !coveredAdvisers.has(d));

  const [
    resultsSubmitted,
    resultsHod,
    resultsSenate,
    openAppeals,
    openMisconduct,
    failedResultFiles,
    pgWithoutSupervisor,
    clearanceInProgress,
    admissionsPipeline,
    overdueInvoices,
    transcriptsPending,
    hostelPending,
    dpoOpen,
  ] = await Promise.all([
    prisma.result.count({ where: { gradeStatus: "SUBMITTED" } }),
    prisma.result.count({ where: { gradeStatus: "HOD_APPROVED" } }),
    prisma.result.count({ where: { gradeStatus: "SENATE_APPROVED" } }),
    prisma.appeal.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.misconductCase.count({ where: { status: { not: "CLOSED" } } }),
    prisma.resultFile.count({ where: { status: { in: ["FAILED", "PARTIAL"] } } }),
    prisma.user.count({ where: { role: "STUDENT", studentCategory: "POSTGRADUATE", pgStudentsSupervised: { none: {} } } }),
    prisma.clearanceRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.transcriptRequest.count({ where: { AND: [{ status: { not: "ISSUED" } }, { status: { not: "COURIER_DISPATCHED" } }] } }),
    prisma.hostelApplication.count({ where: { status: "PENDING" } }),
    prisma.dataSubjectRequest.count({ where: { status: { not: "COMPLETED" } } }),
  ]);

  const exceptions: GovernanceException[] = [
    makeException("results-submitted", "RESULTS_PENDING", "HIGH",
      "Results awaiting HoD sign-off",
      "Result rows still at SUBMITTED — HoD approval has not begun.", resultsSubmitted),
    makeException("results-hod-approved", "RESULTS_PENDING", "MODERATE",
      "Results awaiting Senate finalisation",
      "Result rows at HOD_APPROVED, waiting on Senate finalisation (publication).", resultsHod),
    makeException("results-senate-approved", "RESULTS_PENDING", "LOW",
      "Senate-approved results awaiting publication",
      "Result rows at SENATE_APPROVED that are not yet FINAL.", resultsSenate),
    makeException("unassigned-courses", "COURSE_ALLOCATION", "MODERATE",
      `Courses with no ${CURRENT_SESSION} allocation`,
      `${unassignedCourses} of ${courseCount} courses have no course allocation this session.`, unassignedCourses),
    makeException("missing-coordinators", "LEVEL_COORDINATION", "MODERATE",
      "Departments without a level coordinator",
      "Departments missing a current-session Level Coordinator.", departmentsWithoutCoordinators.length),
    makeException("missing-advisers", "LEVEL_COORDINATION", "LOW",
      "Departments without an active level adviser",
      "Departments missing an active Level Adviser assignment.", departmentsWithoutAdvisers.length),
    makeException("open-appeals", "STUDENT_WELFARE", "MODERATE",
      "Open student appeals",
      "Grade / misconduct appeals still awaiting a decision.", openAppeals),
    makeException("open-misconduct", "DISCIPLINE", "HIGH",
      "Open misconduct cases",
      "Misconduct cases that have not been closed.", openMisconduct),
    makeException("failed-result-files", "EXAMS_RECORDS", "HIGH",
      "Failed result file uploads",
      "Lecturer CSV uploads that failed or only partially processed.", failedResultFiles),
    makeException("pg-without-supervisor", "PG_RESEARCH", "HIGH",
      "PG students without a supervisor",
      "Postgraduate students with no supervisor assignment on record.", pgWithoutSupervisor),
    makeException("clearance-in-progress", "GRAD_CLEARANCE", "LOW",
      "Clearance requests in progress",
      "Graduation/SIWES clearance still being signed off.", clearanceInProgress),
    makeException("admissions-pipeline", "ADMISSIONS", "LOW",
      "Applications in the screening pipeline",
      "Applications at SUBMITTED / SCREENING / PENDING_CAPS.", admissionsPipeline),
    makeException("overdue-invoices", "FEES", "MODERATE",
      "Overdue invoices",
      "Open student invoices past their due date.", overdueInvoices),
    makeException("transcripts-pending", "TRANSCRIPT", "LOW",
      "Transcript requests not yet issued",
      "Transcript requests still queued or processing.", transcriptsPending),
    makeException("hostel-pending", "ACCOMMODATION", "LOW",
      "Hostel applications pending",
      "Hostel applications waiting for allocation.", hostelPending),
    makeException("dpo-open", "DPO", "MODERATE",
      "Data subject requests outstanding",
      "DPO requests not yet completed.", dpoOpen),
  ];

  return exceptions
    .filter((e) => e.count > 0)
    .sort((a, b) => {
      const bySeverity = EXCEPTION_SEVERITY_RANK[b.severity] - EXCEPTION_SEVERITY_RANK[a.severity];
      return bySeverity !== 0 ? bySeverity : b.count - a.count;
    });
}

// ---------------------------------------------------------------------------
// Faculty & department comparison
// ---------------------------------------------------------------------------

export interface FacultyComparisonRow {
  faculty: string;
  departments: number;
  students: number;
  staff: number;
  programmes: number;
  resultsPending: number;
  pendingClearance: number;
  pipelineApplications: number;
}

export async function facultyComparison(): Promise<FacultyComparisonRow[]> {
  const faculties = distinctValues<string>(
    await prisma.user.findMany({ where: { faculty: { not: null } }, select: { faculty: true }, distinct: ["faculty"] }),
    "faculty",
  ).sort((a, b) => a.localeCompare(b));

  const rows = await Promise.all(
    faculties.map(async (faculty) => {
      const stats = await facultyStats(faculty);
      return {
        faculty,
        departments: stats.scope.departments.length,
        students: stats.students.total,
        staff: stats.staff.total,
        programmes: stats.programmes,
        resultsPending:
          stats.results.submitted +
          stats.results.hodApproved +
          stats.results.senateApproved,
        pendingClearance: stats.pendingClearance,
        pipelineApplications: stats.applications.inPipeline,
      };
    }),
  );
  return rows;
}

export interface DepartmentComparisonRow {
  department: string;
  faculty: string | null;
  students: number;
  lecturers: number;
  programmes: number;
  coursesAssigned: number;
  coordinators: number;
  advisers: number;
  pendingResults: number;
}

export async function departmentComparison(): Promise<DepartmentComparisonRow[]> {
  const [studentsByDept, lecturersByDept, coordinatorsByDept, advisersByDept, currentAssignments, assignmentsDeptMap] =
    await Promise.all([
      prisma.user.groupBy({ by: ["department"], where: { role: "STUDENT" }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["department"], where: { role: "LECTURER" }, _count: { _all: true } }),
      prisma.levelCoordinator.groupBy({
        by: ["department"],
        where: { academicSession: CURRENT_SESSION },
        _count: { _all: true },
      }),
      prisma.levelAdvisorAssignment.groupBy({
        by: ["department"],
        where: { academicSession: CURRENT_SESSION, status: "ACTIVE" },
        _count: { _all: true },
      }),
      prisma.courseAssignment.groupBy({
        by: ["department"],
        where: { academicSession: CURRENT_SESSION },
        _count: { _all: true },
      }),
      prisma.courseAssignment.findMany({
        where: { academicSession: CURRENT_SESSION },
        select: { courseCode: true, department: true },
        distinct: ["courseCode"],
      }),
    ]);

  const codeToDept = new Map(assignmentsDeptMap.map((r) => [r.courseCode, r.department]));
  const pendingResults = codeToDept.size
    ? await prisma.result.findMany({
        where: { gradeStatus: "SUBMITTED", course: { code: { in: [...codeToDept.keys()] } } },
        select: { course: { select: { code: true } } },
      })
    : [];

  const programmesRows = await prisma.user.findMany({
    where: { role: "STUDENT", programmeId: { not: null }, department: { not: null } },
    select: { department: true, programmeId: true },
    distinct: ["department", "programmeId"],
  });

  const mapCount = <T extends { department: string | null; _count: { _all: number } }>(rows: T[]) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.department == null) continue;
      map.set(r.department, (map.get(r.department) ?? 0) + r._count._all);
    }
    return map;
  };

  const studentsMap = mapCount(studentsByDept);
  const lecturersMap = mapCount(lecturersByDept);
  const coordinatorsMap = mapCount(coordinatorsByDept);
  const advisersMap = mapCount(advisersByDept);
  const assignedMap = mapCount(currentAssignments);

  const programmesMap = new Map<string, number>();
  for (const p of programmesRows) {
    if (p.department == null) continue;
    programmesMap.set(p.department, (programmesMap.get(p.department) ?? 0) + 1);
  }

  const pendingByDept = new Map<string, number>();
  for (const r of pendingResults) {
    const dept = codeToDept.get(r.course.code);
    if (!dept) continue;
    pendingByDept.set(dept, (pendingByDept.get(dept) ?? 0) + 1);
  }

  const facultyByDept = new Map<string, string | null>();
  const staffRows = await prisma.user.findMany({
    where: { department: { not: null } },
    select: { department: true, faculty: true },
    distinct: ["department"],
  });
  for (const r of staffRows) facultyByDept.set(r.department as string, r.faculty);

  const allDepartments = new Set([
    ...studentsMap.keys(),
    ...lecturersMap.keys(),
    ...coordinatorsMap.keys(),
    ...advisersMap.keys(),
    ...assignedMap.keys(),
    ...programmesMap.keys(),
  ]);

  return [...allDepartments]
    .sort((a, b) => a.localeCompare(b))
    .map((department) => ({
      department,
      faculty: facultyByDept.get(department) ?? null,
      students: studentsMap.get(department) ?? 0,
      lecturers: lecturersMap.get(department) ?? 0,
      programmes: programmesMap.get(department) ?? 0,
      coursesAssigned: assignedMap.get(department) ?? 0,
      coordinators: coordinatorsMap.get(department) ?? 0,
      advisers: advisersMap.get(department) ?? 0,
      pendingResults: pendingByDept.get(department) ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Monitors
// ---------------------------------------------------------------------------

export interface CourseAllocationMonitor {
  totalCourses: number;
  assignedThisSession: number;
  unassigned: number;
  byFaculty: { faculty: string | null; assigned: number }[];
}

export async function courseAllocationMonitor(): Promise<CourseAllocationMonitor> {
  const [totalCourses, assignedThisSession, unassigned, byFaculty] = await Promise.all([
    prisma.course.count(),
    prisma.courseAssignment.count({ where: { academicSession: CURRENT_SESSION } }),
    prisma.course.count({ where: { assignments: { none: { academicSession: CURRENT_SESSION } } } }),
    prisma.courseAssignment.groupBy({
      by: ["faculty"],
      where: { academicSession: CURRENT_SESSION },
      _count: { _all: true },
    }),
  ]);
  return {
    totalCourses,
    assignedThisSession,
    unassigned,
    byFaculty: byFaculty
      .map((r) => ({ faculty: r.faculty, assigned: r._count._all }))
      .sort((a, b) => b.assigned - a.assigned),
  };
}

export interface LevelCoordinationMonitor {
  departments: number;
  withCoordinator: number;
  withoutCoordinator: string[];
  coordinators: number;
  advisersActive: number;
  withoutAdviser: string[];
}

export async function levelCoordinationMonitor(): Promise<LevelCoordinationMonitor> {
  const [departmentsRows, coordinators, advisersActive, coordinatorDepts, adviserDepts] = await Promise.all([
    prisma.user.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ["department"] }),
    prisma.levelCoordinator.count({ where: { academicSession: CURRENT_SESSION } }),
    prisma.levelAdvisorAssignment.count({ where: { academicSession: CURRENT_SESSION, status: "ACTIVE" } }),
    prisma.levelCoordinator.findMany({
      where: { academicSession: CURRENT_SESSION },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.levelAdvisorAssignment.findMany({
      where: { academicSession: CURRENT_SESSION, status: "ACTIVE" },
      select: { department: true },
      distinct: ["department"],
    }),
  ]);
  const departments = distinctValues<string>(departmentsRows, "department");
  const covered = new Set(coordinatorDepts.map((d) => d.department));
  const adviserCovered = new Set(adviserDepts.map((d) => d.department));
  return {
    departments: departments.length,
    withCoordinator: covered.size,
    withoutCoordinator: departments.filter((d) => !covered.has(d)),
    coordinators,
    advisersActive,
    withoutAdviser: departments.filter((d) => !adviserCovered.has(d)),
  };
}

export interface ResultsPipeline {
  stages: { stage: string; count: number }[];
  total: number;
  pending: {
    id: string;
    studentName: string;
    regNo: string | null;
    courseCode: string;
    department: string | null;
    status: string;
    updatedAt: Date;
  }[];
}

export const RESULT_STAGE_ORDER: string[] = ["SUBMITTED", "HOD_APPROVED", "SENATE_APPROVED", "FINAL"];

// Pipeline rows for the current session/semester (in lock-step with the shared
// getResultPipelineStats helper used by the HoD, Dean and university views).
export async function resultsPipeline(limit = 20): Promise<ResultsPipeline> {
  const [pipeline, pending] = await Promise.all([
    getResultPipelineStats(),
    prisma.result.findMany({
      where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER, gradeStatus: { not: "FINAL" } },
      include: {
        user: { select: { fullName: true, registrationNo: true, department: true } },
        course: { select: { code: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);
  const stages = RESULT_STAGE_ORDER.map((stage) => {
    const s = stage as PipelineStage;
    return { stage: s, count: pipeline.byStage[s] };
  });
  const total = stages.reduce((acc, s) => acc + s.count, 0);
  return {
    stages,
    total,
    pending: pending.map((r) => ({
      id: r.id,
      studentName: r.user.fullName,
      regNo: r.user.registrationNo,
      courseCode: r.course.code,
      department: r.user.department,
      status: r.gradeStatus,
      updatedAt: r.updatedAt,
    })),
  };
}

export interface AdmissionsMonitor {
  total: number;
  byStatus: { status: string; count: number }[];
  offers: number;
  admitted: number;
  documentMismatches: number;
  pgByStatus: { status: string; count: number }[];
  recent: {
    id: string;
    name: string;
    programme: string;
    status: string;
    submittedAt: Date | null;
  }[];
}

export async function admissionsMonitor(limit = 12): Promise<AdmissionsMonitor> {
  const [total, byStatus, offers, admitted, documentMismatches, pgByStatus, recent] = await Promise.all([
    prisma.application.count(),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.admissionOffer.count(),
    prisma.application.count({ where: { status: "ADMITTED" } }),
    prisma.documentUpload.count({ where: { verificationStatus: "MISMATCH" } }),
    prisma.pGApplication.groupBy({ by: ["screeningStatus"], _count: { _all: true } }),
    prisma.application.findMany({
      include: { user: { select: { fullName: true } }, programme: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })).sort((a, b) => b.count - a.count),
    offers,
    admitted,
    documentMismatches,
    pgByStatus: pgByStatus.map((r) => ({ status: r.screeningStatus, count: r._count._all })),
    recent: recent.map((r) => ({
      id: r.id,
      name: r.user.fullName,
      programme: r.programme.name,
      status: r.status,
      submittedAt: r.submittedAt,
    })),
  };
}

export interface GraduationMonitor {
  clearance: { inProgress: number; completed: number; onHold: number };
  convocations: number;
  graduationRecords: number;
  awardClasses: { awardClass: string | null; count: number }[];
  nyscByStatus: { status: string; count: number }[];
}

export async function graduationMonitor(): Promise<GraduationMonitor> {
  const [clearanceRows, convocations, graduationRecords, awardClasses, nyscByStatus] = await Promise.all([
    prisma.clearanceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.convocation.count(),
    prisma.graduationRecord.count(),
    prisma.graduationRecord.groupBy({ by: ["awardClass"], _count: { _all: true } }),
    prisma.nYSCRecord.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const get = (rows: { status: string; _count: { _all: number } }[], s: string) =>
    rows.find((r) => r.status === s)?._count._all ?? 0;
  return {
    clearance: {
      inProgress: get(clearanceRows, "IN_PROGRESS"),
      completed: get(clearanceRows, "COMPLETED"),
      onHold: get(clearanceRows, "HOLD"),
    },
    convocations,
    graduationRecords,
    awardClasses: awardClasses.map((r) => ({ awardClass: r.awardClass, count: r._count._all })),
    nyscByStatus: nyscByStatus.map((r) => ({ status: r.status, count: r._count._all })),
  };
}

export interface PostgraduateMonitor {
  students: number;
  applications: number;
  byScreeningStatus: { status: string; count: number }[];
  supervision: number;
  theses: number;
  thesesByStatus: { status: string; count: number }[];
  withoutSupervisor: number;
}

export async function postgraduateMonitor(): Promise<PostgraduateMonitor> {
  const [students, applications, byScreeningStatus, supervision, theses, thesesByStatus, withoutSupervisor] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT", studentCategory: "POSTGRADUATE" } }),
      prisma.pGApplication.count(),
      prisma.pGApplication.groupBy({ by: ["screeningStatus"], _count: { _all: true } }),
      prisma.supervisorAssignment.count(),
      prisma.thesis.count(),
      prisma.thesis.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.count({ where: { role: "STUDENT", studentCategory: "POSTGRADUATE", pgStudentsSupervised: { none: {} } } }),
    ]);
  return {
    students,
    applications,
    byScreeningStatus: byScreeningStatus.map((r) => ({ status: r.screeningStatus, count: r._count._all })),
    supervision,
    theses,
    thesesByStatus: thesesByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    withoutSupervisor,
  };
}

export interface StaffOverview {
  total: number;
  academic: number;
  nonTeaching: number;
  active: number;
  byFaculty: { faculty: string | null; count: number }[];
  byDepartment: { department: string | null; count: number }[];
}

export async function staffOverview(): Promise<StaffOverview> {
  const [total, academic, nonTeaching, active, byFaculty, byDepartment] = await Promise.all([
    prisma.user.count({ where: { staffNo: { not: null } } }),
    prisma.user.count({ where: { staffNo: { not: null }, faculty: { not: "Non-Teaching" } } }),
    prisma.user.count({ where: { staffNo: { not: null }, faculty: "Non-Teaching" } }),
    prisma.user.count({ where: { staffNo: { not: null }, status: "ACTIVE" } }),
    prisma.user.groupBy({ by: ["faculty"], where: { staffNo: { not: null } }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["department"], where: { staffNo: { not: null } }, _count: { _all: true } }),
  ]);
  return {
    total,
    academic,
    nonTeaching,
    active,
    byFaculty: byFaculty.map((r) => ({ faculty: r.faculty, count: r._count._all })).sort((a, b) => b.count - a.count),
    byDepartment: byDepartment
      .map((r) => ({ department: r.department, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface StudentOverview {
  total: number;
  active: number;
  byCategory: { category: string | null; count: number }[];
  byStatus: { status: string; count: number }[];
  byDepartment: { department: string | null; count: number }[];
}

export async function studentOverview(): Promise<StudentOverview> {
  const [total, active, byCategory, byStatus, byDepartment] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.user.groupBy({ by: ["studentCategory"], where: { role: "STUDENT" }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["department"], where: { role: "STUDENT" }, _count: { _all: true } }),
  ]);
  return {
    total,
    active,
    byCategory: byCategory.map((r) => ({ category: r.studentCategory, count: r._count._all })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byDepartment: byDepartment
      .map((r) => ({ department: r.department, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface AuditActivityRow {
  id: string;
  action: string;
  module: string;
  targetType: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  createdAt: Date;
}

// Recent activity for the committee's audit view. The committee reads the
// hash-chained audit log; the chain verification itself lives in
// src/lib/audit.ts (verifyChain) so this stays consistent with the DPO view.
export async function recentGovernanceActivity(limit = 40): Promise<AuditActivityRow[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      module: true,
      targetType: true,
      actorUsername: true,
      actorRole: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    module: r.module,
    targetType: r.targetType,
    actorUsername: r.actorUsername,
    actorRole: r.actorRole,
    createdAt: r.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Governance reports (CSV export)
// ---------------------------------------------------------------------------

export interface GovernanceReportColumn {
  header: string;
  key: string;
}

export interface GovernanceReportData {
  slug: string;
  title: string;
  description: string;
  columns: GovernanceReportColumn[];
  rows: Record<string, unknown>[];
}

export const GOVERNANCE_REPORTS: {
  slug: string;
  title: string;
  description: string;
  category: string;
}[] = [
  { slug: "students-register", title: "Student Register", description: "Full student roster with category, department and status.", category: "Students" },
  { slug: "staff-register", title: "Staff Register", description: "Academic and non-teaching staff with faculty and department.", category: "Staff" },
  { slug: "results-pipeline", title: "Results Pipeline", description: "Results by approval stage and pending rows.", category: "Academic Affairs" },
  { slug: "course-allocation", title: "Course Allocation", description: "Current-session course allocations by faculty.", category: "Academic Affairs" },
  { slug: "level-coordination", title: "Level Coordination", description: "Level coordinators and advisers by department.", category: "Academic Affairs" },
  { slug: "admissions-pipeline", title: "Admissions Pipeline", description: "Applications by status and recent submissions.", category: "Student Affairs" },
  { slug: "clearance-progress", title: "Clearance Progress", description: "Graduation and SIWES clearance by status.", category: "Student Affairs" },
  { slug: "postgraduate-overview", title: "Postgraduate Overview", description: "PG students, applications, supervision and theses.", category: "Student Affairs" },
  { slug: "faculty-comparison", title: "Faculty Comparison", description: "Key indicators compared across faculties.", category: "Oversight" },
  { slug: "department-comparison", title: "Department Comparison", description: "Key indicators compared across departments.", category: "Oversight" },
  { slug: "exceptions-register", title: "Exceptions Register", description: "Flagged exceptions with severity and counts.", category: "Oversight" },
  { slug: "audit-trail", title: "Audit Trail", description: "Recent verified activity from the audit log.", category: "Oversight" },
];

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Pure CSV builder (shared by tests and the export route).
export function governanceCsv(columns: GovernanceReportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsvCell(r[c.key])).join(","));
  return [header, ...body].join("\n");
}

export async function buildGovernanceReport(
  slug: string,
): Promise<GovernanceReportData | null> {
  const report = GOVERNANCE_REPORTS.find((r) => r.slug === slug);
  if (!report) return null;

  switch (slug) {
    case "students-register": {
      const rows = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: { registrationNo: true, username: true, fullName: true, studentCategory: true, department: true, status: true },
        orderBy: [{ department: "asc" }, { fullName: "asc" }],
      });
      return {
        ...report,
        columns: [
          { header: "Registration No", key: "registrationNo" },
          { header: "Username", key: "username" },
          { header: "Full Name", key: "fullName" },
          { header: "Category", key: "studentCategory" },
          { header: "Department", key: "department" },
          { header: "Status", key: "status" },
        ],
        rows,
      };
    }
    case "staff-register": {
      const rows = await prisma.user.findMany({
        where: { staffNo: { not: null } },
        select: { staffNo: true, username: true, fullName: true, faculty: true, department: true, role: true, status: true },
        orderBy: [{ faculty: "asc" }, { department: "asc" }, { fullName: "asc" }],
      });
      return {
        ...report,
        columns: [
          { header: "Staff No", key: "staffNo" },
          { header: "Username", key: "username" },
          { header: "Full Name", key: "fullName" },
          { header: "Faculty", key: "faculty" },
          { header: "Department", key: "department" },
          { header: "Role", key: "role" },
          { header: "Status", key: "status" },
        ],
        rows,
      };
    }
    case "results-pipeline": {
      const pipeline = await resultsPipeline(200);
      const rows = pipeline.pending.map((r) => ({
        studentName: r.studentName,
        regNo: r.regNo,
        courseCode: r.courseCode,
        department: r.department,
        stage: r.status,
        updatedAt: r.updatedAt.toISOString(),
      }));
      return {
        ...report,
        columns: [
          { header: "Student", key: "studentName" },
          { header: "Reg No", key: "regNo" },
          { header: "Course", key: "courseCode" },
          { header: "Department", key: "department" },
          { header: "Stage", key: "stage" },
          { header: "Updated At", key: "updatedAt" },
        ],
        rows,
      };
    }
    case "course-allocation": {
      const monitor = await courseAllocationMonitor();
      const rows = monitor.byFaculty.map((r) => ({ faculty: r.faculty ?? "(unassigned)", assigned: r.assigned }));
      return {
        ...report,
        columns: [
          { header: "Faculty", key: "faculty" },
          { header: "Courses Assigned", key: "assigned" },
        ],
        rows,
      };
    }
    case "level-coordination": {
      const [coordinators, advisers] = await Promise.all([
        prisma.levelCoordinator.findMany({
          where: { academicSession: CURRENT_SESSION },
          include: { coordinator: { select: { fullName: true, staffNo: true } } },
          orderBy: [{ department: "asc" }, { level: "asc" }],
        }),
        prisma.levelAdvisorAssignment.findMany({
          where: { academicSession: CURRENT_SESSION, status: "ACTIVE" },
          include: { adviser: { select: { fullName: true, staffNo: true } } },
          orderBy: [{ department: "asc" }, { level: "asc" }],
        }),
      ]);
      const rows = coordinators.map((c) => ({
        department: c.department,
        level: c.level,
        role: "Coordinator",
        person: c.coordinator.fullName,
        staffNo: c.coordinator.staffNo,
      }));
      const adviserRows = advisers.map((a) => ({
        department: a.department,
        level: a.level,
        role: "Adviser",
        person: a.adviser.fullName,
        staffNo: a.adviser.staffNo,
      }));
      return {
        ...report,
        columns: [
          { header: "Department", key: "department" },
          { header: "Level", key: "level" },
          { header: "Role", key: "role" },
          { header: "Person", key: "person" },
          { header: "Staff No", key: "staffNo" },
        ],
        rows: [...rows, ...adviserRows],
      };
    }
    case "admissions-pipeline": {
      const monitor = await admissionsMonitor(200);
      const rows = monitor.recent.map((r) => ({
        name: r.name,
        programme: r.programme,
        status: r.status,
        submittedAt: r.submittedAt?.toISOString() ?? "",
      }));
      return {
        ...report,
        columns: [
          { header: "Name", key: "name" },
          { header: "Programme", key: "programme" },
          { header: "Status", key: "status" },
          { header: "Submitted At", key: "submittedAt" },
        ],
        rows,
      };
    }
    case "clearance-progress": {
      const rows = await prisma.clearanceRequest.findMany({
        include: { user: { select: { fullName: true, registrationNo: true, department: true } } },
        orderBy: { submittedAt: "desc" },
        take: 200,
      });
      return {
        ...report,
        columns: [
          { header: "Name", key: "name" },
          { header: "Reg No", key: "regNo" },
          { header: "Department", key: "department" },
          { header: "Type", key: "clearanceType" },
          { header: "Status", key: "status" },
          { header: "Submitted At", key: "submittedAt" },
        ],
        rows: rows.map((r) => ({
          name: r.user.fullName,
          regNo: r.user.registrationNo,
          department: r.user.department,
          clearanceType: r.clearanceType,
          status: r.status,
          submittedAt: r.submittedAt.toISOString(),
        })),
      };
    }
    case "postgraduate-overview": {
      const monitor = await postgraduateMonitor();
      return {
        ...report,
        columns: [
          { header: "PG Students", key: "students" },
          { header: "Applications", key: "applications" },
          { header: "Supervision Assignments", key: "supervision" },
          { header: "Theses", key: "theses" },
          { header: "Without Supervisor", key: "withoutSupervisor" },
        ],
        rows: [
          {
            students: monitor.students,
            applications: monitor.applications,
            supervision: monitor.supervision,
            theses: monitor.theses,
            withoutSupervisor: monitor.withoutSupervisor,
          },
        ],
      };
    }
    case "faculty-comparison": {
      const rows = await facultyComparison();
      return {
        ...report,
        columns: [
          { header: "Faculty", key: "faculty" },
          { header: "Departments", key: "departments" },
          { header: "Students", key: "students" },
          { header: "Staff", key: "staff" },
          { header: "Programmes", key: "programmes" },
          { header: "Results Pending", key: "resultsPending" },
          { header: "Clearance In Progress", key: "pendingClearance" },
          { header: "Pipeline Applications", key: "pipelineApplications" },
        ],
        rows: rows.map((r) => ({ ...r })),
      };
    }
    case "department-comparison": {
      const rows = await departmentComparison();
      return {
        ...report,
        columns: [
          { header: "Department", key: "department" },
          { header: "Faculty", key: "faculty" },
          { header: "Students", key: "students" },
          { header: "Lecturers", key: "lecturers" },
          { header: "Programmes", key: "programmes" },
          { header: "Courses Assigned", key: "coursesAssigned" },
          { header: "Coordinators", key: "coordinators" },
          { header: "Advisers", key: "advisers" },
          { header: "Pending Results", key: "pendingResults" },
        ],
        rows: rows.map((r) => ({ ...r })),
      };
    }
    case "exceptions-register": {
      const rows = await governanceExceptions();
      return {
        ...report,
        columns: [
          { header: "Severity", key: "severity" },
          { header: "Category", key: "category" },
          { header: "Title", key: "title" },
          { header: "Detail", key: "detail" },
          { header: "Count", key: "count" },
        ],
        rows: rows.map((r) => ({ ...r })),
      };
    }
    case "audit-trail": {
      const rows = await recentGovernanceActivity(200);
      return {
        ...report,
        columns: [
          { header: "Timestamp", key: "createdAt" },
          { header: "Action", key: "action" },
          { header: "Module", key: "module" },
          { header: "Target", key: "targetType" },
          { header: "Actor", key: "actorUsername" },
          { header: "Role", key: "actorRole" },
        ],
        rows: rows.map((r) => ({
          createdAt: r.createdAt.toISOString(),
          action: r.action,
          module: r.module,
          targetType: r.targetType,
          actorUsername: r.actorUsername,
          actorRole: r.actorRole,
        })),
      };
    }
    default:
      return null;
  }
}
