// Level Adviser assignments — pure helpers + the resolution query used by the
// HoD/university admin assignment pages, the Level Adviser dashboard and the
// student view. The students' current level is derived from the admission year
// encoded in the first two digits of an undergraduate registration number
// (e.g. "23/012PHY/0343" was admitted in 2023); there is no level column.
import { prisma } from "@/lib/prisma";
import { departmentMaxLevel } from "@/lib/constants";

export const ADVISER_ASSIGNMENT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

// "99" → 1999, "26" → 2026
export function parseAdmissionYear(registrationNo: string | null): number | null {
  const m = /^(\d{2})/.exec((registrationNo ?? "").trim());
  if (!m) return null;
  const yy = Number(m[1]);
  return yy <= 70 ? 2000 + yy : 1900 + yy;
}

// First academic year of a session, e.g. "2025/2026" -> 2025.
export function sessionStartYear(session: string): number {
  const m = /^(\d{4})\//.exec(session.trim());
  return m ? Number(m[1]) : new Date().getFullYear();
}

// A student's current level for a session, derived from their admission year
// and capped at the highest level their department runs.
export function currentLevelForStudent(
  registrationNo: string | null,
  department: string,
  academicSession: string,
): number {
  const admitted = parseAdmissionYear(registrationNo);
  if (admitted === null) return 100;
  const level = 100 + (sessionStartYear(academicSession) - admitted) * 100;
  return Math.max(100, Math.min(level, departmentMaxLevel(department)));
}

export type LevelAdviserInfo = {
  assignmentId: string;
  level: number;
  department: string;
  programmeId: string | null;
  programmeName: string | null;
  academicSession: string;
  adviserId: string;
  adviserName: string;
  staffNo: string | null;
  notes: string | null;
};

function toInfo(a: {
  id: string;
  level: number;
  department: string;
  programmeId: string | null;
  academicSession: string;
  notes: string | null;
  adviser: { id: string; fullName: string; staffNo: string | null };
  programme: { name: string } | null;
}): LevelAdviserInfo {
  return {
    assignmentId: a.id,
    level: a.level,
    department: a.department,
    programmeId: a.programmeId,
    programmeName: a.programme?.name ?? null,
    academicSession: a.academicSession,
    adviserId: a.adviser.id,
    adviserName: a.adviser.fullName,
    staffNo: a.adviser.staffNo,
    notes: a.notes,
  };
}

// Resolve the ACTIVE adviser for an exact scope (department-wide, or one
// programme within the department).
export async function resolveLevelAdviser(opts: {
  department: string;
  level: number;
  academicSession: string;
  programmeId?: string | null;
}): Promise<LevelAdviserInfo | null> {
  const assignment = await prisma.levelAdvisorAssignment.findFirst({
    where: {
      department: opts.department,
      level: opts.level,
      academicSession: opts.academicSession,
      status: ADVISER_ASSIGNMENT_STATUS.ACTIVE,
      ...(opts.programmeId ? { programmeId: opts.programmeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      adviser: { select: { id: true, fullName: true, staffNo: true } },
      programme: { select: { name: true } },
    },
  });
  return assignment ? toInfo(assignment) : null;
}

// Resolve the adviser a student is under: a programme-scoped assignment takes
// precedence over the department-wide one for the student's level.
export async function resolveStudentLevelAdviser(opts: {
  department: string;
  programmeId?: string | null;
  level: number;
  academicSession: string;
}): Promise<LevelAdviserInfo | null> {
  const scoped = await resolveLevelAdviser({
    department: opts.department,
    level: opts.level,
    academicSession: opts.academicSession,
    programmeId: opts.programmeId ?? undefined,
  });
  if (scoped) return scoped;
  return resolveLevelAdviser({
    department: opts.department,
    level: opts.level,
    academicSession: opts.academicSession,
  });
}
