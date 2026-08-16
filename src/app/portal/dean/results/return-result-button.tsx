"use client";

import { useState } from "react";
import { useActionState } from "react";
import { returnResult } from "@/lib/module-actions";

export function ReturnResultButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(returnResult, null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-800/50 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Return
        </button>
      ) : (
        <form action={action} className="flex flex-col items-start gap-1.5">
          <input type="hidden" name="id" value={id} />
          <textarea
            name="reason"
            required
            rows={2}
            placeholder="Reason for returning this result"
            className="w-64 rounded-lg border border-red-300 px-3 py-1.5 text-xs text-slate focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <span className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Returning…" : "Confirm return"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate/25 px-3 py-1 text-xs font-semibold text-slate hover:border-brand/40 hover:text-brand-strong"
            >
              Cancel
            </button>
          </span>
        </form>
      )}
      {state?.ok ? (
        <span role="status" className="text-xs font-medium text-brand-dark">
          Returned to submissions
        </span>
      ) : null}
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
