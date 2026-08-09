"use client";

import { useActionState } from "react";
import { enableMfa, disableMfa, verifyStepUp } from "@/app/portal/account/mfa-actions";
import { PillButton } from "@/components/ui";

type Props = {
  initialEnabled: boolean;
  sessionMfaVerified: boolean;
};

export function MfaPanel({ initialEnabled, sessionMfaVerified }: Props) {
  const [enableState, enableAction, enabling] = useActionState(enableMfa, null);
  const [disableState, disableAction, disabling] = useActionState(disableMfa, null);
  const [stepUpState, stepUpAction, verifying] = useActionState(verifyStepUp, null);

  const enabled = initialEnabled || enableState?.ok === true;

  return (
    <div className="space-y-4">
      {!enabled ? (
        <form action={enableAction}>
          <p className="text-sm text-slate/75">
            Two-step verification adds a code from your authenticator app to your
            password on sign-in. Enabling it also unlocks step-up prompts for
            sensitive actions.
          </p>
          {enableState?.error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {enableState.error}
            </p>
          ) : null}
          <PillButton type="submit" disabled={enabling} className="mt-4">
            {enabling ? "Generating…" : "Enable two-step verification"}
          </PillButton>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-green-50 p-4">
            <div>
              <p className="text-sm font-semibold text-green-800">
                Two-step verification is on
              </p>
              <p className="text-xs text-green-700/80">
                {sessionMfaVerified
                  ? "Your current session is verified."
                  : "Complete step-up verification to unlock sensitive actions."}
              </p>
            </div>
            <form action={disableAction}>
              <button
                type="submit"
                disabled={disabling}
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {disabling ? "Turning off…" : "Turn off"}
              </button>
            </form>
          </div>

          {disableState?.ok ? (
            <p role="status" className="text-sm font-medium text-green-700">
              Two-step verification has been turned off.
            </p>
          ) : null}
          {disableState?.error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {disableState.error}
            </p>
          ) : null}

          {enableState?.ok && enableState.secret ? (
            <div className="rounded-xl border border-brand/30 bg-brand-light p-4">
              <p className="text-sm font-semibold text-brand-dark">
                Scan with your authenticator app
              </p>
              <p className="mt-1 text-xs text-slate/75">
                Add this account to Google Authenticator, Authy or similar using
                the key below (demo: a plain copy of the key). Current code:{" "}
                <span className="font-mono font-bold text-slate">{enableState.code}</span>
              </p>
              <p className="mt-3 font-mono text-sm font-bold tracking-wider text-brand-dark">
                {enableState.secret}
              </p>
            </div>
          ) : null}

          {!sessionMfaVerified ? (
            <form action={stepUpAction} className="space-y-3 rounded-xl bg-slate/5 p-4">
              <div>
                <p className="text-sm font-semibold text-slate">Step-up verification</p>
                <p className="text-xs text-slate/75">
                  Verify this device to unlock high-risk actions for 30 minutes.
                </p>
              </div>
              {stepUpState?.ok ? (
                <p role="status" className="text-sm font-medium text-green-700">
                  Verified. You can now perform sensitive actions.
                </p>
              ) : null}
              {stepUpState?.error ? (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {stepUpState.error}
                </p>
              ) : null}
              {!stepUpState?.ok ? (
                <div className="flex gap-3">
                  <input
                    name="code"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    placeholder="123456"
                    className="w-40 rounded-xl border border-slate/25 px-4 py-2 font-mono text-center text-lg tracking-[0.4em] focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                  <PillButton type="submit" disabled={verifying}>
                    {verifying ? "Verifying…" : "Verify"}
                  </PillButton>
                </div>
              ) : null}
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
