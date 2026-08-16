import Link from "next/link";

// Compact CSS horizontal bar — no chart library required.
export function HBar({
  label,
  count,
  pct,
  href,
  tone = "bg-brand-strong",
}: {
  label: string;
  count: number;
  pct: number;
  href?: string;
  tone?: string;
}) {
  const width = count === 0 ? 0 : Math.max(pct, 1.5);
  const inner = (
    <>
      <span className="w-40 shrink-0 truncate text-sm font-medium text-slate">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate/10">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(width, 100)}%` }} />
      </span>
      <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate">{count}</span>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate/60">{pct.toFixed(1)}%</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-light/15">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-2 py-1.5">{inner}</div>
      )}
    </li>
  );
}

export function HBars({
  items,
  getHref,
  tone,
  unknown,
  unknownLabel = "unknown",
}: {
  items: { label: string; count: number; pct: number }[];
  getHref?: (item: { label: string; count: number; pct: number }) => string | undefined;
  tone?: string;
  unknown?: number;
  unknownLabel?: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <HBar key={it.label} {...it} href={getHref?.(it)} tone={tone} />
      ))}
      {unknown != null && unknown > 0 ? (
        <li className="px-2 pt-1 text-xs text-slate/60">
          {unknownLabel}: {unknown}
        </li>
      ) : null}
    </ul>
  );
}
