import { prisma } from "@/lib/prisma";
import { getCoursesUG } from "@/lib/sheets";

// The Head of Department workspace is reached by the HOD role. landingForRole()
// maps it to /portal/hod; these helpers keep page guards and server actions
// consistent with that.
export const HOD_ROLES = ["HOD"] as const;

export function isHodRole(role: string): boolean {
  return HOD_ROLES.includes(role as (typeof HOD_ROLES)[number]);
}

// Distinct course codes ever allocated to a department. Used to scope HoD
// views (results, files, students) to courses that belong to the department.
export async function departmentCourseCodes(department: string): Promise<string[]> {
  const assignments = await prisma.courseAssignment.findMany({
    where: { department },
    select: { courseCode: true },
    distinct: ["courseCode"],
    orderBy: { courseCode: "asc" },
  });
  return assignments.map((a) => a.courseCode);
}

// Programme ids attached to a department, derived from the students currently
// in it. Programmes have no department column, so the student roster is the
// data-driven bridge (the same approach facultyProgrammeIds() uses for the
// Dean's faculty scope). Used to scope the HoD's programme picker.
export async function departmentProgrammeIds(department: string): Promise<string[]> {
  if (!department) return [];
  const rows = await prisma.user.findMany({
    where: { role: "STUDENT", department, programmeId: { not: null } },
    select: { programmeId: true },
    distinct: ["programmeId"],
  });
  return rows
    .map((r) => r.programmeId)
    .filter((p): p is string => p != null)
    .sort();
}

// Server-side scope check for HoD course-offering work: a course belongs to
// the HoD's department only when the master catalogue (Courses_UG sheet) lists
// it under the HoD's faculty + hosting department. Faculty/department are
// always derived from the session, never from the client.
export async function courseInDepartmentCatalogue(
  faculty: string | null | undefined,
  department: string | null | undefined,
  courseCode: string,
): Promise<boolean> {
  if (!faculty || !department || !courseCode) return false;
  const catalogue = await getCoursesUG();
  const entry = catalogue.find((c) => c.code === courseCode);
  return entry?.faculty === faculty && entry.hostingDepartment === department;
}

// Pending (SUBMITTED) result rows visible to a HoD on the shared results
// pipeline, scoped to the courses allocated to the HoD's department. This is
// the same departmental boundary the HoD approvals queue uses
// (departmentCourseCodes), so the shared page and the queue stay in lock-step.
export async function hodPendingResultRows(
  user: { department?: string | null },
  opts: { take?: number } = {},
) {
  const codes = user.department ? await departmentCourseCodes(user.department) : [];
  return prisma.result.findMany({
    where: { gradeStatus: "SUBMITTED", course: { code: { in: codes } } },
    orderBy: { updatedAt: "desc" },
    take: opts.take ?? 50,
    include: { course: true, user: true, submittedBy: true },
  });
}

// Appeals visible to a HoD: only appeals filed by students in the HoD's own
// department. The Exams & Records unit keeps an unscoped register.
export async function hodScopedAppeals(
  user: { department?: string | null },
  opts: { take?: number } = {},
) {
  return prisma.appeal.findMany({
    where: { user: { department: user.department ?? "" } },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    include: { user: true },
  });
}
