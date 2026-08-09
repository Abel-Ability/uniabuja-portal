"use client";

import { useActionState } from "react";
import { addLogbookEntry } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function LogbookForm() {
  const [state, formAction, pending] = useActionState(addLogbookEntry, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="weekNo" className="mb-1 block text-sm font-semibold text-slate">
          Week number
        </label>
        <input id="weekNo" name="weekNo" type="number" min={1} max={52} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="activities" className="mb-1 block text-sm font-semibold text-slate">
          Activities this week
        </label>
        <textarea id="activities" name="activities" required rows={4} className={inputClass} />
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add entry"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Logbook entry saved.
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
