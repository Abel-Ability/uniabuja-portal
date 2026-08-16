"use client";

import { useActionState } from "react";
import { approveScholarship, rejectScholarship } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const noteClass =
  "w-full rounded-lg border border-slate/25 px-3 py-2 text-xs focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-slate-900/60 dark:text-slate-100";

export function ScholarshipDecisionButtons({ scholarshipId }: { scholarshipId: string }) {
  const [approveState, approveAction, approving] = useActionState(approveScholarship, null);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectScholarship, null);

  return (
    <div className="flex flex-col gap-3">
      <form action={approveAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="scholarshipId" value={scholarshipId} />
        <input name="decisionNote" placeholder="Approval note (optional)" className={noteClass} />
        <PillButton type="submit" disabled={approving} className="px-4 py-2 text-xs">
          {approving ? "Approving…" : "Approve"}
        </PillButton>
        {approveState?.error ? (
          <p role="alert" className="w-full text-xs font-medium text-red-600">
            {approveState.error}
          </p>
        ) : null}
        {approveState?.ok ? (
          <p role="status" className="w-full text-xs font-medium text-brand-dark">
            Approved.
          </p>
        ) : null}
      </form>
      <form action={rejectAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="scholarshipId" value={scholarshipId} />
        <input name="decisionNote" placeholder="Rejection reason (optional)" className={noteClass} />
        <PillButton type="submit" disabled={rejecting} className="border-2 border-red-600 px-4 py-2 text-xs text-red-600 hover:bg-red-600 hover:text-white">
          {rejecting ? "Rejecting…" : "Reject"}
        </PillButton>
        {rejectState?.error ? (
          <p role="alert" className="w-full text-xs font-medium text-red-600">
            {rejectState.error}
          </p>
        ) : null}
        {rejectState?.ok ? (
          <p role="status" className="w-full text-xs font-medium text-brand-dark">
            Rejected.
          </p>
        ) : null}
      </form>
    </div>
  );
}
