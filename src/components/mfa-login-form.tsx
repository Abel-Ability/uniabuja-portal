"use client";

import { useActionState } from "react";
import { verifyMfaCode } from "@/app/login/mfa/actions";
import { PillButton } from "@/components/ui";

export function MfaLoginForm() {
  const [state, formAction, pending] = useActionState(verifyMfaCode, null);

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
      <div>
        <label htmlFor="code" className="mb-1 block text-sm font-semibold text-slate">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          placeholder="123456"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <PillButton type="submit" disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Verify & continue"}
      </PillButton>
      <p className="text-center text-xs text-slate/75">
        Can&apos;t access your authenticator?{" "}
            <span className="font-semibold text-brand-strong">contact the helpdesk</span>.
      </p>
    </form>
  );
}
