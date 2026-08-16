import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { admissionsMonitor } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admissions" };

export default async function DvcAdmissionsPage() {
  await requireGovernanceOversight();

  const monitor = await admissionsMonitor();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Admissions"
        description="The applications and screening pipeline. Admissions decisions rest with Registry and the PG School."
      />

      <section aria-label="Admissions summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={monitor.total} hint="All applications on record" />
        <StatCard label="Admitted" value={monitor.admitted} hint="Status: admitted" />
        <StatCard label="Offers issued" value={monitor.offers} hint="Admission offers created" />
        <StatCard label="Document mismatches" value={monitor.documentMismatches} hint="Verification flagged a mismatch" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Applications by status" />
          {monitor.byStatus.length === 0 ? (
            <EmptyState title="No applications" />
          ) : (
            <Table headers={["Status", "Applications"]}>
              {monitor.byStatus.map((s) => (
                <tr key={s.status}>
                  <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div>
          <SectionHeading title="Postgraduate applications by screening stage" />
          {monitor.pgByStatus.length === 0 ? (
            <EmptyState title="No PG applications" />
          ) : (
            <Table headers={["Screening stage", "Applications"]}>
              {monitor.pgByStatus.map((s) => (
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
        <SectionHeading title="Recent applications" subtitle="Latest submissions across all programmes." />
        {monitor.recent.length === 0 ? (
          <EmptyState title="No recent applications" />
        ) : (
          <Table headers={["Applicant", "Programme", "Status", "Submitted"]}>
            {monitor.recent.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.name}</td>
                <td className="px-4 py-3 text-slate/70">{r.programme}</td>
                <td className="px-4 py-3"><Badge tone="neutral">{r.status.replaceAll("_", " ")}</Badge></td>
                <td className="px-4 py-3 text-xs text-slate/60">
                  {r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
