"use client";

import { useActionState } from "react";
import { submitSiwesRecord } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function SubmitRecordButton() {
  const [state, formAction, pending] = useActionState(submitSiwesRecord, null);
  return (
    <form action={formAction} className="flex items-center gap-4">
      <PillButton type="submit" variant="outline" disabled={pending}>
        {pending ? "Submitting…" : "Submit for sign-off"}
      </PillButton>
      {state?.ok ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          Placement submitted — awaiting coordinator sign-off.
        </p>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
