"use client";

import { useActionState } from "react";
import {
  proposeAppointment,
  approveAppointment,
  rejectAppointment,
  recordAppointment,
  type ModuleActionResult,
} from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

function Feedback({ state }: { state: ModuleActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return <p role="status" className="text-sm font-medium text-brand-dark">Done.</p>;
  }
  if (state.error) {
    return <p role="alert" className="text-sm font-medium text-red-600">{state.error}</p>;
  }
  return null;
}

export function ProposeAppointmentForm({
  canProposeHod,
  canProposeDean,
  staff,
  searching = true,
}: {
  canProposeHod: boolean;
  canProposeDean: boolean;
  staff: { id: string; label: string }[];
  searching?: boolean;
}) {
  const [state, action, pending] = useActionState(proposeAppointment, null);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="appointeeId" className="mb-1 block text-sm font-semibold text-slate">
            Appointee
          </label>
          <select id="appointeeId" name="appointeeId" required className={inputClass}>
            <option value="">
              {searching ? "Select staff member…" : "Search for a staff member first…"}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-semibold text-slate">
            Target role
          </label>
          <select id="role" name="role" required className={inputClass}>
            <option value="">Select role…</option>
            {canProposeHod ? <option value="HOD">Head of Department</option> : null}
            {canProposeDean ? (
              <>
                <option value="DEAN">Dean of Faculty</option>
                <option value="DIRECTOR_ACADEMIC_PLANNING">Director of Academic Planning</option>
              </>
            ) : null}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="unit" className="mb-1 block text-sm font-semibold text-slate">
            Department / Faculty / Directorate
          </label>
          <input
            id="unit"
            name="unit"
            required
            placeholder="e.g. Computer Science, Physical Science, Academic Planning"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="academicSession" className="mb-1 block text-sm font-semibold text-slate">
            Academic session
          </label>
          <input
            id="academicSession"
            name="academicSession"
            required
            defaultValue="2025/2026"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Propose appointment"}
        </PillButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AppointmentActionButtons({ id, mode }: { id: string; mode: "approve" | "record" }) {
  const [approveState, approveAction, approvePending] = useActionState(approveAppointment, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectAppointment, null);
  const [recordState, recordAction, recordPending] = useActionState(recordAppointment, null);

  if (mode === "record") {
    return (
      <form action={recordAction}>
        <input type="hidden" name="id" value={id} />
        <PillButton type="submit" disabled={recordPending} className="px-4 py-1.5 text-xs">
          {recordPending ? "Recording…" : "Record & issue"}
        </PillButton>
        <Feedback state={recordState} />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="id" value={id} />
        <PillButton type="submit" disabled={approvePending} className="px-4 py-1.5 text-xs">
          {approvePending ? "Approving…" : "Approve"}
        </PillButton>
        <Feedback state={approveState} />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="id" value={id} />
        <PillButton
          type="submit"
          variant="outline"
          disabled={rejectPending}
          className="px-4 py-1.5 text-xs text-red-600"
        >
          {rejectPending ? "Rejecting…" : "Reject"}
        </PillButton>
        <Feedback state={rejectState} />
      </form>
    </div>
  );
}
