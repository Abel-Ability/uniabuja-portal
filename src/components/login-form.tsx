"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, resendVerificationEmail } from "@/app/login/actions";
import type { CaptchaChallenge } from "@/lib/captcha";
import { PillButton } from "@/components/ui";

export function LoginForm({ challenge }: { challenge: CaptchaChallenge }) {
  const [state, formAction, pending] = useActionState(login, null);
  const [resendState, resendAction, resendPending] = useActionState(resendVerificationEmail, null);
  const [username, setUsername] = useState("");

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
      {state?.unverified ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                className="rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <p className="mt-1 text-xs text-slate/75">
          Students: registration number (e.g. 12/345ABC/678). Staff: staff number (e.g. AB12).
        </p>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
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
        <label htmlFor="captchaAnswer" className="mb-1 block text-sm font-semibold text-slate">
          {challenge.question}
        </label>
        <input
          id="captchaAnswer"
          name="captchaAnswer"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder="Answer"
          className="w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <input type="hidden" name="captcha" value={challenge.token} />
        <p className="mt-1 text-xs text-slate/75">
          Proves you&apos;re not a bot. If the page refreshes, re-answer.
        </p>
      </div>
      <PillButton type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </PillButton>
      <p className="text-center text-xs text-slate/75">
        Forgot your password? Reset is tied to your verified contact on file —{" "}
            <Link href="/portal/helpdesk" className="font-semibold text-brand-strong underline">
          contact the helpdesk
        </Link>
        .
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <span className="h-px flex-1 bg-slate/15" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate/75">
          demo accounts
        </span>
        <span className="h-px flex-1 bg-slate/15" aria-hidden="true" />
      </div>
      <div className="rounded-xl bg-brand-light p-3 text-xs text-brand-dark">
        <p className="font-semibold">Password: UniAbuja@2026</p>
        <ul className="mt-1 space-y-0.5">
          <li>Student: 12/345ABC/678</li>
          <li>Applicant: applicant@uniabuja.edu.ng</li>
          <li>Lecturer: AB12 · Registry: EF56 · Bursary: GH78 · Exams: KL12</li>
          <li>HOD: CD34 · DVC: UV12 · VC: WX34 · IT Admin: ST90 · PG School: MN34 · SIWES: OP56 · Timetable: QR78</li>
          <li>PG Student: UA/PG1234/567890</li>
        </ul>
      </div>
    </form>
  );
}
