"use client";

import { useActionState } from "react";
import { updateNotificationPreferences } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const OPTIONS = [
  {
    name: "allowEmail",
    label: "Email notifications",
    hint: "Updates on results, fees, clearance and official notices via email.",
  },
  {
    name: "allowSms",
    label: "SMS notifications",
    hint: "Time-sensitive alerts such as deadlines and exam schedules via SMS.",
  },
  {
    name: "allowInApp",
    label: "In-app notifications",
    hint: "Messages in the portal notification centre.",
  },
  {
    name: "allowPromotional",
    label: "Promotional updates",
    hint: "Newsletters and university marketing communications.",
  },
];

export function NotificationPreferencesForm({
  prefs,
}: {
  prefs: { allowEmail: boolean; allowSms: boolean; allowInApp: boolean; allowPromotional: boolean };
}) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferences, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.ok ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          Preferences saved.
        </p>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="sr-only">Notification preferences</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.name}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate/10 p-3"
          >
            <input
              type="checkbox"
              name={o.name}
              defaultChecked={prefs[o.name as keyof typeof prefs]}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold text-slate">{o.label}</span>
              <span className="block text-xs text-slate/75">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </PillButton>
    </form>
  );
}
