"use client";

import { useActionState, useState } from "react";
import { updateNotificationPreferences } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

export type NotificationPrefs = {
  allowEmail: boolean;
  allowSms: boolean;
  allowInApp: boolean;
  allowPromotional: boolean;
};

const OPTIONS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "allowEmail", label: "Email", hint: "Transactional updates by email" },
  { key: "allowSms", label: "SMS", hint: "Time-sensitive alerts by text message" },
  { key: "allowInApp", label: "In-app", hint: "Alerts shown inside the portal" },
  { key: "allowPromotional", label: "Promotional", hint: "Newsletters and campaign messages" },
];

export function NotificationPreferenceForm({ initial }: { initial: NotificationPrefs }) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferences, null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          Preferences saved.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label key={o.key} className="flex items-start gap-3 rounded-xl border border-slate/20 p-4">
            <input
              type="checkbox"
              name={o.key}
              checked={prefs[o.key]}
              onChange={(e) => setPrefs((p) => ({ ...p, [o.key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold text-slate">{o.label}</span>
              <span className="block text-xs text-slate/75">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </PillButton>
    </form>
  );
}
