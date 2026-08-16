import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { postgraduateMonitor } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Postgraduate" };

export default async function VcPostgraduatePage() {
  await requireVC();

  const monitor = await postgraduateMonitor();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Postgraduate"
        description="PG students, supervision and research monitoring"
      />

      <section aria-label="PG statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="PG Students" value={monitor.students} hint="All postgraduate students" />
        <StatCard label="Applications" value={monitor.applications} hint="PG admissions applications" />
        <StatCard label="Without Supervisor" value={monitor.withoutSupervisor} hint="No supervisor assigned" />
        <StatCard label="Theses" value={monitor.theses} hint="Theses on record" />
      </section>

      <section aria-label="Supervision status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Status", "Count"]}>
          {monitor.byScreeningStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Theses by status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Status", "Count"]}>
          {monitor.thesesByStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <SectionHeading title="Supervision Quality" subtitle="PG students by supervision assignment" />
        <p className="mt-2 text-sm text-slate/70">
          {monitor.students} total PG students, {monitor.supervision} with supervisor assignments, {monitor.withoutSupervisor} without supervisor.
        </p>
      </section>
    </div>
  );
}
