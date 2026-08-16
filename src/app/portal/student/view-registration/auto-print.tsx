"use client";

import { useEffect } from "react";

// Prints the official registration document automatically when the page is
// opened with ?print=1 (e.g. from the locked course-registration page).
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
