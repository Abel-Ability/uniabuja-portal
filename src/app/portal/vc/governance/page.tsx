import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { governanceStats, governanceCommitteeRoster, governanceExceptions, membershipDesignationLabel, EXCEPTION_SEVERITY_LABELS } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Governance & Compliance" };

const SEVERITY_TONE: Record<"CRITICAL" | "HIGH" | "MODERATE" | "LOW", "red" | "amber" | "gold" | "neutral"> = {
  CRITICAL: "red",
  HIGH: "amber",
  MODERATE: "gold",
  LOW: "neutral",
};

export default async function VcGovernancePage() {
  await requireVC();

  const [stats, roster, exceptions] = await Promise.all([
    governanceStats(),
    governanceCommitteeRoster(),
    governanceExceptions(),
  ]);

  const totalExceptions = exceptions.reduce((acc, e) => acc + e.count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Governance & Compliance"
        description="Institutional governance indicators and compliance monitoring"
      />

      <section aria-label="Governance indicators" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={stats.students.total} hint={`${stats.students.active} active`} />
        <StatCard label="Staff" value={stats.staff.total} hint={`${stats.staff.academic} academic · ${stats.staff.nonTeaching} non-teaching`} />
        <StatCard label="Faculties" value={stats.faculties} hint="Distinct faculties" />
        <StatCard label="Departments" value={stats.departments} hint="Distinct departments" />
        <StatCard label="Programmes" value={stats.programmes} hint="Approved programmes" />
        <StatCard label="Open Exceptions" value={totalExceptions} hint="Flagged areas" />
      </section>

      <section aria-label="Governance activity" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Results in Pipeline" value={stats.results.total} hint="Not yet final" />
        <StatCard label="Clearance in Progress" value={stats.pendingClearance} hint="Graduation / SIWES clearance" />
        <StatCard label="Admissions in Pipeline" value={stats.applications.inPipeline} hint={`${stats.applications.admitted} admitted`} />
        <StatCard label="PG Without Supervisor" value={stats.pg.students} hint="Requires executive attention" />
      </section>

      <section>
        <SectionHeading title="Committee Roster" subtitle="Membership is the authorization boundary for this workspace" />
        {roster.length === 0 ? (
          <EmptyState title="No committee members" body="No active Governance & Oversight membership rows exist yet." />
        ) : (
          <Table headers={["Member", "Designation", "Status", "Department"]}>
            {roster.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{r.member.fullName}</p>
                  <p className="text-xs text-slate/60">{r.member.staffNo ?? r.member.username}</p>
                </td>
                <td className="px-4 py-3">{membershipDesignationLabel(r.designation)}</td>
                <td className="px-4 py-3"><Badge tone={r.active ? "brand" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-4 py-3">{r.member.department ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Exceptions Register" subtitle="Flagged exceptions across the university" />
        {totalExceptions === 0 ? (
          <EmptyState title="No open exceptions" body="Every monitored area is within expected limits." />
        ) : (
          <Table headers={["Severity", "Category", "Exception", "Count"]}>
            {exceptions.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3"><Badge tone={SEVERITY_TONE[e.severity] ?? "neutral"}>{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge></td>
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
