"use client";

import { useActionState, useState, useEffect } from "react";

function ShowPasswordCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate/40 text-brand focus:ring-brand/30"
      />
      Show password
    </label>
  );
}
import Link from "next/link";
import { login, resendVerificationEmail, createCaptcha } from "@/app/login/actions";
import { PillButton } from "@/components/ui";
import type { CaptchaChallenge } from "@/lib/captcha";

export function LoginForm() {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [state, formAction, pending] = useActionState(login, null);
  const [resendState, resendAction, resendPending] = useActionState(resendVerificationEmail, null);
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function loadCaptcha() {
      const c = await createCaptcha();
      setChallenge(c);
    }
    loadCaptcha();
  }, []);

  // Tokens expire server-side, so every failed attempt must surface a fresh
  // challenge or the user would keep re-submitting a stale one.
  useEffect(() => {
    if (!state?.error) return;
    let cancelled = false;
    createCaptcha().then((c) => {
      if (!cancelled) setChallenge(c);
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

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
      {state?.unverified ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Email not verified yet</p>
          <div className="space-y-2">
            {resendState?.sent ? (
              <p className="text-sm">✓ Verification email sent — check your inbox (and spam).</p>
            ) : resendState?.link ? (
              <p className="break-all text-xs">
                Demo mode — open this link to verify:{" "}
                <a href={resendState.link} className="font-semibold text-amber-900 underline">
                  {resendState.link}
                </a>
              </p>
            ) : resendState?.error ? (
              <p className="text-sm font-medium text-red-700">{resendState.error}</p>
            ) : null}
            <form action={resendAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="username" value={username} />
              <button
                type="submit"
                disabled={resendPending || !username}
                className="rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
              >
                {resendPending ? "Sending…" : "Resend verification email"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-semibold text-slate">
          Username
        </label>
        <input
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          autoCapitalize="characters"
          placeholder="Registration number, staff number or email"
          className="w-full rounded-xl border border-slate/25 bg-white px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-white/10"
        />
        <p className="mt-1 text-xs text-slate/75">
          Students: registration number (e.g. 26/284PHY/678). Staff: staff number (e.g. ACA9999).
        </p>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate">
          Password
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-slate/25 bg-white px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-white/10"
        />
        <div className="mt-1">
          <ShowPasswordCheckbox checked={showPassword} onChange={setShowPassword} />
        </div>
      </div>
      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div>
        {challenge ? (
          <>
            <label
              htmlFor="captchaAnswer"
              className="mb-1 block text-sm font-semibold text-slate"
            >
              {challenge.question}
            </label>
      
            <input
              key={challenge.token}
              id="captchaAnswer"
              name="captchaAnswer"
              inputMode="numeric"
              autoComplete="off"
              required
              placeholder="Answer"
              className="w-full rounded-xl border border-slate/25 bg-white px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 dark:bg-white/10"
            />
      
            <input type="hidden" name="captcha" value={challenge.token} />
      
            <p className="mt-1 text-xs text-slate/75">
              Proves you&apos;re not a bot. If the page refreshes, re-answer.
            </p>
          </>
        ) : (
          <p className="text-center text-xs text-slate/75">
            Loading CAPTCHA&hellip;
          </p>
        )}
      </div>
      <PillButton type="submit" disabled={pending || !challenge} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </PillButton>
      <p className="text-center text-xs text-slate/75">
        Forgot your password? Reset is tied to your verified contact on file —{" "}
        <Link href="/portal/helpdesk" className="font-semibold text-brand-strong underline">
          contact the helpdesk
        </Link>
      </p>
    </form>
  );
}