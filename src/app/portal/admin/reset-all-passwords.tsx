"use client";

import { useActionState } from "react";
import { resetAllPasswords } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function ResetAllPasswords() {
  const [state, formAction, pending] = useActionState(resetAllPasswords, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <PillButton type="submit" variant="outline" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Resetting all…" : "Reset all passwords"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="w-full text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-xs font-medium text-brand-dark">
          Passwords reset to default for all users.
        </p>
      ) : null}
    </form>
  );
}
