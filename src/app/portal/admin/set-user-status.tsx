"use client";

import { useActionState } from "react";
import { setUserStatus } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const selectClass =
  "rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function SetUserStatus({ userId, current }: { userId: string; current: string }) {
  const [state, formAction, pending] = useActionState(setUserStatus, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <select name="status" defaultValue={current} aria-label="Status" className={selectClass}>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="INACTIVE">Inactive</option>
      </select>
      <PillButton type="submit" variant="outline" disabled={pending} className="px-4 py-2 text-xs">
        {pending ? "Saving…" : "Set"}
      </PillButton>
      {state?.error ? (
        <p role="alert" className="w-full text-xs font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="w-full text-xs font-medium text-brand-dark">
          Status updated.
        </p>
      ) : null}
    </form>
  );
}
