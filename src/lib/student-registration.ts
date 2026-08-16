import { prisma } from "@/lib/prisma";
import {
  CURRENT_SESSION,
  CURRENT_SEMESTER,
  departmentMaxLevel,
  studentLevel,
} from "@/lib/constants";

// Minimum total credit units a student must select for registration.
export const MIN_REGISTRATION_UNITS = 15;

// The academic context that determines eligibility for one student. The level
// is derived from the registration number using the established application
// logic (constants.studentLevel) — the CourseOffering.level is authoritative
// for eligibility, never the client.
export type StudentRegistrationContext = {
  level: number | null;
  programmeId: string | null;
  academicSession: string;
  semester: number;
};

export function studentRegistrationContext(user: {
  registrationNo?: string | null;
  department?: string | null;
  programmeId?: string | null;
}): StudentRegistrationContext {
  return {
    level: studentLevel(user.registrationNo, departmentMaxLevel(user.department)),
    programmeId: user.programmeId ?? null,
    academicSession: CURRENT_SESSION,
    semester: CURRENT_SEMESTER,
  };
}

// Programme filter used by every eligibility query. A CourseOffering with a
// NULL programmeId is a department/general offering (available to the whole
// department, matching the HOD Course Offerings semantics); a specific
// programmeId only matches students on that programme.
function programmeFilter(programmeId: string | null) {
  return programmeId
    ? { OR: [{ programmeId: null }, { programmeId }] }
    : { programmeId: null };
}

export type EligibleOffering = Awaited<
  ReturnType<typeof getEligibleStudentCourseOfferings>
>[number];

// All ACTIVE CourseOfferings a student may register for this session/semester:
// matching programme scope, level and semester. Never exposes an offering the
// student is not authorized to register for.
export async function getEligibleStudentCourseOfferings(user: {
  registrationNo?: string | null;
  department?: string | null;
  programmeId?: string | null;
}) {
  const ctx = studentRegistrationContext(user);
  if (ctx.level === null) return [];

  const offerings = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      academicSession: ctx.academicSession,
      semester: ctx.semester,
      level: ctx.level,
      ...programmeFilter(ctx.programmeId),
    },
    include: { course: true },
    orderBy: { course: { code: "asc" } },
  });

  // A course can have both a department-wide and a programme-specific offering
  // for the same context; dedupe by course for display.
  const seen = new Set<string>();
  return offerings.filter((o) => {
    if (seen.has(o.courseId)) return false;
    seen.add(o.courseId);
    return true;
  });
}

// True only when the authenticated student's context has an ACTIVE offering for
// the given course this session/semester. Used by both registration actions so
// the server independently re-validates every submitted courseId.
export async function eligibleOfferingForStudent(
  user: {
    registrationNo?: string | null;
    department?: string | null;
    programmeId?: string | null;
  },
  courseId: string,
) {
  const ctx = studentRegistrationContext(user);
  if (ctx.level === null) return null;

  return prisma.courseOffering.findFirst({
    where: {
      courseId,
      status: "ACTIVE",
      academicSession: ctx.academicSession,
      semester: ctx.semester,
      level: ctx.level,
      ...programmeFilter(ctx.programmeId),
    },
    include: { course: true },
  });
}
