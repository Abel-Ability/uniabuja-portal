import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_SEMESTER,
  CURRENT_SESSION,
  departmentMaxLevel,
  REGISTRATION_STATUS_LABELS,
  SEMESTER_LABELS,
  studentLevel,
} from "@/lib/constants";
import { sessionStartYear } from "@/lib/level-advisers";

// ---------------------------------------------------------------------------
// Registration finalisation helpers. A student course registration is an
// official academic transaction (Registration header) owning one reference, one
// status, one finalisation/lock event and one authoritative total-unit value.
// All helpers here are server-side; none of them ever trusts the client.
// ---------------------------------------------------------------------------

// Human-readable, immutable, authoritative prefix for a session, e.g. CR-2025-.
export function registrationReferencePrefix(academicSession: string): string {
  return `CR-${sessionStartYear(academicSession)}-`;
}

// True only when the header is genuinely finalised AND locked in the database.
export function isRegistrationFinalised(
  r: { status?: string | null; lockedAt?: Date | null } | null | undefined,
): boolean {
  return Boolean(r && (r.status === "FINALIZED" || r.status === "LOCKED") && r.lockedAt);
}

export function registrationStatusLabel(status: string, locked: boolean): string {
  if (locked && (status === "FINALIZED" || status === "LOCKED")) return "FINAL / LOCKED";
  return REGISTRATION_STATUS_LABELS[status] ?? status;
}

// Next sequential reference for a session, computed transactionally. The caller
// runs this inside an interactive transaction; the unique index on
// Registration.registrationReference makes concurrent submissions safe — a
// colliding insert aborts the transaction and the caller retries with a fresh
// sequence value.
export async function nextRegistrationReference(
  tx: Prisma.TransactionClient,
  academicSession: string,
): Promise<string> {
  const prefix = registrationReferencePrefix(academicSession);
  const last = await tx.registration.findFirst({
    where: { registrationReference: { startsWith: prefix } },
    orderBy: { registrationReference: "desc" },
    select: { registrationReference: true },
  });
  const lastNum = last ? parseInt(last.registrationReference.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastNum) ? lastNum : 0) + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export type RegistrationView = {
  reference?: string | null;
  academicSession?: string;
  semester?: number;
};

// Ownership-scoped retrieval. The authenticated user's id is always applied to
// the query, so a student can never read another student's registration even if
// they tamper with the reference or session in the URL. Historical records are
// retrieved by their own session/semester — never by CURRENT_SESSION.
export async function getRegistrationForView(
  user: { id: string },
  opts: RegistrationView = {},
) {
  const where = opts.reference
    ? { userId: user.id, registrationReference: opts.reference }
    : {
        userId: user.id,
        academicSession: opts.academicSession ?? CURRENT_SESSION,
        semester: opts.semester ?? CURRENT_SEMESTER,
      };
  return prisma.registration.findFirst({
    where,
    include: {
      courseRegistrations: {
        include: { course: true },
        orderBy: { course: { code: "asc" } },
      },
    },
  });
}

export type RegistrationDocumentCourse = { code: string; title: string; units: number };

export type RegistrationDocument = {
  fullName: string;
  registrationNo: string;
  faculty: string;
  department: string;
  programmeId: string;
  level: number | null;
  academicSession: string;
  semester: number;
  semesterLabel: string;
  reference: string;
  totalUnits: number;
  status: string;
  statusLabel: string;
  finalisedAt: string | null;
  submittedAt: string;
  courses: RegistrationDocumentCourse[];
};

// Pure projection of a finalised registration into the official document shape
// used by the View/Print Registration page. All totals come from the stored
// header, never recomputed from client input.
export function buildRegistrationDocument(
  user: {
    fullName: string;
    registrationNo?: string | null;
    username: string;
    faculty?: string | null;
    department?: string | null;
    programmeId?: string | null;
  },
  registration: {
    registrationReference: string;
    academicSession: string;
    semester: number;
    totalUnits: number;
    status: string;
    finalisedAt: Date | null;
    submittedAt: Date;
    courseRegistrations: { course: { code: string; title: string; units: number } }[];
  },
): RegistrationDocument {
  const locked = isRegistrationFinalised(registration);
  return {
    fullName: user.fullName,
    registrationNo: user.registrationNo ?? user.username,
    faculty: user.faculty ?? "—",
    department: user.department ?? "—",
    programmeId: user.programmeId ?? "—",
    level: studentLevel(user.registrationNo, departmentMaxLevel(user.department)),
    academicSession: registration.academicSession,
    semester: registration.semester,
    semesterLabel: SEMESTER_LABELS[registration.semester] ?? `Semester ${registration.semester}`,
    reference: registration.registrationReference,
    totalUnits: registration.totalUnits,
    status: registration.status,
    statusLabel: registrationStatusLabel(registration.status, locked),
    finalisedAt: registration.finalisedAt ? registration.finalisedAt.toISOString() : null,
    submittedAt: registration.submittedAt.toISOString(),
    courses: registration.courseRegistrations.map((r) => ({
      code: r.course.code,
      title: r.course.title,
      units: r.course.units,
    })),
  };
}
