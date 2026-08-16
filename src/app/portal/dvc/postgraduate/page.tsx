import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { postgraduateMonitor } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Postgraduate" };

export default async function DvcPostgraduatePage() {
  await requireGovernanceOversight();

  const monitor = await postgraduateMonitor();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Postgraduate"
        description="PG students, applications, supervision and research theses. PG admissions and supervision decisions rest with the PG School."
      />

      <section aria-label="Postgraduate summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="PG students" value={monitor.students} hint="Students in the postgraduate category" />
        <StatCard label="PG applications" value={monitor.applications} hint="Applications on record" />
        <StatCard label="Supervisor assignments" value={monitor.supervision} hint="Active supervision relationships" />
        <StatCard label="Without supervisor" value={monitor.withoutSupervisor} hint="PG students with no supervisor" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="PG applications by screening stage" />
          {monitor.byScreeningStatus.length === 0 ? (
            <EmptyState title="No PG applications" />
          ) : (
            <Table headers={["Stage", "Applications"]}>
              {monitor.byScreeningStatus.map((s) => (
                <tr key={s.status}>
                  <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div>
          <SectionHeading title="Theses by status" />
          {monitor.thesesByStatus.length === 0 ? (
            <EmptyState title="No theses" />
          ) : (
            <Table headers={["Status", "Theses"]}>
              {monitor.thesesByStatus.map((s) => (
                <tr key={s.status}>
                  <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title="Supervision coverage" subtitle={`${monitor.withoutSupervisor} PG students have no supervisor assignment on record — flagged in the exceptions register.`} />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Theses" value={monitor.theses} hint="All thesis records" />
          <StatCard label="Supervision assignments" value={monitor.supervision} hint="Across all programmes" />
          <StatCard label="Coverage gap" value={monitor.withoutSupervisor} hint="PG students without a supervisor" />
        </div>
      </section>
    </div>
  );
}
