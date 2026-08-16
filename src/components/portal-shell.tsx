"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/header";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/login/actions";
import { ROLE_LABELS } from "@/lib/constants";

export type ShellUser = {
  fullName: string;
  username: string;
  role: string;
  email: string;
};

export type ShellModule = {
  href: string;
  label: string;
  description: string;
};

const EXTRA_LINKS = [
  { href: "/portal/notifications", label: "Notifications", desc: "Alerts and messages" },
  { href: "/portal/account", label: "Account & Security", desc: "Password, MFA, sessions" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PortalShell({
  user,
  modules,
  children,
  dashboard = { href: "/portal/dashboard", label: "Dashboard", desc: "Overview" },
}: {
  user: ShellUser;
  modules: ShellModule[];
  children: React.ReactNode;
  dashboard?: { href: string; label: string; desc: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = [
    dashboard,
    ...modules
      .map((m) => {
        if (m.href === dashboard.href) return null;
        return { href: m.href, label: m.label, desc: m.description };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null),
    ...EXTRA_LINKS,
  ];

  const isActive = (href: string) => (href === dashboard.href ? pathname === href : pathname.startsWith(href));

const HelpLink = (
    <nav aria-label="Help" className="border-t border-slate/10 p-3">
      <Link
        href={`/portal/help?from=${encodeURIComponent(pathname)}`}
        onClick={() => setOpen(false)}
        className="flex flex-col rounded-xl border border-slate/10 bg-slate/5 px-3 py-2.5 transition-colors hover:bg-slate/10"
      >
        <span className="text-sm font-semibold text-slate">Help &amp; Guide</span>
        <span className="text-[11px] text-slate/60">How to use your workspace</span>
      </Link>
    </nav>
  );

const Sidebar = (
    <nav aria-label="Portal modules" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
      {nav.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive(l.href)
              ? "bg-white/10 text-white"
              : "text-slate dark:text-white hover:text-slate/60 dark:hover:text-slate/45"
          }`}
        >
          <span className="block text-slate">{l.label}</span>
          <span className="block text-[11px] text-slate/60 dark:text-slate/45 dark:hover:text-slate/45">{l.desc}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-white dark:bg-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-white dark:bg-slate-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 p-5">
          <LogoMark size={34} />
          <div className="leading-tight">
            <p className="font-head text-sm font-bold text-white">Portal</p>
            <p className="text-[11px] text-white/70">University of Abuja</p>
          </div>
        </div>
        {Sidebar}
        {HelpLink}
        <div className="border-t border-white/10 p-4 text-[11px] text-slate/60">
          <p className="font-semibold text-slate">{user.fullName}</p>
          <p className="text-xs text-slate/40">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-slate-900 dark:bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <LogoMark size={34} />
                <p className="font-head text-sm font-bold text-white">Portal</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:text-white"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            {Sidebar}
            {HelpLink}
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate/10 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg border border-slate/15 p-1 text-slate lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="h-9 w-9" />
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-strong text-xs font-bold text-white"
              title={user.email}
              aria-hidden="true"
            >
              {initials(user.fullName) || "?"}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-slate">{user.fullName}</p>
              <p className="text-[11px] text-slate/75">{user.username}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full bg-slate/5 px-4 py-2 text-sm font-semibold text-slate transition-colors hover:bg-slate/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
