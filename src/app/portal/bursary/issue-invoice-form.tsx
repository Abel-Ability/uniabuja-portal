"use client";

import { useActionState } from "react";
import { issueInvoice } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const fieldClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-slate-900/60 dark:text-slate-100";

export function IssueInvoiceForm({
  moduleOptions,
}: {
  moduleOptions: { value: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(issueInvoice, null);

  return (
    <form action={formAction} className="rounded-xl border border-slate/10 bg-white p-5 dark:border-slate-200/15 dark:bg-slate-900">
      <h3 className="mb-4 font-head text-lg font-bold text-slate">Issue invoice</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invoice-regno" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            Registration number
          </label>
          <input
            id="invoice-regno"
            name="registrationNo"
            required
            placeholder="e.g. 24/123ABC/456"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="invoice-module" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            Fee module
          </label>
          <select id="invoice-module" name="module" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Select module…
            </option>
            {moduleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invoice-amount" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            Amount (₦)
          </label>
          <input id="invoice-amount" name="amountNaira" required type="number" min="1" step="0.01" placeholder="e.g. 150000" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="invoice-due" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            Due date
          </label>
          <input id="invoice-due" name="dueOn" required type="date" className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="invoice-desc" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            Description
          </label>
          <input id="invoice-desc" name="description" required maxLength={300} placeholder="e.g. 2025/2026 First semester tuition" className={fieldClass} />
        </div>
      </div>
      <div className="mt-4">
        <PillButton type="submit" disabled={pending} className="px-5 py-2.5 text-xs">
          {pending ? "Issuing…" : "Issue invoice"}
        </PillButton>
      </div>
      {state?.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mt-3 text-sm font-medium text-brand-dark">
          Invoice issued.
        </p>
      ) : null}
    </form>
  );
}
