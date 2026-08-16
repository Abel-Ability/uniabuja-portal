"use client";

import { useActionState, useState } from "react";
import { createSenateAnnouncement } from "../actions";
import { PillButton } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

const AUDIENCES = [
  { value: "STAFF", label: "All staff" },
  { value: "ROLE", label: "Specific Senate roles" },
];

export function SenateAnnouncementForm() {
  const [state, formAction, pending] = useActionState(createSenateAnnouncement, null);
  const [audience, setAudience] = useState("STAFF");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">
          Senate announcement published.
        </p>
      ) : null}
      <div>
        <label htmlFor="senate-announcement-title" className="mb-1 block text-sm font-semibold text-slate">
          Title
        </label>
        <input
          id="senate-announcement-title"
          name="title"
          required
          maxLength={160}
          placeholder="e.g. Notice of Senate sitting"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="senate-announcement-body" className="mb-1 block text-sm font-semibold text-slate">
          Message
        </label>
        <textarea
          id="senate-announcement-body"
          name="body"
          required
          rows={4}
          placeholder="Announcement body…"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="senate-announcement-audience" className="mb-1 block text-sm font-semibold text-slate">
          Audience
        </label>
        <select
          id="senate-announcement-audience"
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
        <p className="mt-1 text-xs text-slate/60">
          Senate announcements are institution-scoped only — they never appear on the public homepage.
        </p>
      </div>
      {audience === "ROLE" ? (
        <div>
          <label htmlFor="senate-announcement-roles" className="mb-1 block text-sm font-semibold text-slate">
            Roles
          </label>
          <input
            id="senate-announcement-roles"
            name="roles"
            placeholder="e.g. DEAN, HOD, SBC_CHAIRMAN"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate/60">
            Comma-separated roles: SBC_CHAIRMAN, DEAN, HOD, EXAMS_RECORDS, REGISTRY, DVC_OVERSIGHT, VC.
          </p>
        </div>
      ) : null}
      <PillButton type="submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish announcement"}
      </PillButton>
    </form>
  );
}
