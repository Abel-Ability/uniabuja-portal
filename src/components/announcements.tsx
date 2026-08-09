import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Card } from "./ui";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export type AnnouncementRow = Prisma.AnnouncementModel & { author?: { fullName: string } | null };

const CATEGORY_TONES: Record<string, "brand" | "gold" | "slate" | "red"> = {
  NEWS: "brand",
  NOTICE: "slate",
  DEADLINE: "gold",
  ADMISSION: "brand",
  GENERAL: "slate",
};

export function AnnouncementCard({ item }: { item: AnnouncementRow }) {
  return (
    <Card className="card-lift flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={CATEGORY_TONES[item.category] ?? "slate"}>{item.category}</Badge>
        <time dateTime={item.publishedAt.toISOString()} className="text-xs text-slate/75">
          {timeAgo(item.publishedAt)}
        </time>
      </div>
      <h3 className="font-head text-base font-bold leading-snug text-slate">
        {item.title}
      </h3>
      <p className="line-clamp-3 text-sm text-slate/75">{item.body}</p>
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-xs text-slate/75">
          {item.scope !== "PUBLIC" ? `${item.scope} notice` : `Published ${formatDate(item.publishedAt)}`}
        </span>
        {item.author ? (
          <span className="text-xs text-slate/75">{item.author.fullName}</span>
        ) : null}
      </div>
    </Card>
  );
}

function MarqueeItem({ item }: { item: AnnouncementRow }) {
  return (
    <span className="flex items-center gap-3 whitespace-nowrap">
      <span className="rounded-full bg-gold px-2.5 py-0.5 text-[14px] font-bold uppercase tracking-wider text-brand-strong">
        {item.category}
      </span>
      <span className="font-head text-[21px] font-bold leading-none text-white">
        {item.title}
      </span>
      <span className="text-[20px] leading-snug text-white/75">{item.body}</span>
      <span className="text-[20px] leading-snug text-gold" aria-hidden="true">✦</span>
    </span>
  );
}

export function AnnouncementMarquee({ items }: { items: AnnouncementRow[] }) {
  if (items.length === 0) return null;
  const style = { "--marquee-duration": `${Math.max(items.length * 8, 30)}s` } as CSSProperties;
  return (
    <div className="marquee h-14 overflow-hidden" style={style}>
      <div className="marquee-track">
        <div className="marquee-group">
          {items.map((item) => (
            <MarqueeItem key={item.id} item={item} />
          ))}
        </div>
        <div className="marquee-group" aria-hidden="true">
          {items.map((item) => (
            <MarqueeItem key={`${item.id}-copy`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementList({
  items,
  viewAllHref,
}: {
  items: AnnouncementRow[];
  viewAllHref?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate/30 p-6 text-center text-sm text-slate/75">
        No announcements yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.slice(0, 6).map((item) => (
        <AnnouncementCard key={item.id} item={item} />
      ))}
      {viewAllHref ? (
        <div className="pt-1 text-center">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 rounded-full border-2 border-brand-strong px-5 py-2 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-strong hover:text-white"
          >
            View all announcements →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
