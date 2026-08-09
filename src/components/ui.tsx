import Link from "next/link";
import type { ReactNode } from "react";

// Pill buttons (rounded-full), colour-coded by purpose.
export function PillLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "light";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "btn-sheen bg-brand-strong text-white hover:bg-brand-dark shadow-md hover:shadow-lg hover:-translate-y-0.5",
    secondary:
      "btn-sheen bg-brand-strong text-white hover:bg-brand-dark shadow-md hover:shadow-lg hover:-translate-y-0.5",
    outline:
      "border-2 border-brand-strong text-brand-strong hover:bg-brand-strong hover:text-white",
    light:
      "bg-white/95 text-slate hover:bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-head text-sm font-semibold transition-all focus-visible:outline-3 ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function PillButton({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "light";
  className?: string;
  type?: "button" | "submit";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const styles: Record<string, string> = {
    primary:
      "bg-brand-strong text-white hover:bg-brand-dark shadow-md hover:shadow-lg",
    secondary:
      "bg-brand-strong text-white hover:bg-brand-dark shadow-md hover:shadow-lg",
    outline:
      "border-2 border-brand-strong text-brand-strong hover:bg-brand-strong hover:text-white",
    light: "bg-white/95 text-slate hover:bg-white",
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-head text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate/10 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "slate" | "gold" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate/10 text-slate",
    brand: "bg-brand-light text-slate-dark",
    slate: "bg-brand-strong text-white",
    gold: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  ACTIVE: "brand",
  COMPLETED: "brand",
  APPROVED: "brand",
  ACCEPTED: "brand",
  RECONCILED: "brand",
  VALID: "brand",
  FINAL: "brand",
  SIGNED_OFF: "brand",
  ADMITTED: "brand",
  SYNCED: "brand",
  SENT: "brand",
  GRADUATED: "brand",
  PUBLISHED: "brand",
  PENDING: "gold",
  OPEN: "gold",
  SUBMITTED: "slate",
  QUEUED: "slate",
  PROCESSING: "slate",
  IN_PROGRESS: "slate",
  REVIEW: "slate",
  SCREENING: "slate",
  DRAFT: "neutral",
  WAITLISTED: "neutral",
  HOLD: "neutral",
  OVERDUE: "red",
  FAILED: "red",
  REJECTED: "red",
  QUERIED: "red",
  INVALID: "red",
  LOCKED: "red",
  SUSPENDED: "red",
  WITHDRAWN: "neutral",
  DROPPED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">
        {label}
      </p>
      <p className="font-head text-2xl font-bold text-slate">{value}</p>
      {hint ? <p className="text-xs text-slate/75">{hint}</p> : null}
    </Card>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  id,
  light = false,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${className ?? ""}`}>
      <div>
        <h2 id={id} className={`font-head text-2xl font-bold ${light ? "text-white" : "text-slate"}`}>
          {title}
        </h2>
        {subtitle ? (
          <p className={`mt-1 max-w-2xl text-sm ${light ? "text-white/80" : "text-slate/70"}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: string[];
}) {
  return (
    <div className="bg-brand-strong px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-2 text-xs text-white/70">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {i > 0 ? " / " : ""}
                {b}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="font-head text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-head text-3xl font-bold sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm text-white/85">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate/10">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate/30 bg-slate/5 p-10 text-center">
      <p className="font-head font-semibold text-slate">{title}</p>
      {body ? <p className="mt-1 text-sm text-slate/75">{body}</p> : null}
    </div>
  );
}
