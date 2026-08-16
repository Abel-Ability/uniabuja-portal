"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createFacultyAnnouncement } from "./actions";
import { PillButton } from "@/components/ui";

const CATEGORIES = [
  { value: "NEWS", label: "News" },
  { value: "NOTICE", label: "Notice" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "ADMISSION", label: "Admission" },
  { value: "GENERAL", label: "General" },
];

const AUDIENCES = [
  { value: "FACULTY", label: "Entire faculty" },
  { value: "STUDENT", label: "Faculty students" },
  { value: "STAFF", label: "Faculty staff" },
  { value: "ROLE", label: "Specific role" },
];

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function FacultyAnnouncementForm({ faculty }: { faculty: string }) {
  const [state, formAction, pending] = useActionState(createFacultyAnnouncement, null);
  const [audience, setAudience] = useState("FACULTY");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          Announcement published to {faculty}.
        </p>
      ) : null}
      <div>
        <label htmlFor="faculty-announcement-title" className="mb-1 block text-sm font-semibold text-slate">
          Title
        </label>
        <input
          id="faculty-announcement-title"
          name="title"
          required
          maxLength={160}
          placeholder="e.g. Faculty examination timetable"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="faculty-announcement-body" className="mb-1 block text-sm font-semibold text-slate">
          Message
        </label>
        <textarea
          id="faculty-announcement-body"
          name="body"
          required
          rows={4}
          placeholder="Announcement body…"
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="faculty-announcement-category" className="mb-1 block text-sm font-semibold text-slate">
            Category
          </label>
          <select id="faculty-announcement-category" name="category" defaultValue="NOTICE" className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="faculty-announcement-audience" className="mb-1 block text-sm font-semibold text-slate">
            Audience
          </label>
          <select
            id="faculty-announcement-audience"
            name="scope"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={inputClass}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate/60">Published to {faculty} only.</p>
        </div>
      </div>
      {audience === "ROLE" ? (
        <div>
          <label htmlFor="faculty-announcement-roles" className="mb-1 block text-sm font-semibold text-slate">
            Roles
          </label>
          <input
            id="faculty-announcement-roles"
            name="roles"
            placeholder="e.g. HOD, LECTURER, DEAN"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate/60">
            Comma-separated roles: HOD, LECTURER, DEAN, EXAMS_RECORDS, PG_SCHOOL, STUDENT_AFFAIRS.
          </p>
        </div>
      ) : null}
      <PillButton type="submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish announcement"}
      </PillButton>
    </form>
  );
}
