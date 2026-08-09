"use client";

import { useActionState } from "react";
import { addVisitationReport } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function VisitationForm({
  records,
}: {
  records: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(addVisitationReport, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="recordId" className="mb-1 block text-sm font-semibold text-slate">
          Placement
        </label>
        <select id="recordId" name="recordId" required className={inputClass}>
          <option value="">Select placement…</option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-semibold text-slate">
          Visit notes
        </label>
        <textarea id="notes" name="notes" required rows={4} className={inputClass} />
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save report"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Visitation report saved.
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
