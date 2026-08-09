"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { submitApplication } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export function ApplicationForm({
  programmes,
  defaultJambNo,
}: {
  programmes: { id: string; code: string; name: string }[];
  defaultJambNo: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitApplication, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="programmeId" className="mb-1 block text-sm font-semibold text-slate">
            Programme
          </label>
          <select
            id="programmeId"
            name="programmeId"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select programme…</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="jambNo" className="mb-1 block text-sm font-semibold text-slate">
            JAMB registration number
          </label>
          <input
            id="jambNo"
            name="jambNo"
            defaultValue={defaultJambNo ?? undefined}
            placeholder="e.g. JAMB-00918273"
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
      <div className="rounded-xl border border-slate/10 bg-slate/5 p-4">
        <label className="flex items-start gap-3 text-sm text-slate">
          <input
            type="checkbox"
            name="parentConsent"
            required
            className="mt-1 h-4 w-4 rounded border-slate/25 accent-brand"
          />
          <span>
            I am under 18 and this application is filed with parental consent (NDPA 2023).
          </span>
        </label>
        <p className="mt-2 pl-7 text-xs text-slate/75">
          Parental consent is recorded against your application record and may be audited.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit application"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Application submitted.
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
