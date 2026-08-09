"use client";

import { useActionState } from "react";
import { logMisconductCase, advanceMisconductCase } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function LogMisconductForm({ students }: { students: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState(logMisconductCase, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="studentId" className="mb-1 block text-sm font-semibold text-slate">
            Student
          </label>
          <select
            id="studentId"
            name="studentId"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="evidenceRef" className="mb-1 block text-sm font-semibold text-slate">
            Evidence reference
          </label>
          <input
            id="evidenceRef"
            name="evidenceRef"
            placeholder="e.g. MC-2026-002"
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-semibold text-slate">
          Case title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Examination malpractice"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Creating…" : "Log misconduct case"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Case logged and audit-trailed.
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

export function AdvanceMisconductButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(advanceMisconductCase, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Advancing…" : "Advance stage"}
      </button>
      {state?.ok ? (
        <span role="status" className="text-xs font-medium text-brand-dark">
          Advanced
        </span>
      ) : null}
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
