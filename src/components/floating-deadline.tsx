"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

// Floating deadline "ticket" that drifts across the hero. Horizontal travel
// lives on an outer wrapper (.float-across) and a gentle bob + tilt on an
// inner wrapper (.float-bob) so the two animations compose cleanly. It is
// pointer-events-none so it never blocks the hero CTA buttons, and the
// countdown updates client-side. Reduced-motion users get a static centred
// badge instead of the drifting animation (see globals.css).

export type Deadline = { title: string; endsOn: string };

export function FloatingDeadline({ deadline }: { deadline: Deadline | null }) {
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
    <div
      aria-label={`${deadline.title} — ${daysText} — ${dateText}`}
      className="float-across pointer-events-none absolute left-0 top-24 z-20"
    >
      <div className="float-bob">
        <div className="flex items-center gap-3 rounded-full border border-gold/60 bg-white/85 py-2 pl-2.5 pr-4 shadow-xl shadow-brand-strong/20 backdrop-blur-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-strong text-white">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap font-head text-sm font-bold text-slate">
            {deadline.title}
          </span>
          <span className="whitespace-nowrap rounded-full bg-gold px-3 py-1 font-head text-sm font-bold text-slate-dark">
            {daysText}
          </span>
          <span className="whitespace-nowrap text-xs font-semibold text-slate/60">
            {dateText}
          </span>
        </div>
      </div>
    </div>
  );
}
