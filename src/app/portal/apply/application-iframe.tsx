"use client";

import { useState } from "react";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_ADMISSIONS_APPS_SCRIPT_URL ?? "";
// ?embed=true renders the Apps Script without its own header/footer chrome.
const EMBEDDED_URL = APPS_SCRIPT_URL ? `${APPS_SCRIPT_URL}?embed=true` : "";

export function ApplicationIframe() {
  const [isOpen, setIsOpen] = useState(false);

  if (!APPS_SCRIPT_URL) {
    return (
      <div className="rounded-2xl border border-dashed border-slate/30 bg-slate/5 p-10 text-center">
        <p className="font-head font-semibold text-slate">Application System Not Configured</p>
        <p className="mt-2 text-sm text-slate/60">
          The Google Apps Script application form has not been configured yet.
          Please contact the IT administrator to set up the NEXT_PUBLIC_ADMISSIONS_APPS_SCRIPT_URL environment variable.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate/10 bg-white p-8 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
          <h2 className="font-head text-2xl font-bold text-slate">Apply for Admission</h2>
          <p className="mt-3 text-sm text-slate/70">
            Applications for the 2026/27 session are now open. Complete the application form below
            to submit your application for undergraduate, distance learning, or transfer entry.
          </p>
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate/10 bg-slate/5 p-4">
              <h3 className="text-sm font-semibold text-slate">Before you begin</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate/70">
                <li>• Have your JAMB registration number ready</li>
                <li>• Prepare your O-Level results (WAEC/NECO)</li>
                <li>• Have a recent passport photograph</li>
                <li>• Ensure your email address is valid</li>
              </ul>
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-strong px-8 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark hover:shadow-lg"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>

      {/* Modal Iframe */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate/10 px-6 py-4">
              <h2 className="font-head text-lg font-bold text-slate">University of Abuja — Admission Application</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate/60 hover:text-slate"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={EMBEDDED_URL}
                className="h-full w-full border-0"
                title="Admission Application Form"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
