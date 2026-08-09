"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const DOCUMENT_KINDS = ["RESULT_SLIP", "CERTIFICATE", "PASSPORT", "EVIDENCE", "REFEREE"];

export function DocumentUploadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(uploadDocument, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="mb-1 block text-sm font-semibold text-slate">
            Document type
          </label>
          <select
            id="kind"
            name="kind"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select type…</option>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fileName" className="mb-1 block text-sm font-semibold text-slate">
            File name
          </label>
          <input
            id="fileName"
            name="fileName"
            required
            placeholder="e.g. waec_result.pdf"
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload document"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Document recorded for verification.
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
