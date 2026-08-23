"use client";

import { useState } from "react";
import { useActionState } from "react";
import { selectCandidate } from "@/lib/module-actions";
import { ADMISSION_CATEGORIES, ADMISSION_CATEGORY_LABELS } from "@/lib/constants";

export function SelectCandidateButton({ applicationId }: { applicationId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(selectCandidate, null);

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-brand-strong px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Select Candidate
        </button>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Admission Category</label>
            <select
              name="category"
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              defaultValue="MERIT"
            >
              {ADMISSION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {ADMISSION_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">
              Justification (required for non-merit categories)
            </label>
            <textarea
              name="justification"
              rows={3}
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder="Provide justification if selecting under a special category..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder="Optional committee notes..."
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-brand-strong px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {isPending ? "Selecting..." : "Confirm Selection"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate/25 px-4 py-2 text-sm font-semibold text-slate hover:bg-slate/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
