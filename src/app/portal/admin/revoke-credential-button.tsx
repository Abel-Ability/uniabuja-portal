"use client";

import { useActionState } from "react";
import { revokeApiCredential } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function RevokeCredentialButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(revokeApiCredential, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <PillButton type="submit" variant="outline" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Revoking…" : "Revoke"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="w-full text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-xs font-medium text-brand-dark">
          Revoked.
        </p>
      ) : null}
    </form>
  );
}
