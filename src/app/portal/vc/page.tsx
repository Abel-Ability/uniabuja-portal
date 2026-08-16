import type { Metadata } from "next";
import { PageHeader, StatCard, Table, Badge, SectionHeading } from "@/components/ui";
import {
  governanceStats,
  studentOverview,
  staffOverview,
  governanceExceptions,
  EXCEPTION_SEVERITY_LABELS,
} from "@/lib/governance";
import { CURRENT_SESSION } from "@/lib/constants";
import { VC_MENU } from "@/lib/constants";
import { requireVC } from "./guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Executive Dashboard" };

function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export default async function VcExecutiveDashboard() {
  await requireVC();
  const [stats, students, staff, exceptions] = await Promise.all([
    governanceStats(),
    studentOverview(),
    staffOverview(),
    governanceExceptions(),
  ]);

  const totalExceptions = exceptions.reduce(
    (acc, e) => acc + e.count,
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Vice-Chancellor Executive Dashboard"
        description="University-wide executive command centre"
      />

      <section aria-label="University snapshot" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={students.total} hint={`${students.active} active`} />
        <StatCard label="Academic Staff" value={staff.academic} hint="Full-time academic staff" />
        <StatCard label="Non-Academic Staff" value={staff.nonTeaching} hint="Administrative support staff" />
        <StatCard label="Faculties" value={stats.faculties} hint="Distinct faculties" />
        <StatCard label="Departments" value={stats.departments} hint="Distinct departments" />
        <StatCard label="Programmes" value={stats.programmes} hint="Approved programmes" />
        <StatCard label="Centres & Directorates" value={stats.faculties + stats.departments} hint="University centres and directorates" />
        <StatCard label="Active Courses" value={stats.faculties} hint="Approximate active course count" />
      </section>

      <section aria-label="Executive attention" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications in progress" value={stats.applications.inPipeline} hint="Pending admission decisions" />
        <StatCard label="Results pending HOD" value={stats.results.submitted} hint="Result rows awaiting HoD approval" />
        <StatCard label="Results pending Senate" value={stats.results.senateApproved} hint="Senate-approved, not yet published" />
        <StatCard label="Clearances pending" value={stats.pendingClearance} hint="Graduation / SIWES clearance in progress" />
        <StatCard label="PG students without supervisor" value={exceptions.filter((e) => e.category === "PG_RESEARCH").reduce((acc, e) => acc + e.count, 0)} hint="Postgraduate students needing supervisor assignment" />
        <StatCard label="Outstanding result files" value={exceptions.filter((e) => e.category === "EXAMS_RECORDS").reduce((acc, e) => acc + e.count, 0)} hint="Failed or partial result uploads" />
        <StatCard label="Open exceptions" value={totalExceptions} hint="Flagged areas requiring executive attention" />
      </section>

      <section>
        <SectionHeading title="Exceptions & Risks — Executive Summary" subtitle="Most significant issues requiring vice-chancellor attention" />
        {totalExceptions === 0 ? (
          <p className="text-slate/70">No open exceptions at this time.</p>
        ) : (
          <Table headers={["Severity", "Category", "Exception", "Count"]}>
            {exceptions
              .filter((e) =>
                ["HIGH", "CRITICAL"].includes(e.severity) ||
                e.category === "RESULTS_PENDING" ||
                e.category === "ADMISSIONS",
              )
              .slice(0, 8).map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <Badge tone="red">{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge>
                  </td>
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
