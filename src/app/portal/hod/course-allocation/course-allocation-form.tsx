"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import {
  assignCourse,
  unassignCourse,
  addCourseTeamLecturer,
  removeCourseTeamLecturer,
} from "@/lib/module-actions";
import { SectionHeading, PillButton, EmptyState, Table } from "@/components/ui";
import { CURRENT_SESSION } from "@/lib/constants";

type Lecturer = { id: string; fullName: string; staffNo: string | null };
type DeptCourse = { code: string; title: string; semester: number; units: number };
type TeamMember = { id: string; lecturerId: string; lecturerName: string };
type Assignment = {
  id: string;
  courseCode: string;
  courseTitle: string;
  academicSession: string;
  semester: number;
  lecturerId: string;
  lecturerName: string;
  teamMembers: TeamMember[];
};

const assignmentKey = (code: string, session: string, semester: number) =>
  `${code}|${session}|${semester}`;

export function CourseAllocationForm({
  faculty,
  department,
  sessions,
  courses,
  lecturers,
  assignments,
}: {
  faculty: string;
  department: string;
  sessions: string[];
  courses: DeptCourse[];
  lecturers: Lecturer[];
  assignments: Assignment[];
}) {
  const [session, setSession] = useState(
    sessions.includes(CURRENT_SESSION) ? CURRENT_SESSION : (sessions[sessions.length - 1] ?? ""),
  );
  const [semester, setSemester] = useState(1);

  const visibleAssignments = assignments.filter(
    (a) => a.academicSession === session && a.semester === semester,
  );

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="New allocation"
          subtitle="Pick the session and semester, then a course from the department's list and the main lecturer to hold it."
        />
        <AssignCourseForm
          faculty={faculty}
          department={department}
          sessions={sessions}
          courses={courses}
          lecturers={lecturers}
          assignments={assignments}
          defaultSession={session}
          onSessionChange={setSession}
          onSemesterChange={setSemester}
        />
      </section>

      <section>
        <SectionHeading title="Current allocations" subtitle={`${session} · ${semester === 1 ? "First" : "Second"} semester`} />
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate">
            Session
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="rounded-xl border border-slate/25 px-4 py-2.5 text-sm"
            >
              {sessions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate">
              Semester
              <select
                value={String(semester)}
                onChange={(e) => setSemester(parseInt(e.target.value, 10))}
                className="rounded-xl border border-slate/25 px-4 py-2.5 text-sm"
              >
                <option value="1">First Semester</option>
                <option value="2">Second Semester</option>
              </select>
            </label>
          </span>
        </div>

        {visibleAssignments.length === 0 ? (
          <EmptyState title="No allocations" body="Assign a course above to see it listed here." />
        ) : (
          <>
            <Table headers={["Course", "Lecturer(s)", "Unassign"]}>
              {visibleAssignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate">{a.courseCode}</span>
                    <span className="block text-xs text-slate/60">{a.courseTitle}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate">
                      {a.lecturerName} <span className="text-xs font-normal text-slate/50">(Main)</span>
                    </span>
                    {a.teamMembers.map((m) => (
                      <span key={m.id} className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate/75">
                          {m.lecturerName} <span className="text-xs text-slate/50">(co)</span>
                        </span>
                        <RemoveTeamButton id={m.id} />
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <UnassignButton id={a.id} />
                  </td>
                </tr>
              ))}
            </Table>
            <AddCoLecturerForm assignments={visibleAssignments} lecturers={lecturers} />
          </>
        )}
      </section>
    </div>
  );
}

function AssignCourseForm({
  faculty,
  department,
  sessions,
  courses,
  lecturers,
  assignments,
  defaultSession,
  onSessionChange,
  onSemesterChange,
}: {
  faculty: string;
  department: string;
  sessions: string[];
  courses: DeptCourse[];
  lecturers: Lecturer[];
  assignments: Assignment[];
  defaultSession: string;
  onSessionChange: (s: string) => void;
  onSemesterChange: (n: number) => void;
}) {
  const [state, action, pending] = useActionState(assignCourse, null);
  const [session, setSession] = useState(defaultSession);
  const [semester, setSemester] = useState(1);
  const [courseCode, setCourseCode] = useState("");
  const [lecturerId, setLecturerId] = useState("");
  const [coLecturerIds, setCoLecturerIds] = useState<string[]>([]);

  const byKey = new Map(assignments.map((a) => [assignmentKey(a.courseCode, a.academicSession, a.semester), a]));

  const semesterCourses = courses
    .filter((c) => c.semester === semester)
    .sort((a, b) => a.code.localeCompare(b.code));
  const selectedCourse = courses.find((c) => c.code === courseCode);
  const currentHolder = courseCode ? byKey.get(assignmentKey(courseCode, session, semester)) : undefined;

  const holderLecturerId = (code: string, s: string, sem: number): string => {
    const holder = byKey.get(assignmentKey(code, s, sem));
    if (!holder) return "";
    return lecturers.some((l) => l.id === holder.lecturerId) ? holder.lecturerId : "";
  };

  const teamIdsFor = (code: string, s: string, sem: number): string[] => {
    const holder = byKey.get(assignmentKey(code, s, sem));
    return holder?.teamMembers.map((m) => m.lecturerId) ?? [];
  };

  const coOptions = lecturers.filter((l) => l.id !== lecturerId);

  const toggleCo = (id: string) => {
    setCoLecturerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectCourse = (code: string) => {
    setCourseCode(code);
    setLecturerId(holderLecturerId(code, session, semester));
    setCoLecturerIds(teamIdsFor(code, session, semester));
  };
  const changeSession = (s: string) => {
    setSession(s);
    onSessionChange(s);
    setLecturerId(holderLecturerId(courseCode, s, semester));
    setCoLecturerIds(teamIdsFor(courseCode, s, semester));
  };
  const changeSemester = (n: number) => {
    setSemester(n);
    onSemesterChange(n);
    const available = courses.some((c) => c.code === courseCode && c.semester === n);
    const code = available ? courseCode : "";
    if (courseCode && !available) setCourseCode("");
    setLecturerId(holderLecturerId(code, session, n));
    setCoLecturerIds(teamIdsFor(code, session, n));
  };

  const canSubmit = Boolean(courseCode && lecturerId);

  return (
    <form action={action} className="max-w-3xl rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Academic session
          <select
            value={session}
            onChange={(e) => changeSession(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
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
            value={String(semester)}
            onChange={(e) => changeSemester(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="1">First Semester</option>
            <option value="2">Second Semester</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Faculty
          <select
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate/25 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 px-4 py-2.5 text-sm text-slate/70"
          >
            <option>{faculty || "—"}</option>
          </select>
        </label>

        <label className="text-sm font-semibold text-slate">
          Department
          <select
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate/25 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 px-4 py-2.5 text-sm text-slate/70"
          >
            <option>{department || "—"}</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate">
          Course
          <select
            value={courseCode}
            onChange={(e) => selectCourse(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select a course…</option>
            {semesterCourses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </label>
        {semesterCourses.length === 0 ? (
          <p className="mt-1 text-xs text-slate/50">
            No {semester === 1 ? "first" : "second"}-semester courses for {department || "your department"} yet. Check the Courses_UG sheet.
          </p>
        ) : null}
        {currentHolder ? (
          <p className="mt-1 text-xs font-medium text-brand-dark">
            Currently assigned to {currentHolder.lecturerName} for {session} ({semester === 1 ? "first" : "second"} semester).
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate">
          Main Lecturer
          <select
            name="lecturerId"
            value={lecturerId}
            onChange={(e) => {
              setLecturerId(e.target.value);
              setCoLecturerIds((prev) => prev.filter((x) => x !== e.target.value));
            }}
            disabled={!courseCode}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate/60"
          >
            <option value="">Select a lecturer…</option>
            {lecturers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName}
                {l.staffNo ? ` (${l.staffNo})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <span className="text-sm font-semibold text-slate">Co-lecturers (optional)</span>
        <p className="mt-1 text-xs text-slate/50">
          Pick lecturers to teach alongside the main lecturer. They will be listed as co-lecturers for this course.
        </p>
        {coOptions.length === 0 ? (
          <p className="mt-2 text-xs text-slate/50">No other departmental lecturers available.</p>
        ) : (
          <CoLecturerPicker options={coOptions} selected={coLecturerIds} onToggle={toggleCo} />
        )}
      </div>

      <input type="hidden" name="courseCode" value={courseCode} />
      <input type="hidden" name="courseTitle" value={selectedCourse?.title ?? ""} />
      <input type="hidden" name="faculty" value={faculty} />
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="academicSession" value={session} />
      <input type="hidden" name="coLecturerIds" value={coLecturerIds.join(",")} />

      <div className="mt-5 flex items-center gap-3">
        <PillButton type="submit" variant="primary" disabled={pending || !canSubmit}>
          {pending ? "Assigning…" : "Assign course"}
        </PillButton>
        {!canSubmit ? (
          <p className="text-xs text-slate/50">Pick a course, then the lecturer, to assign.</p>
        ) : null}
      </div>
      {state?.ok ? <p role="status" className="mt-3 text-sm font-medium text-brand-dark">Assigned.</p> : null}
      {state?.error ? <p role="alert" className="mt-3 text-sm font-medium text-red-600">{state.error}</p> : null}
    </form>
  );
}

function AddCoLecturerForm({
  assignments,
  lecturers,
}: {
  assignments: Assignment[];
  lecturers: Lecturer[];
}) {
  const [state, action, pending] = useActionState(addCourseTeamLecturer, null);
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [lecturerId, setLecturerId] = useState("");

  const assignment = assignments.find((a) => a.id === assignmentId);
  const taken = new Set([
    assignment?.lecturerId ?? "",
    ...(assignment?.teamMembers ?? []).map((m) => m.lecturerId),
  ]);
  const available = lecturers.filter((l) => !taken.has(l.id));

  const changeAssignment = (id: string) => {
    setAssignmentId(id);
    setLecturerId("");
  };

  return (
    <form
      action={action}
      className="mt-4 rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900"
    >
      <p className="text-sm font-semibold text-slate">Add a co-lecturer</p>
      <p className="mt-1 text-xs text-slate/50">
        Add more lecturers to teach alongside the main lecturer of an allocated course.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Course
          <select
            value={assignmentId}
            onChange={(e) => changeAssignment(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.courseCode} — {a.academicSession} ({a.semester === 1 ? "First" : "Second"})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate">
          Co-lecturer
          <select
            value={lecturerId}
            onChange={(e) => setLecturerId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select a lecturer…</option>
            {available.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName}
                {l.staffNo ? ` (${l.staffNo})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="courseAssignmentId" value={assignmentId} />
      <div className="mt-4 flex items-center gap-3">
        <PillButton type="submit" variant="outline" disabled={pending || !lecturerId}>
          {pending ? "Adding…" : "Add co-lecturer"}
        </PillButton>
        {available.length === 0 ? (
          <p className="text-xs text-slate/50">No other departmental lecturers available for this course.</p>
        ) : null}
      </div>
      {state?.ok ? <p role="status" className="mt-3 text-sm font-medium text-brand-dark">Co-lecturer added.</p> : null}
      {state?.error ? <p role="alert" className="mt-3 text-sm font-medium text-red-600">{state.error}</p> : null}
    </form>
  );
}

function RemoveTeamButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeCourseTeamLecturer, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <PillButton type="submit" variant="outline" disabled={pending} className="px-3 py-1 text-xs">
        {pending ? "Removing…" : "Remove"}
      </PillButton>
      {state?.error ? <span role="alert" className="text-xs font-medium text-red-600">{state.error}</span> : null}
    </form>
  );
}

function UnassignButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unassignCourse, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <PillButton type="submit" variant="outline" disabled={pending}>
        {pending ? "Unassigning…" : "Unassign"}
      </PillButton>
      {state?.error ? <span role="alert" className="text-xs font-medium text-red-600">{state.error}</span> : null}
    </form>
  );
}

function CoLecturerPicker({
  options,
  selected,
  onToggle,
}: {
  options: Lecturer[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? "Select co-lecturers…"
      : selected.length === 1
        ? "1 co-lecturer selected"
        : `${selected.length} co-lecturers selected`;

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select co-lecturers"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate/25 bg-white px-4 py-2.5 text-left text-sm text-slate shadow-sm transition-colors hover:border-brand/40 dark:border-slate-200/15 dark:bg-slate-900"
      >
        <span className="truncate font-medium">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate/50 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate/20 bg-white p-2 shadow-lg dark:border-slate-200/15 dark:bg-slate-900"
        >
          {options.map((l) => (
            <label
              key={l.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(l.id)}
                onChange={() => onToggle(l.id)}
                className="accent-brand"
              />
              <span className="truncate">
                {l.fullName}
                {l.staffNo ? ` (${l.staffNo})` : ""}
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
