import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "../guard";
import {
  CATEGORY_LABELS,
  MATTER_STATUS_LABELS,
  RESOLUTION_LABELS,
} from "@/lib/senate";
import { PageHeader, StatCard, SectionHeading, EmptyState } from "@/components/ui";
import { HBars } from "@/components/hbar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Senate Reports" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

type GroupedCount = { [key: string]: unknown; _count: { _all: number } };

function asBars(groups: GroupedCount[], labelKey: string, labels: Record<string, string>) {
  const total = groups.reduce((a, g) => a + g._count._all, 0);
  return groups
    .map((g) => {
      const raw = String(g[labelKey] ?? "");
      return {
        label: labels[raw] ?? raw,
        count: g._count._all,
        pct: total === 0 ? 0 : (g._count._all / total) * 100,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export default async function SbcReportsPage() {
  await requireSbcChairman();

  const [byCategory, byStatus, byResolution, bySession, totals] = await Promise.all([
    prisma.senateMatter.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.senateMatter.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.senateDecision.groupBy({ by: ["resolution"], _count: { _all: true } }),
    prisma.senateMatter.groupBy({ by: ["session"], _count: { _all: true } }),
    prisma.senateMatter.count(),
  ]);

  const decided = byStatus.find((g) => g.status === "DECIDED")?._count._all ?? 0;
  const decidedPct = totals === 0 ? 0 : (decided / totals) * 100;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Senate Activity Reports"
        description="Aggregate reporting over matters, workflow stages and recorded decisions."
      />

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total matters" value={nfmt(totals)} hint="All sessions" />
        <StatCard label="Decided" value={nfmt(decided)} hint="Decision recorded" />
        <StatCard label="Decision rate" value={`${decidedPct.toFixed(1)}%`} hint="Of all matters" />
        <StatCard label="Awaiting action" value={nfmt((byStatus.find((g) => g.status === "SUBMITTED")?._count._all ?? 0) + (byStatus.find((g) => g.status === "SCREENED")?._count._all ?? 0))} hint="Submitted or screened" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <SectionHeading title="Matters by category" subtitle="Distribution of matters across Senate categories." />
          {byCategory.length === 0 ? (
            <EmptyState title="No data" body="Matters will appear here once raised." />
          ) : (
            <HBars items={asBars(byCategory, "category", CATEGORY_LABELS)} />
          )}
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <SectionHeading title="Matters by workflow stage" subtitle="Where matters currently sit in the Senate pipeline." />
          {byStatus.length === 0 ? (
            <EmptyState title="No data" body="Matters will appear here once raised." />
          ) : (
            <HBars items={asBars(byStatus, "status", MATTER_STATUS_LABELS)} />
          )}
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <SectionHeading title="Decisions by resolution" subtitle="How Senate has disposed of screened matters." />
          {byResolution.length === 0 ? (
            <EmptyState title="No data" body="Decisions will appear here once recorded." />
          ) : (
            <HBars items={asBars(byResolution, "resolution", RESOLUTION_LABELS)} />
          )}
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <SectionHeading title="Matters by academic session" subtitle="Matters raised per session." />
          {bySession.length === 0 ? (
            <EmptyState title="No data" body="Matters will appear here once raised." />
          ) : (
            <HBars items={asBars(bySession, "session", {})} />
          )}
        </div>
      </section>
    </div>
  );
}
