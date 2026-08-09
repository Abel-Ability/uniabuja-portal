"use client";

import { useActionState, useState } from "react";
import {
  payInvoice,
  requestTranscript,
  issueTranscript,
  signOffClearance,
  startClearance,
  applyHostel,
  allocateBed,
  generateHostelInvoice,
  resolveMaintenance,
  type ModuleActionResult,
} from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

function ActionResult({ state }: { state: ModuleActionResult | null }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return <p role="status" className="text-sm font-medium text-brand-dark">Done.</p>;
  }
  return null;
}

export function PayButton({ invoiceId, label = "Pay now" }: { invoiceId: string; label?: string }) {
  const [state, action, pending] = useActionState(payInvoice, null);
  void state;
  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Paying…" : label}
      </button>
    </form>
  );
}

export function IssueTranscriptButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(issueTranscript, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Issuing…" : "Mark issued"}
      </button>
      <ActionResult state={state} />
    </form>
  );
}

export function SignOffButton({ itemId, department }: { itemId: string; department: string }) {
  const [state, action, pending] = useActionState(signOffClearance, null);
  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Signing…" : `Sign off ${department}`}
      </button>
      <ActionResult state={state} />
    </form>
  );
}

export function StartClearanceButton() {
  const [state, action, pending] = useActionState(startClearance, null);
  return (
    <form action={action}>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start clearance"}
      </PillButton>
      <ActionResult state={state} />
    </form>
  );
}

export function HostelApplyForm({ hostels }: { hostels: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(applyHostel, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="hostelId" className="mb-1 block text-sm font-semibold text-slate">
            Preferred hostel
          </label>
          <select
            id="hostelId"
            name="hostelId"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select hostel…</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="roomType" className="mb-1 block text-sm font-semibold text-slate">
            Room type
          </label>
          <select
            id="roomType"
            name="roomType"
            defaultValue="shared"
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="shared">Shared room</option>
            <option value="executive">Executive</option>
          </select>
        </div>
      </div>
      <input type="hidden" name="academicSession" value="2025/2026" />
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Applying…" : "Apply for accommodation"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Application submitted — awaiting allocation.
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

export function AllocateBedButton() {
  const [state, action, pending] = useActionState(allocateBed, null);
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Allocating…" : "Allocate next applicant"}
      </button>
      <ActionResult state={state} />
    </form>
  );
}

export function GenerateHostelInvoiceButton() {
  const [state, action, pending] = useActionState(generateHostelInvoice, null);
  return (
    <form action={action}>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate accommodation invoice"}
      </PillButton>
      <ActionResult state={state} />
    </form>
  );
}

export function ResolveMaintenanceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resolveMaintenance, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-strong px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Resolving…" : "Mark resolved"}
      </button>
      <ActionResult state={state} />
    </form>
  );
}

export function TranscriptRequestForm() {
  const [state, formAction, pending] = useActionState(requestTranscript, null);
  const [showCourier, setShowCourier] = useState(false);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="purpose" className="mb-1 block text-sm font-semibold text-slate">
          Purpose
        </label>
        <select
          id="purpose"
          name="purpose"
          required
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        >
          <option value="">Select purpose…</option>
          <option value="JOB">Job application</option>
          <option value="FURTHER_STUDY">Further study</option>
          <option value="IMMIGRATION">Immigration / visa</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="destinationInstitution" className="mb-1 block text-sm font-semibold text-slate">
          Destination institution / employer
        </label>
        <input
          id="destinationInstitution"
          name="destinationInstitution"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="copies" className="mb-1 block text-sm font-semibold text-slate">
            Copies (₦10,000 each)
          </label>
          <input
            id="copies"
            name="copies"
            type="number"
            min={1}
            max={5}
            defaultValue={1}
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label htmlFor="courier" className="flex items-center gap-2 text-sm font-semibold text-slate">
            <input
              id="courier"
              name="courier"
              type="checkbox"
              onChange={(e) => setShowCourier(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Courier delivery (₦2,000)
          </label>
        </div>
      </div>
      {showCourier ? (
        <div>
          <label htmlFor="courierAddress" className="mb-1 block text-sm font-semibold text-slate">
            Delivery address
          </label>
          <input
            id="courierAddress"
            name="courierAddress"
            required
            className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <PillButton type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Request transcript"}
        </PillButton>
        {state?.ok ? (
          <p role="status" className="text-sm font-medium text-brand-dark">
            Request created — an invoice is now on your Fees page.
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
