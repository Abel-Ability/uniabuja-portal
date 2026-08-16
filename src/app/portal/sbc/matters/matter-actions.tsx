"use client";

import { useActionState } from "react";
import { screenMatter, recordSenateDecision, withdrawMatter } from "../actions";
import { PillButton } from "@/components/ui";
import { RESOLUTIONS, RESOLUTION_LABELS } from "@/lib/senate-constants";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function MatterActions({
  id,
  status,
  reference,
}: {
  id: string;
  status: string;
  reference: string;
}) {
  const [screenState, screenAction, screenPending] = useActionState(screenMatter, null);
  const [decisionState, decisionAction, decisionPending] = useActionState(recordSenateDecision, null);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawMatter, null);

  if (status === "SUBMITTED") {
    return (
      <div className="space-y-2">
        <form action={screenAction}>
          <input type="hidden" name="id" value={id} />
          <PillButton type="submit" disabled={screenPending} className="px-4 py-2 text-xs">
            {screenPending ? "Screening…" : "Screen for Senate"}
          </PillButton>
        </form>
        <form action={withdrawAction}>
          <input type="hidden" name="id" value={id} />
          <PillButton type="submit" variant="outline" disabled={withdrawPending} className="px-4 py-2 text-xs">
            {withdrawPending ? "Withdrawing…" : "Withdraw"}
          </PillButton>
        </form>
        {screenState?.error ? (
          <p className="text-xs font-medium text-red-700">{screenState.error}</p>
        ) : null}
        {withdrawState?.error ? (
          <p className="text-xs font-medium text-red-700">{withdrawState.error}</p>
        ) : null}
      </div>
    );
  }

  if (status === "SCREENED") {
    return (
      <form action={decisionAction} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor={`decision-resolution-${id}`} className="mb-1 block text-xs font-semibold text-slate">
            Resolution
          </label>
          <select id={`decision-resolution-${id}`} name="resolution" defaultValue="APPROVED" className={inputClass}>
            {RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                {RESOLUTION_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`decision-body-${id}`} className="mb-1 block text-xs font-semibold text-slate">
            Decision
          </label>
          <textarea
            id={`decision-body-${id}`}
            name="decisionBody"
            required
            rows={2}
            placeholder={`Decision on ${reference}…`}
            className={inputClass}
          />
        </div>
        <PillButton type="submit" disabled={decisionPending} className="px-4 py-2 text-xs">
          {decisionPending ? "Recording…" : "Record decision"}
        </PillButton>
        {decisionState?.error ? (
          <p className="text-xs font-medium text-red-700">{decisionState.error}</p>
        ) : null}
        {decisionState?.ok ? (
          <p className="text-xs font-medium text-brand-dark">Decision recorded.</p>
        ) : null}
      </form>
    );
  }

  return null;
}
