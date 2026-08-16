"use client";

import { useActionState } from "react";
import { verifyReference } from "./actions";
import { PillButton, Badge } from "@/components/ui";

export function VerifyForm() {
  const [state, formAction, pending] = useActionState(verifyReference, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="referenceNo" className="mb-1 block text-sm font-semibold text-slate">
          Transcript reference number
        </label>
        <input
          id="referenceNo"
          name="referenceNo"
          required
          autoCapitalize="characters"
          placeholder="e.g. TXN-2026-000001"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}
      {state?.verified ? (
        <div role="status" className="space-y-2 rounded-xl border border-brand/30 bg-brand-light p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-head font-bold text-brand-dark">Record verified</p>
            <Badge tone="brand">{(state.status ?? "").replaceAll("_", " ")}</Badge>
          </div>
          <p className="text-slate">
            <strong>Graduate:</strong> {state.graduate}
          </p>
          {state.programme ? (
            <p className="text-slate">
              <strong>Programme:</strong> {state.programme}
            </p>
          ) : null}
          {state.session ? (
            <p className="text-slate">
              <strong>Registration:</strong> {state.session}
            </p>
          ) : null}
          {state.issuedAt ? (
            <p className="text-slate">
              <strong>Issued:</strong>{" "}
              {new Date(state.issuedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      <PillButton type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </PillButton>
    </form>
  );
}
