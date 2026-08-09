"use client";

import { useActionState } from "react";
import { createAnnouncement } from "./actions";
import { PillButton } from "@/components/ui";

const CATEGORIES = [
  { value: "NEWS", label: "News" },
  { value: "NOTICE", label: "Notice" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "ADMISSION", label: "Admission" },
  { value: "GENERAL", label: "General" },
];

const SCOPES = [
  { value: "PUBLIC", label: "Public" },
  { value: "STUDENT", label: "Students" },
  { value: "STAFF", label: "Staff" },
  { value: "ROLE", label: "Specific role" },
];

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function AnnouncementForm() {
  const [state, formAction, pending] = useActionState(createAnnouncement, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          Announcement published.
        </p>
      ) : null}
      <div>
        <label htmlFor="announcement-title" className="mb-1 block text-sm font-semibold text-slate">
          Title
        </label>
        <input
          id="announcement-title"
          name="title"
          required
          maxLength={160}
          placeholder="e.g. Late fee payment deadline"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="announcement-body" className="mb-1 block text-sm font-semibold text-slate">
          Message
        </label>
        <textarea
          id="announcement-body"
          name="body"
          required
          rows={4}
          placeholder="Announcement body…"
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="announcement-category"
            className="mb-1 block text-sm font-semibold text-slate"
          >
            Category
          </label>
          <select id="announcement-category" name="category" defaultValue="NOTICE" className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="announcement-scope" className="mb-1 block text-sm font-semibold text-slate">
            Scope
          </label>
          <select id="announcement-scope" name="scope" defaultValue="PUBLIC" className={inputClass}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish announcement"}
      </PillButton>
    </form>
  );
}
