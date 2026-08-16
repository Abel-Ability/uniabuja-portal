"use client";

import { useActionState, useState } from "react";
import { PillButton } from "@/components/ui";
import type { LecturerActionResultAction } from "@/app/portal/lecturer/actions";
import { academicSessions, RESULT_SEMESTERS, BACKLOG_SEMESTER_OPTIONS, SEMESTER_LABELS } from "@/lib/constants";

const GRADES = ["A", "B", "C", "D", "E", "F", "P"];

export function CorrectionRequestForm({
  action,
  initial,
}: {
  action: LecturerActionResultAction;
  initial?: { course?: string; session?: string };
}) {
  const sessions = academicSessions();
  const [session, setSession] = useState(initial?.session ?? sessions[sessions.length - 1] ?? "");
  const [semester, setSemester] = useState(1);
  const [state, formAction, pending] = useActionState(action, null);

  const inputCls =
    "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";
  const labelCls = "mb-1 block text-sm font-semibold text-slate";

  return (
    <form action={formAction} className="space-y-5">
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="session" className={labelCls}>Academic session</label>
          <select id="session" name="session" value={session} onChange={(e) => setSession(e.target.value)} className={inputCls}>
            {sessions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="semester" className={labelCls}>Semester</label>
          <select id="semester" name="semester" value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={inputCls}>
            {[...RESULT_SEMESTERS, ...BACKLOG_SEMESTER_OPTIONS.filter((s) => s === 0)].map((s) => (
              <option key={s} value={s}>{SEMESTER_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="currentGrade" className={labelCls}>Current grade (optional)</label>
          <select id="currentGrade" name="currentGrade" className={inputCls}>
            <option value="">—</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="courseCode" className={labelCls}>Course code</label>
          <input
            id="courseCode"
            name="courseCode"
            required
            placeholder="e.g. CSC401"
            defaultValue={initial?.course}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="studentMatricNo" className={labelCls}>Student matric number</label>
          <input
            id="studentMatricNo"
            name="studentMatricNo"
            required
            placeholder="e.g. UAH2021001"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="studentName" className={labelCls}>Student name (optional)</label>
        <input id="studentName" name="studentName" placeholder="e.g. Aliyu Ahmad" className={inputCls} />
      </div>

      <div>
        <label htmlFor="requestedChange" className={labelCls}>Requested change</label>
        <input
          id="requestedChange"
          name="requestedChange"
          required
          placeholder="e.g. Change exam score from 40 to 55 and grade from E to C"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="reason" className={labelCls}>Reason</label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={4}
          placeholder="Explain why the change is needed (at least 10 characters)."
          className={inputCls}
        />
      </div>

      <PillButton type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit correction request"}
      </PillButton>
    </form>
  );
}
