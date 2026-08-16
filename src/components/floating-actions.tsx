"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LogIn,
  FileText,
  Megaphone,
  ChevronUp,
} from "lucide-react";

// Styled to match the QuickLinksRail / ScrollProgress / BackToTop used in the
// uni-abuja-connect project: glassy white pills, brand-green hover, secondary
// slate back-to-top and a primary-coloured scroll progress bar.
// Desktop rail on the right, mobile bottom bar so links never overlap content.
// Focusable + keyboard accessible; respects reduced-motion via CSS.
const QUICK_LINKS = [
  { href: "/login", label: "Login", icon: LogIn },
  { href: "/apply", label: "Apply", icon: FileText },
  { href: "/notices", label: "Announcements", icon: Megaphone },
];

export function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* scroll progress bar */}
      <div
        aria-hidden="true"
        className="fixed left-0 right-0 top-0 z-[60] h-1 bg-transparent"
      >
        <div
          className="h-full bg-brand-strong transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* desktop right-side quick-link rail */}
      <nav
        aria-label="Quick access links"
        className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 md:flex"
      >
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className="group flex items-center gap-2 rounded-full bg-white/90 py-2.5 pl-3 pr-3 text-gold opacity-70 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-brand-strong hover:text-white hover:opacity-100 hover:shadow-lg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong dark:bg-slate-800/90"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 group-hover:max-w-[120px]">
              {label}
            </span>
          </Link>
        ))}
      </nav>

      {/* mobile bottom action bar */}
      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-white/60 bg-white/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/95 md:hidden"
      >
        {QUICK_LINKS.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-slate transition-colors hover:text-brand-strong"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none">
              {label}
            </span>
          </Link>
        ))}
      </nav>

      {/* back to top */}
      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-strong text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-brand-strong/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 md:bottom-6 md:right-6"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      ) : null}
    </>
  );
}
