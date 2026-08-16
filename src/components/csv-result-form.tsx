"use client";

import { useActionState, useState } from "react";
import { PillButton } from "@/components/ui";
import type { LecturerActionResultAction } from "@/app/portal/lecturer/actions";
import {
  RESULT_CA_MAX_OPTIONS,
  RESULT_CONTENT_TYPES,
  RESULT_SEMESTERS,
  BACKLOG_SEMESTER_OPTIONS,
  SEMESTER_LABELS,
  CONTENT_TYPE_LABELS,
  academicSessions,
} from "@/lib/constants";

type Assignment = { code: string; title: string; session: string; semester: number };

export function CsvResultForm({
  action,
  kind,
  assignments,
  initial,
}: {
  action: LecturerActionResultAction;
  kind: "NORMAL" | "BACKLOG";
  assignments: Assignment[];
  initial?: { course?: string; session?: string; semester?: number };
}) {
  const sessions = academicSessions();
  const preferredSession =
    assignments.map((a) => a.session).sort().pop() ?? sessions[sessions.length - 1] ?? "";
  const [session, setSession] = useState(initial?.session ?? preferredSession);
  const [semester, setSemester] = useState(initial?.semester ?? (kind === "BACKLOG" ? 0 : 1));
  const [courseCode, setCourseCode] = useState(initial?.course ?? "");
  const [contentType, setContentType] = useState("BOTH");
  const [caMax, setCaMax] = useState(30);
  const [fileName, setFileName] = useState("");

  const [state, formAction, pending] = useActionState(action, null);

  const available = assignments.filter((a) =>
    kind === "BACKLOG" ? a.session === session : a.session === session && a.semester === semester,
  );
  const semesterOptions = kind === "BACKLOG" ? BACKLOG_SEMESTER_OPTIONS : RESULT_SEMESTERS;

  const inputCls =
    "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";
  const labelCls = "mb-1 block text-sm font-semibold text-slate";

  const downloadTemplate = () => {
    const header = "MATRIC_NO,CA,EXAM";
    const example =
      contentType === "CA"
        ? "UAH2021001,25,"
        : contentType === "EXAM"
          ? "UAH2021001,,60"
          : "UAH2021001,25,60";
    const blob = new Blob([[header, example].join("\n") + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseCode ? `${courseCode}-` : ""}results-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.success}
          {state.summary && state.summary.failed > 0 ? (
            <p className="mt-1 text-xs font-normal text-green-700">
              {state.summary.failed} row{state.summary.failed === 1 ? "" : "s"} skipped — see details below.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="session" className={labelCls}>Academic session</label>
          <select
            id="session"
            name="session"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className={inputCls}
          >
            {sessions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="semester" className={labelCls}>Semester</label>
          <select
            id="semester"
            name="semester"
            value={semester}
            onChange={(e) => {
              setSemester(Number(e.target.value));
              setCourseCode("");
            }}
            className={inputCls}
          >
            {semesterOptions.map((s) => (
              <option key={s} value={s}>{SEMESTER_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="courseCode" className={labelCls}>Course</label>
        {available.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
            You have no assigned courses for {session}, {SEMESTER_LABELS[semester]}. Ask your HoD to assign courses first.
          </p>
        ) : (
          <select
            id="courseCode"
            name="courseCode"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">Select a course…</option>
            {available.map((a) => (
              <option key={`${a.code}-${a.session}-${a.semester}`} value={a.code}>
                {a.code} — {a.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contentType" className={labelCls}>Content</label>
          <select
            id="contentType"
            name="contentType"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className={inputCls}
          >
            {RESULT_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="caMax" className={labelCls}>CA maximum</label>
          <select
            id="caMax"
            name="caMax"
            value={caMax}
            onChange={(e) => setCaMax(Number(e.target.value))}
            className={inputCls}
            disabled={contentType === "EXAM"}
          >
            {RESULT_CA_MAX_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={labelCls}>CSV file</p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-strong px-3 py-1.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-strong hover:text-white"
          >
            📥 Download CSV Template
          </button>
        </div>
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate/30 bg-slate/5 px-4 py-8 text-center transition-colors hover:border-brand hover:bg-brand/5"
        >
          <span className="text-base font-semibold text-slate">📤 Upload CSV File</span>
          <span className="text-xs text-slate/70">
            {fileName || "Click to choose your .csv file"}
          </span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </div>

      <div className="rounded-xl border border-slate/10 bg-slate/5 px-4 py-3 text-xs leading-relaxed text-slate/75">
        <p className="font-semibold text-slate">Expected CSV format — three columns</p>
        <p className="mt-1 font-mono">MATRIC_NO,CA,EXAM</p>
        <p className="mt-1 font-mono">UAH2021001,25,60</p>
        <p className="mt-1">
          TOTAL and GRADE are computed automatically, so leave them out of the file.
          {contentType === "CA"
            ? " Leave EXAM blank for CA-only uploads."
            : contentType === "EXAM"
              ? " Leave CA blank for exam-only uploads."
              : ""}{" "}
          CA must be within the CA maximum and CA + EXAM must not exceed 100.
        </p>
      </div>

      {state?.summary && state.summary.errors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-800">
            {state.summary.errors.length} row{state.summary.errors.length === 1 ? "" : "s"} skipped
          </p>
          <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-xs text-amber-800">
            {state.summary.errors.slice(0, 25).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PillButton type="submit" disabled={pending || available.length === 0} className="w-full sm:w-auto">
        {pending ? "Uploading…" : `Post ${kind === "BACKLOG" ? "backlog " : ""}results`}
      </PillButton>
    </form>
  );
}
