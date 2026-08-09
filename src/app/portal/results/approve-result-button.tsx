"use client";

import { useActionState } from "react";
import { approveResult } from "@/lib/module-actions";

export function ApproveResultButton({ id, label = "Approve" }: { id: string; label?: string }) {
  const [state, action, pending] = useActionState(approveResult, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Approving…" : label}
      </button>
      {state?.ok ? (
        <span role="status" className="text-xs font-medium text-brand-dark">
          Approved
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
