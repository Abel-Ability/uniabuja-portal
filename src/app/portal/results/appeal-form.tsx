"use client";

import { useActionState } from "react";
import { fileAppeal, reviewAppeal } from "@/lib/module-actions";
import { PillButton, Badge } from "@/components/ui";

export function FileAppealForm() {
  const [state, formAction, pending] = useActionState(fileAppeal, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="caseType" className="mb-1 block text-sm font-semibold text-slate">
            Appeal type
          </label>
          <select
            id="caseType"
            name="caseType"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select…</option>
            <option value="GRADE">Grade appeal</option>
            <option value="MISCONDUCT">Misconduct case appeal</option>
          </select>
        </div>
        <div>
          <label htmlFor="caseRef" className="mb-1 block text-sm font-semibold text-slate">
            Case / course reference
          </label>
          <input
            id="caseRef"
            name="caseRef"
            placeholder="e.g. MTH202 or MC-2026-001"
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
      <div>
        <label htmlFor="grounds" className="mb-1 block text-sm font-semibold text-slate">
          Grounds for appeal
        </label>
        <textarea
          id="grounds"
          name="grounds"
          required
          rows={3}
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "File appeal"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Appeal filed — it is now under review.
          </p>
        ) : null}
        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ReviewAppealButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewAppeal, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="decision"
        required
        className="rounded-lg border border-slate/25 px-2 py-1.5 text-xs focus:border-brand"
      >
        <option value="">Action…</option>
        <option value="START">Begin review</option>
        <option value="APPROVED">Approve</option>
        <option value="REJECTED">Reject</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "…" : "Update"}
      </button>
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function AppealStatus({ status }: { status: string }) {
  const tone = ["APPROVED", "CLOSED"].includes(status) ? "brand" : status === "REJECTED" ? "red" : status === "UNDER_REVIEW" ? "gold" : "slate";
  return <Badge tone={tone as "brand"}>{status.replaceAll("_", " ")}</Badge>;
}
