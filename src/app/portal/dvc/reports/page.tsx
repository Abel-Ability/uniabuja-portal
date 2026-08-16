import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { GOVERNANCE_REPORTS, buildGovernanceReport } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reports" };

export default async function DvcReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireGovernanceOversight();
  const params = await searchParams;
  const requested = typeof params.report === "string" ? params.report : undefined;
  const report = requested ? await buildGovernanceReport(requested) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Reports"
        description="Downloadable governance reports over real records. Every export is recorded in the audit trail."
      />

      <section aria-label="Report catalogue">
        <SectionHeading title="Available reports" subtitle="Select a report to preview it, then export as CSV." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GOVERNANCE_REPORTS.map((r) => (
            <Link
              key={r.slug}
              href={`/portal/dvc/reports?report=${r.slug}`}
              className={`rounded-2xl border p-4 shadow-sm transition-colors ${
                report?.slug === r.slug
                  ? "border-brand-strong bg-brand-light/10"
                  : "border-slate/10 bg-white hover:border-brand/40 dark:border-slate-200/15 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="brand">{r.category}</Badge>
                {report?.slug === r.slug ? <span className="text-xs font-semibold text-brand-strong">Selected</span> : null}
              </div>
              <p className="mt-3 font-semibold text-slate">{r.title}</p>
              <p className="mt-1 text-sm text-slate/60">{r.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {report ? (
        <section aria-label={`${report.title} preview`}>
          <SectionHeading
            title={report.title}
            subtitle={report.description}
            action={
              <a
                href={`/portal/dvc/reports/export?report=${report.slug}`}
                className="rounded-full bg-brand-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Export CSV
              </a>
            }
          />
          {report.rows.length === 0 ? (
            <EmptyState title="No rows for this report" body="The report generated an empty result set." />
          ) : (
            <Table headers={report.columns.map((c) => c.header)}>
              {report.rows.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {report.columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-slate/80">
                      {row[c.key] == null ? "—" : String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
          )}
          <p className="mt-2 text-xs text-slate/60">
            Preview shows up to 50 of {report.rows.length} rows; the CSV export contains all rows.
          </p>
        </section>
      ) : null}
    </div>
  );
}
