import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import {
  governanceExceptions,
  EXCEPTION_SEVERITY_LABELS,
  type ExceptionSeverity,
} from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Exceptions Register" };

const SEVERITY_TONE: Record<ExceptionSeverity, "red" | "amber" | "gold" | "neutral"> = {
  CRITICAL: "red",
  HIGH: "amber",
  MODERATE: "gold",
  LOW: "neutral",
};

export default async function ExceptionsPage() {
  await requireGovernanceOversight();

  const exceptions = await governanceExceptions();
  const critical = exceptions.filter((e) => e.severity === "HIGH" || e.severity === "CRITICAL");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Exceptions Register"
        description="The committee's monitoring output, derived live from the records. Exceptions are signals for the committee to raise matters — they are not assignments to this workspace."
      />

      {critical.length > 0 ? (
        <section aria-label="High-priority exceptions">
          <SectionHeading title="High priority" subtitle={`${critical.length} areas flagged as high or critical.`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {critical.map((e) => (
              <div key={e.id} className="rounded-2xl border border-red/20 bg-red-50/40 p-4 dark:bg-red-900/10">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={SEVERITY_TONE[e.severity]}>{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge>
                  <span className="font-head text-xl font-bold text-slate">{e.count}</span>
                </div>
                <p className="mt-2 font-semibold text-slate">{e.title}</p>
                <p className="mt-1 text-sm text-slate/70">{e.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title="All exceptions"
          subtitle="Every flagged area across the university, ordered by severity then count."
        />
        {exceptions.length === 0 ? (
          <EmptyState title="No open exceptions" body="Every monitored area is within expected limits." />
        ) : (
          <Table headers={["Severity", "Area", "Exception", "Count"]}>
            {exceptions.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3"><Badge tone={SEVERITY_TONE[e.severity]}>{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge></td>
                <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate/60">{e.category}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{e.title}</p>
                  <p className="text-xs text-slate/60">{e.detail}</p>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{e.count}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
