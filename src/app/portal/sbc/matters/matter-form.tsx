"use client";

import { useActionState } from "react";
import { submitMatter } from "../actions";
import { PillButton } from "@/components/ui";
import { MATTER_CATEGORIES, CATEGORY_LABELS } from "@/lib/senate-constants";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function MatterForm() {
  const [state, formAction, pending] = useActionState(submitMatter, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark">
          Matter submitted for Senate consideration. It is now awaiting screening.
        </p>
      ) : null}
      <div>
        <label htmlFor="senate-matter-title" className="mb-1 block text-sm font-semibold text-slate">
          Matter title
        </label>
        <input
          id="senate-matter-title"
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Ratification of Senate-approved results for 2025/2026"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="senate-matter-summary" className="mb-1 block text-sm font-semibold text-slate">
          Summary
        </label>
        <textarea
          id="senate-matter-summary"
          name="summary"
          required
          rows={4}
          placeholder="What is before Senate for consideration?"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="senate-matter-category" className="mb-1 block text-sm font-semibold text-slate">
          Category
        </label>
        <select id="senate-matter-category" name="category" defaultValue="ACADEMIC" className={inputClass}>
          {MATTER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Raise matter"}
      </PillButton>
    </form>
  );
}
