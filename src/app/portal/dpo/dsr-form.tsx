"use client";

import { useActionState } from "react";
import { submitDataSubjectRequest } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function DsrForm() {
  const [state, formAction, pending] = useActionState(submitDataSubjectRequest, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.ok ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          Request submitted — you can track it in your requests below.
        </p>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="requestType" className="mb-1 block text-sm font-semibold text-slate">
          Request type
        </label>
        <select id="requestType" name="requestType" required className={INPUT_CLASS}>
          <option value="">Select request type…</option>
          <option value="ACCESS">Access — a copy of my personal data</option>
          <option value="RECTIFY">Rectify — correct inaccurate data</option>
          <option value="ERASE">Erase — delete my personal data</option>
          <option value="PORTABILITY">Portability — transfer my data</option>
        </select>
      </div>
      <div>
        <label htmlFor="detail" className="mb-1 block text-sm font-semibold text-slate">
          Detail
        </label>
        <textarea
          id="detail"
          name="detail"
          rows={4}
          required
          placeholder="Describe the data or records involved in your request…"
          className={INPUT_CLASS}
        />
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
      </PillButton>
    </form>
  );
}
