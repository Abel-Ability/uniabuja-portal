"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { freshCaptchaChallenge, submitPublicApplication } from "./actions";
import type { CaptchaChallenge } from "@/lib/captcha";
import { PillButton, PillLink } from "@/components/ui";

export type ProgrammeOption = {
  id: string;
  code: string;
  name: string;
  programmeType: string;
};

const APPLICATION_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "UTME", label: "UTME (JAMB)", hint: "Bachelor's entry through JAMB" },
  { value: "DIRECT_ENTRY", label: "Direct Entry", hint: "ND/HND, IJMB, JUPEB, A'level" },
  { value: "PG", label: "Postgraduate", hint: "PGD, Masters, PhD" },
  { value: "DISTANCE_LEARNING", label: "Distance Learning", hint: "Flexible part-time study" },
];

const STEPS = [
  { title: "Personal details", blurb: "Who is applying" },
  { title: "Academic details", blurb: "Programme and JAMB" },
  { title: "Review & submit", blurb: "Confirm everything" },
];

const inputCls =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function ApplyForm({
  programmes,
  challenge: challengeProp,
}: {
  programmes: ProgrammeOption[];
  challenge: CaptchaChallenge;
}) {
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState(submitPublicApplication, null);
  const [pending, startTransition] = useTransition();
  const [challenge, setChallenge] = useState<CaptchaChallenge>(challengeProp);

  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    applicationType: "",
    programmeId: "",
    jambNo: "",
    jambScore: "",
    parentConsent: false,
    dataConsent: false,
    captchaAnswer: "",
  });

  const set = (key: keyof typeof draft) => (value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function refreshChallenge() {
    startTransition(async () => {
      const next = await freshCaptchaChallenge();
      setChallenge(next);
      setDraft((d) => ({ ...d, captchaAnswer: "" }));
    });
  }

  const filtered = programmes.filter(
    (p) => p.programmeType === draft.applicationType,
  );
  const selectedProgramme = programmes.find((p) => p.id === draft.programmeId);

  function goTo(next: number) {
    if (next < step) {
      setStep(next);
      return;
    }
    if (step === 0 && (!draft.fullName.trim() || !draft.email.trim() || !draft.phone.trim())) {
      return;
    }
    if (step === 1 && (!draft.applicationType || !draft.programmeId)) {
      return;
    }
    setStep(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 2) {
      goTo(step + 1);
      return;
    }
    const fd = new FormData();
    fd.set("fullName", draft.fullName);
    fd.set("email", draft.email);
    fd.set("phone", draft.phone);
    fd.set("dob", draft.dob);
    fd.set("gender", draft.gender);
    fd.set("applicationType", draft.applicationType);
    fd.set("programmeId", draft.programmeId);
    fd.set("jambNo", draft.jambNo);
    fd.set("jambScore", draft.jambScore);
    fd.set("parentConsent", draft.parentConsent ? "on" : "");
    fd.set("dataConsent", draft.dataConsent ? "on" : "");
    fd.set("captcha", challenge.token);
    fd.set("captchaAnswer", draft.captchaAnswer ?? "");
    startTransition(() => formAction(fd));
  }

  const firstName = draft.fullName.split(/\s+/)[0] ?? "";

  if (state?.ok) {
    return (
      <div className="rounded-3xl border border-brand/20 bg-brand-light p-6 sm:p-10" role="status">
        <h2 className="font-head text-2xl font-bold text-slate-dark">
          Thank you, {firstName}. Application received.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate/80">
          Your application for <strong>{state.programme}</strong> has been submitted to the
          admissions team for screening and CAPS/NIPEDS verification. Reference:{" "}
          <code className="font-mono text-xs">{state.reference}</code>.
        </p>

        <div className="mt-6 rounded-2xl border border-slate/10 bg-white p-5 text-sm">
          <p className="font-head font-semibold text-slate">Your portal sign-in</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Username</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-slate">{state.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Password</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-slate">
                {state.tempPassword ? (
                  <>
                    {state.tempPassword}
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      shown once
                    </span>
                  </>
                ) : (
                  "your existing portal password"
                )}
              </dd>
            </div>
          </dl>
          {state.tempPassword ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              You will be asked to change this temporary password on first sign-in. Save it
              somewhere safe now — we cannot recover it afterwards.
            </p>
          ) : (
            <p className="mt-4 text-xs text-slate/70">
              Sign in with your existing portal password to track this application.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <PillLink href="/login">Sign in to the portal</PillLink>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-strong px-6 py-3 font-head text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-strong hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* step indicator */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Application steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true" className="text-slate/30">→</span> : null}
            <span
              className={`rounded-full px-4 py-2 font-head text-sm font-semibold ${
                i === step
                  ? "bg-brand-strong text-white"
                  : i < step
                    ? "bg-brand-light text-brand-dark"
                    : "bg-slate/10 text-slate/70"
              }`}
            >
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {/* honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {step === 0 ? (
        <fieldset className="grid gap-4 rounded-2xl border border-slate/10 bg-white p-5 sm:p-6">
          <legend className="sr-only">Personal details</legend>
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-semibold text-slate">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              value={draft.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              required
              autoComplete="name"
              placeholder="e.g. Adaeze Okafor"
              className={inputCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate/75">
                Becomes your portal username. No sign-up needed — an account is created for you.
              </p>
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                value={draft.phone}
                onChange={(e) => set("phone")(e.target.value)}
                required
                autoComplete="tel"
                placeholder="e.g. 0803 123 4567"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dob" className="mb-1 block text-sm font-semibold text-slate">
                Date of birth <span className="font-normal text-slate/70">(optional)</span>
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                value={draft.dob}
                onChange={(e) => set("dob")(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="gender" className="mb-1 block text-sm font-semibold text-slate">
                Gender <span className="font-normal text-slate/70">(optional)</span>
              </label>
              <select
                id="gender"
                name="gender"
                value={draft.gender}
                onChange={(e) => set("gender")(e.target.value)}
                className={inputCls}
              >
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>
            </div>
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="space-y-4 rounded-2xl border border-slate/10 bg-white p-5 sm:p-6">
          <legend className="sr-only">Academic details</legend>
          <div>
            <span className="mb-2 block text-sm font-semibold text-slate">Application type</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {APPLICATION_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${
                    draft.applicationType === t.value
                      ? "border-brand-strong bg-brand-light"
                      : "border-slate/15 hover:border-slate/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="applicationType"
                    value={t.value}
                    checked={draft.applicationType === t.value}
                    onChange={(e) => {
                      set("applicationType")(e.target.value);
                      set("programmeId")("");
                    }}
                    className="mt-1 h-4 w-4 accent-brand"
                  />
                  <span>
                    <span className="block font-head text-sm font-semibold text-slate">{t.label}</span>
                    <span className="block text-xs text-slate/70">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="programmeId" className="mb-1 block text-sm font-semibold text-slate">
                Programme
              </label>
              <select
                id="programmeId"
                name="programmeId"
                value={draft.programmeId}
                onChange={(e) => set("programmeId")(e.target.value)}
                required
                disabled={!draft.applicationType}
                className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">
                  {draft.applicationType ? "Select programme…" : "Choose an application type first"}
                </option>
                {filtered.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="jambNo" className="mb-1 block text-sm font-semibold text-slate">
                JAMB registration number <span className="font-normal text-slate/70">(optional)</span>
              </label>
              <input
                id="jambNo"
                name="jambNo"
                value={draft.jambNo}
                onChange={(e) => set("jambNo")(e.target.value)}
                placeholder="e.g. 2026/01234567AB"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="jambScore" className="mb-1 block text-sm font-semibold text-slate">
              JAMB score <span className="font-normal text-slate/70">(optional)</span>
            </label>
            <input
              id="jambScore"
              name="jambScore"
              type="number"
              min={0}
              max={400}
              value={draft.jambScore}
              onChange={(e) => set("jambScore")(e.target.value)}
              placeholder="e.g. 250"
              className={inputCls}
            />
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <dl className="rounded-2xl border border-slate/10 bg-white p-5 sm:p-6">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Full name</dt>
                <dd className="mt-1 text-sm font-medium text-slate">{draft.fullName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Email</dt>
                <dd className="mt-1 text-sm font-medium text-slate">{draft.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Phone</dt>
                <dd className="mt-1 text-sm font-medium text-slate">{draft.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Application type</dt>
                <dd className="mt-1 text-sm font-medium text-slate">
                  {APPLICATION_TYPES.find((t) => t.value === draft.applicationType)?.label ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">Programme</dt>
                <dd className="mt-1 text-sm font-medium text-slate">
                  {selectedProgramme
                    ? `${selectedProgramme.code} · ${selectedProgramme.name}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate/70">JAMB</dt>
                <dd className="mt-1 text-sm font-medium text-slate">
                  {draft.jambNo ? `${draft.jambNo}${draft.jambScore ? ` (${draft.jambScore})` : ""}` : "—"}
                </dd>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="mt-4 text-sm font-semibold text-brand-strong underline underline-offset-2 hover:text-brand-dark"
            >
              Edit personal details
            </button>
          </dl>

          <div className="space-y-3 rounded-2xl border border-slate/10 bg-white p-5 sm:p-6">
            <label className="flex items-start gap-3 text-sm text-slate">
              <input
                type="checkbox"
                name="parentConsent"
                checked={draft.parentConsent}
                onChange={(e) => set("parentConsent")(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate/25 accent-brand"
              />
              <span>
                I am under 18 and this application is filed with parental consent (NDPA 2023).
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate">
              <input
                type="checkbox"
                name="dataConsent"
                checked={draft.dataConsent}
                onChange={(e) => set("dataConsent")(e.target.checked)}
                required
                className="mt-1 h-4 w-4 rounded border-slate/25 accent-brand"
              />
              <span>
                I consent to the University processing my personal data for admission purposes in
                line with the Data Protection policy.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-slate/10 bg-white p-5 sm:p-6">
            <label htmlFor="captchaAnswer" className="mb-1 block text-sm font-semibold text-slate">
              {challenge.question}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="captchaAnswer"
                name="captchaAnswer"
                inputMode="numeric"
                autoComplete="off"
                required
                placeholder="Answer"
                value={draft.captchaAnswer}
                onChange={(e) => set("captchaAnswer")(e.target.value)}
                className={inputCls}
              />
              <PillButton
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={pending}
                onClick={refreshChallenge}
              >
                Refresh
              </PillButton>
            </div>
            <p className="mt-1 text-xs text-slate/75">
              Proves you&apos;re not a bot. Refresh generates a new challenge.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <PillButton type="button" variant="outline" onClick={() => setStep(step - 1)}>
            ← Back
          </PillButton>
        ) : (
          <span className="hidden sm:block" aria-hidden="true" />
        )}
        {step < 2 ? (
          <PillButton type="submit">
            Continue →
          </PillButton>
        ) : (
          <PillButton type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit application"}
          </PillButton>
        )}
      </div>

      {state?.ok ? null : state?.error ? (
        <p role="status" className="sr-only">
          Submission failed. Check the error above.
        </p>
      ) : null}
    </form>
  );
}
