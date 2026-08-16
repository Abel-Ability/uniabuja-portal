"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { normaliseIdentifier } from "@/lib/constants";

export type LecturerActionResult = {
  error?: string;
  success?: string;
  summary?: {
    rowCount: number;
    processed: number;
    failed: number;
    errors: string[];
  };
};

export type LecturerActionResultAction = (
  prev: LecturerActionResult | null,
  formData: FormData,
) => Promise<LecturerActionResult>;

const MAX_FILE_BYTES = 512 * 1024;
const MAX_ROWS = 500;
const SESSION_RE = /^\d{4}\/\d{4}$/;

function gradeForTotal(total: number): string {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  if (total >= 40) return "E";
  return "F";
}

// Parses CSV-ish text (commas, semicolons or tabs; quoted fields allowed).
function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && raw[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const headerKey = (h: string) => h.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

// Maps CSV headers to the three-column format MATRIC_NO, CA, EXAM. Returns
// null when any of those columns is missing or an unexpected column (e.g.
// NAME, TOTAL, GRADE) is present — TOTAL and GRADE are always computed here.
function mapColumns(headers: string[]): { matric: number; ca: number; exam: number } | null {
  let matric = -1;
  let ca = -1;
  let exam = -1;
  for (const [i, h] of headers.entries()) {
    const k = headerKey(h);
    if (k === "") continue; // tolerate trailing/blank padding cells
    if (k === "MATRICNO" || k === "MATRICNUMBER" || k.includes("MATRIC") || k === "REGNO" || k === "REGNUMBER" || k === "REGISTRATIONNO") {
      if (matric === -1) matric = i;
    } else if (k === "CA" || k === "CACONTINUOUS" || k === "CONTINUOUSASSESSMENT") {
      if (ca === -1) ca = i;
    } else if (k === "EXAM" || k === "EXAMSCORE") {
      if (exam === -1) exam = i;
    } else {
      return null;
    }
  }
  if (matric === -1 || ca === -1 || exam === -1) return null;
  return { matric, ca, exam };
}

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function resultKindFrom(kind: string): string {
  return kind === "BACKLOG" ? "BACKLOG" : "NORMAL";
}

// True when the user is the main lecturer or a co-lecturer on the course for
// the given session. Regular semesters (1/2) are scoped by course + session +
// semester; backlog (semester 0) work is scoped by course + session only,
// mirroring the backlog upload form and the existing assignment lookup.
async function isAssignedToCourse(
  userId: string,
  courseCode: string,
  academicSession: string,
  semester: number,
): Promise<boolean> {
  const assignment = await prisma.courseAssignment.findFirst({
    where: {
      courseCode,
      academicSession,
      ...(semester > 0 ? { semester } : {}),
      OR: [{ lecturerId: userId }, { teamMembers: { some: { lecturerId: userId } } }],
    },
    select: { id: true },
  });
  return assignment !== null;
}

// Shared pipeline for both Post Results (NORMAL) and Post Backlog Results.
async function postResults(kind: "NORMAL" | "BACKLOG", formData: FormData): Promise<LecturerActionResult> {
  const m = await metaFromHeaders(await headers());
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") return { error: "Only lecturers can post results." };

  const user = session.user;
  const courseCode = normaliseIdentifier(String(formData.get("courseCode") ?? ""));
  const academicSession = String(formData.get("session") ?? "");
  const semesterRaw = String(formData.get("semester") ?? "");
  const caMaxRaw = String(formData.get("caMax") ?? "");
  const contentType = String(formData.get("contentType") ?? "");
  const file = formData.get("file");

  if (!courseCode) return { error: "Select a course." };
  if (!SESSION_RE.test(academicSession)) return { error: "Select an academic session." };
  const semester = Number(semesterRaw);
  if (!Number.isInteger(semester) || semester < 0 || semester > 2) {
    return { error: "Select a semester." };
  }
  const caMax = Number(caMaxRaw);
  if (![20, 30, 40, 50, 60, 70].includes(caMax)) return { error: "Select a CA maximum." };
  if (!["CA", "EXAM", "BOTH"].includes(contentType)) return { error: "Select a content type." };
  if (!(file instanceof File) || !file.name) return { error: "Choose a CSV file." };
  if (file.size > MAX_FILE_BYTES) return { error: "File must be under 512 KB." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "Only .csv files are accepted." };

  // The lecturer must actually be assigned this course for the session — as
  // the main lecturer or a co-lecturer (the same authorization the single-row
  // path and the dashboard use). The assignment is derived server-side; the
  // course/session/semester from the form are never trusted on their own.
  const assigned = await isAssignedToCourse(
    user.id,
    courseCode,
    academicSession,
    kind === "BACKLOG" ? 0 : semester,
  );
  if (!assigned) {
    return {
      error:
        kind === "BACKLOG"
          ? `You are not assigned ${courseCode} for ${academicSession} (backlog).`
          : `You are not assigned ${courseCode} for ${academicSession}, semester ${semester}.`,
    };
  }

  const course = await prisma.course.findUnique({ where: { code: courseCode } });
  if (!course) {
    return { error: `Course ${courseCode} is not on the courses list yet. Add it before posting results.` };
  }

  const raw = await file.text();
  const parsed = parseCsv(raw);
  if (parsed.length < 2) return { error: "The CSV appears to be empty." };
  const dataRows = parsed.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) return { error: "No student rows found in the CSV." };
  if (dataRows.length > MAX_ROWS) return { error: `CSV has ${dataRows.length} rows; the limit is ${MAX_ROWS}.` };

  const cols = mapColumns(parsed[0]);
  if (!cols) {
    return {
      error:
        "The CSV must have exactly three columns: MATRIC_NO, CA and EXAM. TOTAL and GRADE are computed automatically.",
    };
  }

  const errors: string[] = [];
  let processed = 0;

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    const rowNo = i + 2;
    const matric = row[cols.matric]?.trim() ?? "";

    if (!matric) {
      errors.push(`Row ${rowNo}: missing matric number.`);
      continue;
    }

    const ca = num(row[cols.ca]);
    const exam = num(row[cols.exam]);

    if (contentType === "CA" && (ca === null || ca < 0 || ca > caMax)) {
      errors.push(`Row ${rowNo}: CA must be 0–${caMax}.`);
      continue;
    }
    if (contentType === "EXAM" && (exam === null || exam < 0 || exam > 100)) {
      errors.push(`Row ${rowNo}: EXAM must be 0–100.`);
      continue;
    }
    if (contentType === "BOTH" && (ca === null || ca < 0 || ca > caMax)) {
      errors.push(`Row ${rowNo}: CA must be 0–${caMax}.`);
      continue;
    }
    if (contentType === "BOTH" && (exam === null || exam < 0 || exam > 100)) {
      errors.push(`Row ${rowNo}: EXAM must be 0–100.`);
      continue;
    }
    if ((ca ?? 0) + (exam ?? 0) > 100) {
      errors.push(`Row ${rowNo}: CA + EXAM must not exceed 100.`);
      continue;
    }

    const total = (ca ?? 0) + (exam ?? 0);
    const grade = gradeForTotal(total);

    const mat = normaliseIdentifier(matric);
    const student = await prisma.user.findFirst({
      where: {
        role: "STUDENT",
        OR: [{ registrationNo: mat }, { username: mat }],
      },
    });
    if (!student) {
      errors.push(`Row ${rowNo}: no student found for ${matric}.`);
      continue;
    }

    // A result row is only legitimate for a student who actually registered the
    // course this session/semester. Backlog rows (semester 0) have no
    // registration by design and are kept apart from the regular batch by
    // resultKind, so only regular uploads are checked here.
    if (kind === "NORMAL") {
      const registration = await prisma.courseRegistration.findFirst({
        where: {
          userId: student.id,
          courseId: course.id,
          academicSession,
          semester,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!registration) {
        errors.push(
          `Row ${rowNo}: ${matric} is not registered for ${courseCode} in ${academicSession}, semester ${semester}.`,
        );
        continue;
      }
    }

    await prisma.result.upsert({
      where: {
        userId_courseId_academicSession_semester: {
          userId: student.id,
          courseId: course.id,
          academicSession,
          semester,
        },
      },
      create: {
        userId: student.id,
        courseId: course.id,
        academicSession,
        semester,
        resultKind: resultKindFrom(kind),
        caScore: ca ?? null,
        examScore: exam ?? null,
        total,
        grade,
        gradeStatus: "SUBMITTED",
        submittedById: user.id,
        published: false,
      },
      update: {
        caScore: ca ?? null,
        examScore: exam ?? null,
        total,
        grade,
        resultKind: resultKindFrom(kind),
        gradeStatus: "SUBMITTED",
        submittedById: user.id,
        approvedBy1Id: null,
        approvedBy2Id: null,
        approvedAt1: null,
        approvedAt2: null,
        published: false,
      },
    });
    processed += 1;
  }

  const failed = errors.length;
  const status = processed === 0 ? "FAILED" : failed === 0 ? "PROCESSED" : "PARTIAL";
  const resultFile = await prisma.resultFile.create({
    data: {
      lecturerId: user.id,
      kind: resultKindFrom(kind),
      academicSession,
      semester,
      courseCode,
      courseTitle: course.title,
      caMax,
      contentType,
      fileName: file.name,
      mimeType: file.type || "text/csv",
      sizeBytes: file.size,
      rawCsv: raw,
      rowCount: dataRows.length,
      processedCount: processed,
      failedCount: failed,
      status,
      errorSummary: failed > 0 ? errors.slice(0, 50).join("\n") : null,
    },
  });

  await writeAudit({
    action: "SUBMIT",
    module: "EXAMS_RECORDS",
    targetType: "RESULT_FILE",
    targetId: resultFile.id,
    before: null,
    after: { kind, academicSession, semester, courseCode, rowCount: dataRows.length, processed, failed },
    meta: m,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    sessionId: session.id,
  });

  const kindLabel = kind === "BACKLOG" ? "backlog" : "";
  if (processed === 0) {
    return {
      error: `No rows could be processed for ${courseCode}.`,
      summary: { rowCount: dataRows.length, processed, failed, errors },
    };
  }
  return {
    success: `${processed} ${kindLabel} result row${processed === 1 ? "" : "s"} posted for ${courseCode}.`,
    summary: { rowCount: dataRows.length, processed, failed, errors },
  };
}

export async function postResultsAction(
  _prev: LecturerActionResult | null,
  formData: FormData,
): Promise<LecturerActionResult> {
  return postResults("NORMAL", formData);
}

export async function postBacklogResultsAction(
  _prev: LecturerActionResult | null,
  formData: FormData,
): Promise<LecturerActionResult> {
  return postResults("BACKLOG", formData);
}

export async function requestResultCorrection(
  _prev: LecturerActionResult | null,
  formData: FormData,
): Promise<LecturerActionResult> {
  const m = await metaFromHeaders(await headers());
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") return { error: "Only lecturers can request corrections." };

  const user = session.user;
  const academicSession = String(formData.get("session") ?? "");
  const semesterRaw = String(formData.get("semester") ?? "");
  const courseCode = normaliseIdentifier(String(formData.get("courseCode") ?? ""));
  const studentMatricNo = normaliseIdentifier(String(formData.get("studentMatricNo") ?? ""));
  const studentName = String(formData.get("studentName") ?? "").trim() || null;
  const currentGrade = String(formData.get("currentGrade") ?? "").trim().toUpperCase() || null;
  const requestedChange = String(formData.get("requestedChange") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!SESSION_RE.test(academicSession)) return { error: "Select an academic session." };
  const semester = Number(semesterRaw);
  if (!Number.isInteger(semester) || semester < 0 || semester > 2) return { error: "Select a semester." };
  if (!courseCode) return { error: "Enter the course code." };
  if (!studentMatricNo) return { error: "Enter the student matric number." };
  if (!requestedChange) return { error: "Describe the requested change." };
  if (reason.length < 10) return { error: "Please give a reason (at least 10 characters)." };

  // A lecturer may only request corrections for a course they are actually
  // assigned to (main or co-lecturer) for the session — never for any course.
  const assigned = await isAssignedToCourse(user.id, courseCode, academicSession, semester);
  if (!assigned) {
    return { error: `You are not assigned to ${courseCode} for ${academicSession}.` };
  }

  const request = await prisma.resultCorrectionRequest.create({
    data: {
      requesterId: user.id,
      academicSession,
      semester,
      courseCode,
      studentMatricNo,
      studentName,
      currentGrade,
      requestedChange,
      reason,
      status: "SUBMITTED",
    },
  });

  await writeAudit({
    action: "SUBMIT",
    module: "EXAMS_RECORDS",
    targetType: "RESULT_CORRECTION",
    targetId: request.id,
    after: { academicSession, semester, courseCode, studentMatricNo, requestedChange },
    meta: m,
    actorUserId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    sessionId: session.id,
  });

  return {
    success: "Correction request submitted to Exams & Records.",
    summary: { rowCount: 0, processed: 0, failed: 0, errors: [] },
  };
}
