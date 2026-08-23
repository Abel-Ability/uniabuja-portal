"use client";

import { useActionState } from "react";
import { deselectCandidate } from "@/lib/module-actions";

export function DeselectCandidateButton({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState(deselectCandidate, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-slate/25 px-3 py-1.5 text-xs font-semibold text-slate hover:bg-slate/5 disabled:opacity-50"
      >
        {isPending ? "Removing..." : "Deselect"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
