"use client";

import { useActionState } from "react";
import { signOffClearance } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function ClearanceSignOffButton({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState(signOffClearance, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <PillButton type="submit" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Signing off…" : "Sign off"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mt-1 text-xs font-medium text-brand-dark">
          Signed off.
        </p>
      ) : null}
    </form>
  );
}
