"use client";

import { useState } from "react";
import { useActionState } from "react";
import { chairmanConfirm, chairmanReject, chairmanReturn } from "@/lib/module-actions";

export function ChairmanDecisionButtons({ applicationId }: { applicationId: string }) {
  const [showNotes, setShowNotes] = useState<string | null>(null);
  const [confirmState, confirmAction, confirmPending] = useActionState(chairmanConfirm, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(chairmanReject, null);
  const [returnState, returnAction, returnPending] = useActionState(chairmanReturn, null);

  const isPending = confirmPending || rejectPending || returnPending;
  const error = confirmState?.error || rejectState?.error || returnState?.error;

  if (showNotes === "confirm") {
    return (
      <form action={confirmAction} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-slate/25 px-2 py-1 text-xs focus:border-brand focus:ring-1 focus:ring-brand/30"
          placeholder="Optional notes..."
        />
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {confirmPending ? "Confirming..." : "Confirm ADMIT"}
          </button>
          <button
            type="button"
            onClick={() => setShowNotes(null)}
            className="rounded-lg border border-slate/25 px-2 py-1 text-xs text-slate hover:bg-slate/5"
          >
            Cancel
          </button>
        </div>
        {confirmState?.error && <p className="text-xs text-red-600">{confirmState.error}</p>}
      </form>
    );
  }

  if (showNotes === "reject") {
    return (
      <form action={rejectAction} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-slate/25 px-2 py-1 text-xs focus:border-brand focus:ring-1 focus:ring-brand/30"
          placeholder="Reason for rejection..."
        />
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {rejectPending ? "Rejecting..." : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => setShowNotes(null)}
            className="rounded-lg border border-slate/25 px-2 py-1 text-xs text-slate hover:bg-slate/5"
          >
            Cancel
          </button>
        </div>
        {rejectState?.error && <p className="text-xs text-red-600">{rejectState.error}</p>}
      </form>
    );
  }

  if (showNotes === "return") {
    return (
      <form action={returnAction} className="space-y-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-slate/25 px-2 py-1 text-xs focus:border-brand focus:ring-1 focus:ring-brand/30"
          placeholder="Reason for returning to committee..."
        />
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {returnPending ? "Returning..." : "Return to Committee"}
          </button>
          <button
            type="button"
            onClick={() => setShowNotes(null)}
            className="rounded-lg border border-slate/25 px-2 py-1 text-xs text-slate hover:bg-slate/5"
          >
            Cancel
          </button>
        </div>
        {returnState?.error && <p className="text-xs text-red-600">{returnState.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={() => setShowNotes("confirm")}
        disabled={isPending}
        className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        Admit
      </button>
      <button
        onClick={() => setShowNotes("reject")}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        Reject
      </button>
      <button
        onClick={() => setShowNotes("return")}
        disabled={isPending}
        className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        Return
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
