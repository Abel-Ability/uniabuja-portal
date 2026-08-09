"use client";

import { useActionState } from "react";
import { applyPg } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function ApplyPgForm({
  programmes,
}: {
  programmes: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(applyPg, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="programmeId" className="mb-1 block text-sm font-semibold text-slate">
          Programme
        </label>
        <select id="programmeId" name="programmeId" required className={inputClass}>
          <option value="">Select programme…</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="referee1Name" className="mb-1 block text-sm font-semibold text-slate">
            Referee 1 name
          </label>
          <input id="referee1Name" name="referee1Name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="referee1Email" className="mb-1 block text-sm font-semibold text-slate">
            Referee 1 email
          </label>
          <input id="referee1Email" name="referee1Email" type="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="referee2Name" className="mb-1 block text-sm font-semibold text-slate">
            Referee 2 name
          </label>
          <input id="referee2Name" name="referee2Name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="referee2Email" className="mb-1 block text-sm font-semibold text-slate">
            Referee 2 email
          </label>
          <input id="referee2Email" name="referee2Email" type="email" className={inputClass} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit application"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Application submitted — awaiting screening.
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
