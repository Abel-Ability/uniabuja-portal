import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { GOVERNANCE_REPORTS, governanceCsv } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reports" };

export default async function VcReportsPage() {
  await requireVC();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Reports"
        description="Executive reports and exports for institutional oversight"
      />

      <section>
        <SectionHeading title="Available Reports" subtitle="Downloadable reports for executive oversight" />
        {GOVERNANCE_REPORTS.length === 0 ? (
          <EmptyState title="No reports available" body="No governance reports are configured yet." />
        ) : (
          <Table headers={["Category", "Report", "Description", "Download"]}>
            {GOVERNANCE_REPORTS.map((r) => (
              <tr key={r.slug}>
                <td className="px-4 py-3"><Badge tone="neutral">{r.category}</Badge></td>
                <td className="px-4 py-3 font-medium text-slate">{r.title}</td>
                <td className="px-4 py-3">{r.description}</td>
                <td className="px-4 py-3">
                  <a
                    href={`/portal/vc/reports/export?report=${r.slug}`}
                    className="text-sm font-semibold text-brand-strong hover:underline"
                  >
                    Download CSV →
                  </a>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
