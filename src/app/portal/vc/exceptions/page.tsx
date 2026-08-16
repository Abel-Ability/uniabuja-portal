import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { governanceExceptions, EXCEPTION_SEVERITY_LABELS } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Exceptions & Risks" };

const SEVERITY_TONE: Record<"CRITICAL" | "HIGH" | "MODERATE" | "LOW", "red" | "amber" | "gold" | "neutral"> = {
  CRITICAL: "red",
  HIGH: "amber",
  MODERATE: "gold",
  LOW: "neutral",
};

export default async function VcExceptionsPage() {
  await requireVC();

  const exceptions = await governanceExceptions();

  const totalExceptions = exceptions.reduce((acc, e) => acc + e.count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Exceptions & Risks"
        description="Executive-level exception and risk monitoring across the university"
      />

      <section aria-label="Exception summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Exceptions" value={totalExceptions} hint="Flagged areas requiring attention" />
        <StatCard label="Critical" value={exceptions.filter((e) => e.severity === "CRITICAL").reduce((acc, e) => acc + e.count, 0)} hint="Highest severity" />
        <StatCard label="High" value={exceptions.filter((e) => e.severity === "HIGH").reduce((acc, e) => acc + e.count, 0)} hint="Second-highest severity" />
        <StatCard label="Moderate" value={exceptions.filter((e) => e.severity === "MODERATE").reduce((acc, e) => acc + e.count, 0)} hint="Moderate severity" />
        <StatCard label="Low" value={exceptions.filter((e) => e.severity === "LOW").reduce((acc, e) => acc + e.count, 0)} hint="Lowest severity" />
      </section>

      <section>
        <SectionHeading title="All Exceptions" subtitle="Every flagged area across the university, ordered by severity then count" />
        {exceptions.length === 0 ? (
          <EmptyState title="No open exceptions" body="Every monitored area is within expected limits." />
        ) : (
          <Table headers={["Severity", "Category", "Exception", "Count", "View Details"]}>
            {exceptions.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3"><Badge tone={SEVERITY_TONE[e.severity] ?? "neutral"}>{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge></td>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate/60">{e.category}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{e.title}</p>
                  <p className="text-xs text-slate/60">{e.detail}</p>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{e.count}</td>
                <td className="px-4 py-3">
                  <Link href={`/portal/vc/exceptions/${e.id}`} className="text-sm font-semibold text-brand-strong hover:underline">
                    View details →
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
