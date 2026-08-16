"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { Deadline } from "@/components/floating-deadline";

// Static version of the floating deadline ticket, sized to sit inline in the
// header next to the announcements link. Renders nothing when there is no
// upcoming deadline.
export function DeadlineTicket({ deadline }: { deadline: Deadline | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  if (!deadline) return null;

  const target = new Date(deadline.endsOn);
  const days = now
    ? Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
    : null;
  const dateText = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(target);
  const daysText =
    days === null
      ? "…"
      : days === 0
        ? "Due today"
        : `${days} ${days === 1 ? "day" : "days"} left`;

  return (
    <span
      aria-label={`${deadline.title} — ${daysText} — ${dateText}`}
      className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-white/85 py-1 pl-1.5 pr-3 shadow-md shadow-brand-strong/20 backdrop-blur-sm dark:bg-slate-800/85"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-strong text-white">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap font-head text-xs font-bold text-slate">
        {deadline.title}
      </span>
      <span className="whitespace-nowrap rounded-full bg-gold px-2 py-0.5 font-head text-xs font-bold text-slate-dark">
        {daysText}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold text-slate/60">
        {dateText}
      </span>
    </span>
  );
}
