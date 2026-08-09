"use client";

import { useActionState } from "react";
import { advancePgApplication } from "@/lib/module-actions";

export function AdvancePgApplicationButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(advancePgApplication, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Advancing…" : "Advance"}
      </button>
      {state?.ok ? (
        <span role="status" className="text-xs font-medium text-brand-dark">
          Advanced
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
