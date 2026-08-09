"use client";

import { useActionState, useState } from "react";
import { submitGrade } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function GradeEntryForm({
  courses,
}: {
  courses: {
    id: string;
    code: string;
    title: string;
    students: { id: string; fullName: string }[];
  }[];
}) {
  const [state, formAction, pending] = useActionState(submitGrade, null);
  const [courseId, setCourseId] = useState("");

  const course = courses.find((c) => c.id === courseId);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="courseId" className="mb-1 block text-sm font-semibold text-slate">
            Course
          </label>
          <select
            id="courseId"
            name="courseId"
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="studentId" className="mb-1 block text-sm font-semibold text-slate">
            Student
          </label>
          <select
            id="studentId"
            name="studentId"
            required
            disabled={!course}
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
          >
            <option value="">Select student…</option>
            {course?.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="caScore" className="mb-1 block text-sm font-semibold text-slate">
            Continuous assessment (0–40)
          </label>
          <input
            id="caScore"
            name="caScore"
            type="number"
            min={0}
            max={40}
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label htmlFor="examScore" className="mb-1 block text-sm font-semibold text-slate">
            Examination (0–60)
          </label>
          <input
            id="examScore"
            name="examScore"
            type="number"
            min={0}
            max={60}
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit grades"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Grade submitted — now awaiting HOD approval.
          </p>
        ) : null}
        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
