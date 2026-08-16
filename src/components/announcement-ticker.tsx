"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { formatDate } from "@/lib/utils";

type TickerItem = {
  id: string;
  title: string;
  publishedAt: string;
  category: string;
};

function TickerItem({ item }: { item: TickerItem }) {
  return (
    <span className="flex items-center gap-3 whitespace-nowrap sm:gap-4">
      <span className="text-[10px] uppercase tracking-wider text-white/75 sm:text-xs">
        {formatDate(item.publishedAt)}
      </span>
      <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-strong sm:text-[11px]">
        {item.category}
      </span>
      <span className="font-head text-[13px] font-bold leading-none text-white sm:text-sm">
        {item.title}
      </span>
    </span>
  );
}

export function AnnouncementTicker() {
  const [items, setItems] = useState<TickerItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/announcements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        setItems(Array.isArray(json?.items) ? json.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || items.length === 0) return null;

  const style = { "--marquee-duration": `${Math.max(items.length * 8, 30)}s` } as CSSProperties;

  return (
    <div className="border-t border-white/10 bg-brand-strong" aria-label="Latest announcements">
      <div className="marquee h-8 overflow-hidden" style={style}>
        <div className="marquee-track">
          <div className="marquee-group">
            {items.map((item) => (
              <TickerItem key={item.id} item={item} />
            ))}
          </div>
          <div className="marquee-group" aria-hidden="true">
            {items.map((item) => (
              <TickerItem key={`${item.id}-copy`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
