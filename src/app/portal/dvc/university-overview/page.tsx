import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { governanceStats, studentOverview, staffOverview } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "University Overview" };

function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export default async function UniversityOverviewPage() {
  await requireGovernanceOversight();

  const [stats, students, staff] = await Promise.all([
    governanceStats(),
    studentOverview(),
    staffOverview(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="University Overview"
        description="The university at a glance — population, staffing and faculties. All figures are derived live from the records."
      />

      <section aria-label="Population" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={stats.students.total} hint={`${stats.students.active} active`} />
        <StatCard label="Staff" value={stats.staff.total} hint={`${stats.staff.active} active`} />
        <StatCard label="Faculties" value={stats.faculties} hint="Distinct faculties on record" />
        <StatCard label="Departments" value={stats.departments} hint="Distinct departments on record" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Students by category" subtitle="Undergraduate vs postgraduate split." />
          {students.byCategory.length === 0 ? (
            <EmptyState title="No students" />
          ) : (
            <ul className="space-y-1">
              {students.byCategory.map((c) => (
                <li key={c.category ?? "none"} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <span className="w-48 shrink-0 truncate text-sm font-medium text-slate">{c.category ?? "Unclassified"}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate/10">
                    <span
                      className="block h-full rounded-full bg-brand-strong"
                      style={{ width: `${pct(c.count, students.total)}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionHeading title="Students by status" subtitle="Active, suspended, graduated and other statuses." />
          <Table headers={["Status", "Students"]}>
            {students.byStatus.map((s) => (
              <tr key={s.status}>
                <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
              </tr>
            ))}
          </Table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Staff by faculty" subtitle="Academic and non-teaching staff across faculties." />
          <Table headers={["Faculty", "Staff"]}>
            {staff.byFaculty.map((f) => (
              <tr key={f.faculty ?? "none"}>
                <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.count}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <SectionHeading title="Academic resources" subtitle="Programmes and supervision capacity." />
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Programmes" value={stats.programmes} hint="Approved programmes" />
            <StatCard label="Postgraduate students" value={stats.pg.students} hint={`${stats.pg.supervision} supervisor assignments`} />
            <StatCard label="Level coordinators" value={stats.coordinators} hint={`${stats.advisers} active level advisers`} />
            <StatCard label="Result files" value={stats.resultFiles.total} hint={`${stats.resultFiles.failed} failed / partial`} />
          </div>
        </div>
      </section>
    </div>
  );
}
