"use client";

import { useActionState } from "react";
import type { ModuleActionResult } from "@/lib/module-actions";
import { updateStaffProfile } from "./actions";
import { PillButton } from "@/components/ui";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

function Feedback({ state }: { state: ModuleActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p role="status" className="text-sm font-medium text-brand-dark">
        Saved.
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-red-600">
        {state.error}
      </p>
    );
  }
  return null;
}

export function StaffProfileForm({
  initial,
}: {
  initial: { designation?: string | null; bio?: string | null; orcid?: string | null };
}) {
  const [state, formAction, pending] = useActionState(updateStaffProfile, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="designation" className="mb-1 block text-sm font-semibold text-slate">
          Designation
        </label>
        <input
          id="designation"
          name="designation"
          defaultValue={initial.designation ?? ""}
          placeholder="e.g. Senior Lecturer, Computer Science"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="orcid" className="mb-1 block text-sm font-semibold text-slate">
          ORCID identifier
        </label>
        <input
          id="orcid"
          name="orcid"
          defaultValue={initial.orcid ?? ""}
          placeholder="e.g. 0000-0002-1825-0097"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-semibold text-slate">
          Short biography
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={initial.bio ?? ""}
          placeholder="Research interests, teaching and professional background…"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update staff profile"}
        </PillButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}
