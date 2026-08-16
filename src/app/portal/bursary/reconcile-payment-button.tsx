"use client";

import { useActionState } from "react";
import { reconcilePayment } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function ReconcilePaymentButton({ paymentId }: { paymentId: string }) {
  const [state, formAction, pending] = useActionState(reconcilePayment, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <PillButton type="submit" variant="outline" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Reconciling…" : "Reconcile"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="w-full text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-xs font-medium text-brand-dark">
          Reconciled.
        </p>
      ) : null}
    </form>
  );
}
