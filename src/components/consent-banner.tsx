"use client";

import { useSyncExternalStore } from "react";
import { PillButton } from "./ui";

// Cookie/tracking consent banner (Consent Management Platform) on the
// public-facing site — distinct from the in-portal NDPA data-subject tools.
const STORAGE_KEY = "uap-consent";

let listeners: (() => void)[] = [];

function subscribe(onStoreChange: () => void) {
  listeners = [...listeners, onStoreChange];
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners = listeners.filter((l) => l !== onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function emitChange() {
  listeners.forEach((l) => l());
}

function getConsent(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerConsent(): string | null {
  return null;
}

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribe, getConsent, getServerConsent);
  const visible = consent === null;

  function accept(pref: "all" | "necessary") {
    localStorage.setItem(STORAGE_KEY, pref);
    emitChange();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate/10 bg-brand-strong px-4 py-4 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-sm text-white/90">
          We use essential cookies to run the portal and optional analytics to
          improve it. We never sell your data. See our{" "}
          <a
            href="/documents/privacy-notice.pdf"
            className="font-semibold text-gold underline underline-offset-2"
          >
            Privacy Notice
          </a>{" "}
          (NDPA 2023 compliant).
        </p>
        <div className="flex shrink-0 gap-2">
          <PillButton variant="light" onClick={() => accept("necessary")}>
            Essential only
          </PillButton>
          <PillButton onClick={() => accept("all")}>Accept all</PillButton>
        </div>
      </div>
    </div>
  );
}
