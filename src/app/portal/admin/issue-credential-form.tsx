"use client";

import { useActionState } from "react";
import { issueApiCredential } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const PROVIDERS = [
  "JAMB",
  "WAEC",
  "NIPEDS",
  "REMITA",
  "NIBSS",
  "GIFMIS",
  "ITEX",
  "NYSC",
];

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function IssueCredentialForm() {
  const [state, formAction, pending] = useActionState(issueApiCredential, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          Credential issued.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
        <div>
          <label htmlFor="credential-provider" className="mb-1 block text-sm font-semibold text-slate">
            Provider
          </label>
          <select id="credential-provider" name="provider" className={inputClass}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="credential-label" className="mb-1 block text-sm font-semibold text-slate">
            Label
          </label>
          <input
            id="credential-label"
            name="label"
            required
            maxLength={80}
            placeholder="e.g. Production admissions feed"
            className={inputClass}
          />
        </div>
        <PillButton type="submit" disabled={pending} className="whitespace-nowrap">
          {pending ? "Issuing…" : "Issue credential"}
        </PillButton>
      </div>
    </form>
  );
}
