"use client";

import { useActionState } from "react";
import { submitForChairmanReview } from "@/lib/module-actions";

export function SubmitForReviewButton({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState(submitForChairmanReview, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-brand-strong px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit for Review"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
