"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Class-based theme toggle. The initial class is applied by the inline script
// in the root layout (before hydration) to avoid a flash of the wrong theme;
// this component only renders the matching icon and flips it on click.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate/15 text-slate transition-colors hover:bg-slate/5 dark:border-slate/20 dark:hover:bg-slate/10 ${className}`}
    >
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
