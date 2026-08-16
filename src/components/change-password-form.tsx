"use client";

import { useActionState, useState } from "react";
import { changePassword } from "@/app/login/actions";
import { PillButton } from "@/components/ui";
import { PASSWORD_POLICY } from "@/lib/constants";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const [showPasswords, setShowPasswords] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}
      <div className="rounded-xl bg-brand-light p-3 text-xs text-brand-dark">
        Your password is temporary. Set a new one before continuing.
      </div>
      <div>
        <label
          htmlFor="currentPassword"
          className="mb-1 block text-sm font-semibold text-slate"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label
          htmlFor="newPassword"
          className="mb-1 block text-sm font-semibold text-slate"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={PASSWORD_POLICY.minLength}
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <p className="mt-1 text-xs text-slate/75">
          At least {PASSWORD_POLICY.minLength} characters with an uppercase letter, a
          lowercase letter, a digit and a special character. Never reuse your last{" "}
          {PASSWORD_POLICY.history} passwords.
        </p>
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-semibold text-slate"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-slate">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(e) => setShowPasswords(e.target.checked)}
          className="h-4 w-4 rounded border-slate/40 text-brand focus:ring-brand/30"
        />
        Show passwords
      </label>
      <PillButton type="submit" disabled={pending} className="w-full">
        {pending ? "Updating…" : "Update password"}
      </PillButton>
    </form>
  );
}
