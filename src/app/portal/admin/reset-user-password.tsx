"use client";

import { useActionState } from "react";
import { resetUserPassword } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function ResetUserPassword({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <PillButton type="submit" variant="outline" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Resetting…" : "Reset"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="w-full text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-xs font-medium text-brand-dark">
          Password reset to default.
        </p>
      ) : null}
    </form>
  );
}
