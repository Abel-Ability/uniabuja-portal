"use client";

import { useActionState } from "react";
import { openTicket } from "./actions";
import { PillButton } from "@/components/ui";

export function TicketForm() {
  const [state, formAction, pending] = useActionState(openTicket, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {!state?.error && state !== null ? (
        <p
          role="status"
          className="rounded-lg border border-brand/30 bg-brand-light px-4 py-3 text-sm font-medium text-brand-dark"
        >
          Ticket submitted. Our helpdesk will respond in priority order.
        </p>
      ) : null}
      <div>
        <label htmlFor="subject" className="mb-1 block text-sm font-semibold text-slate">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={120}
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-semibold text-slate">
          Describe the issue
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="priority" className="mb-1 block text-sm font-semibold text-slate">
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        >
          <option value="LOW">Low</option>
          <option value="NORMAL" defaultChecked>
            Normal
          </option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit ticket"}
      </PillButton>
    </form>
  );
}
