"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/constants";

export function LogoMark({ size = 36 }: { size?: number }) {
  // Official University of Abuja logo.
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img src="/images/university-logo.png" alt="University of Abuja logo" width={size} height={size} style={{ objectFit: "contain" }} />
    </span>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/apply", label: "Apply" },
  { href: "/fees", label: "Fees" },
  { href: "/student", label: "Student" },
  { href: "/staff", label: "Staff" },
  { href: "/info", label: "Info" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  // Close the mobile menu when the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close menu when the user presses Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 pb-1 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={BRAND.orgName}>
          <LogoMark />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-head text-sm font-bold text-slate sm:text-base">
              {BRAND.orgName} (Since 1988)
            </span>
            <span className="hidden text-[10px] font-medium tracking-widest text-brand-strong sm:block sm:text-xs">
              (Now Yakubu Gowon University)
            </span>
            <span className="block truncate font-head text-[10px] font-medium italic tracking-widest text-red-600 sm:text-xs">
              The University for National Unity
            </span>
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate/80 transition-colors hover:text-brand-strong"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full bg-brand-strong px-5 py-2.5 font-head text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-dark sm:inline-flex"
          >
            Portal Login
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate/15 text-slate transition-colors hover:bg-slate/5 lg:hidden"
          >
            <span aria-hidden="true" className="relative block h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${open ? "top-1/2 -translate-y-1/2 rotate-45" : ""}`}
              />
              <span
                className={`absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute bottom-0 left-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${open ? "bottom-1/2 translate-y-1/2 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-slate/10 bg-white px-4 pb-5 pt-3 shadow-lg lg:hidden"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-slate/85 transition-colors hover:bg-slate/5 hover:text-brand-strong"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-full bg-brand-strong px-5 py-3 text-center font-head text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Portal Login
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
