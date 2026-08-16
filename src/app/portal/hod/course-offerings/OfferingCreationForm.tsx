"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCourseOffering } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

type CourseOption = { id: string; code: string; title: string; semester: number; units: number };
type ProgrammeOption = { id: string; code: string; name: string };

const SELECT_CLASS =
  "mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function OfferingCreationForm({
  faculty,
  department,
  sessions,
  currentSession,
  courses,
  programmes,
  levels,
}: {
  faculty: string;
  department: string;
  sessions: string[];
  currentSession: string;
  courses: CourseOption[];
  programmes: ProgrammeOption[];
  levels: number[];
}) {
  const [state, action, pending] = useActionState(createCourseOffering, null);
  const [open, setOpen] = useState(false);
  const [semester, setSemester] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const courseRef = useRef<HTMLSelectElement>(null);

  const semesterCourses = courses
    .filter((c) => c.semester === semester)
    .sort((a, b) => a.code.localeCompare(b.code));

  const changeSemester = (value: number) => {
    setSemester(value);
    const selected = courseRef.current?.value ?? "";
    if (selected && !courses.some((c) => c.id === selected && c.semester === value)) {
      if (courseRef.current) courseRef.current.value = "";
    }
  };

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
      <div className="rounded-xl border border-dashed border-slate/25 bg-slate/5 p-4 text-sm text-slate/75">
        <p className="font-semibold text-slate">Course catalogue vs course offering</p>
        <p className="mt-1">
          The course catalogue (<span className="font-mono">Courses_UG</span>) lists every course the
          department offers. This form creates a <strong>course offering</strong>: it attaches one catalogue
          course to a programme, level, academic session and semester so students know when the course is
          available. It does not allocate a lecturer — use Course Allocation for that.
        </p>
      </div>

      {!open ? (
        <div className="mt-5">
          <PillButton type="button" variant="primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Course Offering
          </PillButton>
        </div>
      ) : (
        <form action={action} ref={formRef} className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold text-slate">
              Academic session
              <select
                name="academicSession"
                defaultValue={sessions.includes(currentSession) ? currentSession : (sessions[sessions.length - 1] ?? "")}
                className={SELECT_CLASS}
              >
                {sessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate">
              Semester
              <select
                name="semester"
                value={semester}
                onChange={(e) => changeSemester(parseInt(e.target.value, 10))}
                className={SELECT_CLASS}
              >
                <option value="1">First Semester</option>
                <option value="2">Second Semester</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-slate">
              Level
              <select name="level" defaultValue={String(levels[0] ?? 100)} className={SELECT_CLASS}>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l} Level
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate sm:col-span-2 lg:col-span-3">
              Course (from the departmental catalogue)
              <select
                name="courseId"
                ref={courseRef}
                defaultValue=""
                className={SELECT_CLASS}
              >
                <option value="" disabled>
                  Select a course…
                </option>
                {semesterCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title} ({c.units} units)
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate sm:col-span-2 lg:col-span-3">
              Programme (optional — leave as “All programmes” for the whole department)
              <select name="programmeId" defaultValue="" className={SELECT_CLASS}>
                <option value="">All programmes</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.code ? ` (${p.code})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate">
              Status
              <select name="status" defaultValue="ACTIVE" className={SELECT_CLASS}>
                <option value="ACTIVE">ACTIVE — eligible for registration</option>
                <option value="INACTIVE">INACTIVE — paused</option>
              </select>
            </label>
          </div>

          <div className="mt-2 text-xs text-slate/50">
            {faculty} · {department}
          </div>

          {semesterCourses.length === 0 ? (
            <p className="mt-3 text-xs font-medium text-amber-700">
              No catalogue courses for this department and semester are in the database yet. Add them, then
              return here to create offerings.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PillButton type="submit" variant="primary" disabled={pending}>
              {pending ? "Creating…" : "Create offering"}
            </PillButton>
            <PillButton type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </PillButton>
          </div>

          {state?.ok ? (
            <p role="status" className="mt-3 text-sm font-medium text-brand-dark">
              Offering created.
            </p>
          ) : null}
          {state?.error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
