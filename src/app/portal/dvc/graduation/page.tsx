import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { graduationMonitor } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Graduation & Clearance" };

export default async function DvcGraduationPage() {
  await requireGovernanceOversight();

  const monitor = await graduationMonitor();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Graduation & Clearance"
        description="Clearance progress, convocation readiness and NYSC mobilisation. Clearance approvals rest with the sign-off units."
      />

      <section aria-label="Graduation summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clearance in progress" value={monitor.clearance.inProgress} hint="Across all clearance types" />
        <StatCard label="Clearance completed" value={monitor.clearance.completed} hint="Fully signed off" />
        <StatCard label="Convocation registrations" value={monitor.convocations} hint="Registered graduates" />
        <StatCard label="Graduation records" value={monitor.graduationRecords} hint="Approved graduations" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Clearance status" />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="In progress" value={monitor.clearance.inProgress} />
            <StatCard label="Completed" value={monitor.clearance.completed} />
            <StatCard label="On hold" value={monitor.clearance.onHold} />
          </div>
        </div>
        <div>
          <SectionHeading title="NYSC mobilisation" subtitle="NYSC records by status." />
          {monitor.nyscByStatus.length === 0 ? (
            <EmptyState title="No NYSC records" />
          ) : (
            <Table headers={["Status", "Records"]}>
              {monitor.nyscByStatus.map((s) => (
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
        <SectionHeading title="Graduation records by award class" subtitle="Senate-approved graduation records, where a class has been recorded." />
        {monitor.awardClasses.length === 0 ? (
          <EmptyState title="No graduation records" />
        ) : (
          <Table headers={["Award class", "Records"]}>
            {monitor.awardClasses.map((c) => (
              <tr key={c.awardClass ?? "none"}>
                <td className="px-4 py-3 font-medium text-slate">{c.awardClass?.replaceAll("_", " ") ?? "Unclassified"}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{c.count}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
