"use client";

import { useActionState } from "react";
import { respondFoiRequest } from "@/lib/module-actions";

export function RespondFoiForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(respondFoiRequest, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="outcome"
        defaultValue="COMPLETE"
        aria-label="Outcome"
        className="rounded-lg border border-slate/25 px-2 py-1.5 text-xs focus:border-brand focus:ring-2 focus:ring-brand/30"
      >
        <option value="COMPLETE">Complete</option>
        <option value="REJECT">Reject</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      {state?.ok ? (
        <span role="status" className="text-xs font-medium text-brand-dark">
          Updated
        </span>
      ) : null}
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
