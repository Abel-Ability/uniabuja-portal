"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CalendarClock } from "lucide-react";

type Deadline = { title: string; endsOn: string };

function useDaysLeft(endsOn: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);
  const target = new Date(endsOn);
  return now ? Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000)) : null;
}

function DeadlineItem({ deadline }: { deadline: Deadline }) {
  const days = useDaysLeft(deadline.endsOn);
  const dateText = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(deadline.endsOn));
  const daysText =
    days === null
      ? "…"
      : days === 0
        ? "Due today"
        : `${days} ${days === 1 ? "day" : "days"} left`;

  return (
    <span className="flex items-center gap-3 whitespace-nowrap sm:gap-4">
      <CalendarClock className="h-3.5 w-3.5 text-brand-strong" aria-hidden="true" />
      <span className="font-head text-xs font-bold uppercase tracking-wider text-brand-strong sm:text-[13px]">
        {deadline.title}
      </span>
      <span className="rounded-full bg-brand-strong px-2 py-px text-[10px] font-bold uppercase tracking-wider text-gold sm:text-[11px]">
        {daysText}
      </span>
      <span className="text-xs font-semibold text-brand-strong/70">{dateText}</span>
    </span>
  );
}

export function DeadlineMarquee() {
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/deadline", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        setDeadline(json?.deadline ?? null);
      })
      .catch(() => {
        if (!cancelled) setDeadline(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !deadline) return null;

  const style = { "--marquee-duration": "24s" } as CSSProperties;

  return (
    <div className="border-t border-white/10 bg-gold-bright" aria-label="Upcoming deadline">
      <div className="marquee h-6 overflow-hidden sm:h-7" style={style}>
        <div className="marquee-track">
          <div className="marquee-group">
            <DeadlineItem deadline={deadline} />
          </div>
          <div className="marquee-group" aria-hidden="true">
            <DeadlineItem deadline={deadline} />
          </div>
        </div>
      </div>
    </div>
  );
}
