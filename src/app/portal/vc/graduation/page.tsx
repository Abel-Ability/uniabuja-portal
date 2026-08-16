import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { graduationMonitor } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Graduation & Clearance" };

export default async function VcGraduationPage() {
  await requireVC();

  const monitor = await graduationMonitor();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Graduation & Clearance"
        description="Monitor clearance progress and convocation readiness"
      />

      <section aria-label="Clearance status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In Progress" value={monitor.clearance.inProgress} hint="Graduation / SIWES clearance in progress" />
        <StatCard label="Completed" value={monitor.clearance.completed} hint="Clearance completed" />
        <StatCard label="On Hold" value={monitor.clearance.onHold} hint="Clearance on hold" />
      </section>

      <section aria-label="Graduation records" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Convocations" value={monitor.convocations} hint="Graduation ceremonies held" />
        <StatCard label="Graduation Records" value={monitor.graduationRecords} hint="Students graduated" />
      </section>

      <section aria-label="Award Classes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Award Class", "Count"]}>
          {monitor.awardClasses.map((a) => (
            <tr key={a.awardClass}>
              <td className="px-4 py-3 font-medium text-slate">{a.awardClass ?? "—"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{a.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="NYSC status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Status", "Count"]}>
          {monitor.nyscByStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <SectionHeading title="Drill-down: University → Faculty → Department → Student" subtitle="Clearance hierarchy" />
        <p className="mt-2 text-sm text-slate/70">
          The VC can drill down from university-level statistics to individual faculty, department, and student clearance records.
        </p>
      </section>
    </div>
  );
}
