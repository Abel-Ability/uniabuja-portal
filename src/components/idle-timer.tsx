"use client";

import { useEffect, useRef, useState } from "react";
import { IDLE_TIMEOUT_MS } from "@/lib/constants";
import { logout } from "@/app/login/actions";

const GRACE_MS = 60_000;

export function IdleTimer() {
  const [show, setShow] = useState(false);
  const [remaining, setRemaining] = useState(GRACE_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reset = () => {
      setShow(false);
      if (graceRef.current) clearInterval(graceRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShow(true);
        setRemaining(GRACE_MS);
        graceRef.current = setInterval(() => {
          setRemaining((r) => {
            if (r <= 1000) {
              if (graceRef.current) clearInterval(graceRef.current);
              void logout();
              return 0;
            }
            return r - 1000;
          });
        }, 1000);
      }, IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "focus",
    ];
    for (const e of events) window.addEventListener(e, reset);
    reset();

    return () => {
      for (const e of events) window.removeEventListener(e, reset);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (graceRef.current) clearInterval(graceRef.current);
    };
  }, []);

  if (!show) return null;

  const seconds = Math.ceil(remaining / 1000);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session expiring"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate/10 bg-white p-6 shadow-2xl dark:border-slate-700/60 dark:bg-slate-800">
        <h2 className="font-head text-lg font-bold text-slate">Your session is expiring</h2>
        <p className="mt-2 text-sm text-slate/70">
          You have been inactive for a while. For your security you will be
          signed out in <span className="font-semibold text-brand">{seconds}s</span>{" "}
          unless you continue.
        </p>
        <button
          type="button"
          onClick={() => {
            setShow(false);
            if (graceRef.current) clearInterval(graceRef.current);
          }}
          className="mt-4 rounded-full bg-brand-strong px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          I&apos;m still here
        </button>
      </div>
    </div>
  );
}
