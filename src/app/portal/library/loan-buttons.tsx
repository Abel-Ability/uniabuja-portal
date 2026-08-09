"use client";

import { useActionState } from "react";
import type { ModuleActionResult } from "@/lib/module-actions";
import { borrowHolding, returnHolding } from "./actions";
import { PillButton } from "@/components/ui";

function Feedback({ state }: { state: ModuleActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p role="status" className="mt-1 text-xs font-medium text-brand-dark">
        Done.
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="mt-1 text-xs font-medium text-red-600">
        {state.error}
      </p>
    );
  }
  return null;
}

export function BorrowHoldingButton({ holdingId }: { holdingId: string }) {
  const [state, action, pending] = useActionState(borrowHolding, null);
  return (
    <form action={action}>
      <input type="hidden" name="holdingId" value={holdingId} />
      <PillButton
        type="submit"
        variant="outline"
        disabled={pending}
        className="px-4 py-1.5 text-xs"
      >
        {pending ? "Borrowing…" : "Borrow"}
      </PillButton>
      <Feedback state={state} />
    </form>
  );
}

export function ReturnLoanButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(returnHolding, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <PillButton
        type="submit"
        variant="outline"
        disabled={pending}
        className="px-4 py-1.5 text-xs"
      >
        {pending ? "Returning…" : "Return"}
      </PillButton>
      <Feedback state={state} />
    </form>
  );
}
