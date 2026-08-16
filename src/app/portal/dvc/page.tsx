import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  StatCard,
  Table,
  EmptyState,
  SectionHeading,
  Badge,
} from "@/components/ui";
import { HBars } from "@/components/hbar";
import { requireGovernanceOversight } from "./guard";
import {
  governanceStats,
  governanceExceptions,
  governanceCommitteeRoster,
  membershipDesignationLabel,
  resultsPipeline,
  EXCEPTION_SEVERITY_LABELS,
  type ExceptionSeverity,
} from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Governance & Oversight" };

const SEVERITY_TONE: Record<ExceptionSeverity, "red" | "amber" | "gold" | "neutral"> = {
  CRITICAL: "red",
  HIGH: "amber",
  MODERATE: "gold",
  LOW: "neutral",
};

function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export default async function DvcHomePage() {
  const { membership } = await requireGovernanceOversight();

  const [stats, exceptions, roster, pipeline] = await Promise.all([
    governanceStats(),
    governanceExceptions(),
    governanceCommitteeRoster(),
    resultsPipeline(8),
  ]);

  const totalExceptions = exceptions.reduce((acc, e) => acc + e.count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight Committee"
        title="Oversight Dashboard"
        description={`Read-only, university-wide oversight for ${membershipDesignationLabel(membership.designation) ?? "committee members"}. The committee monitors the institution; approvals remain with the HoDs, Deans, Registry, Bursary, PG School and Senate.`}
      />

      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={stats.students.total} hint={`${stats.students.active} active · ${stats.students.undergraduate} UG · ${stats.students.postgraduate} PG`} />
        <StatCard label="Staff" value={stats.staff.total} hint={`${stats.staff.academic} academic · ${stats.staff.nonTeaching} non-teaching`} />
        <StatCard label="Faculties / Departments" value={stats.faculties} hint={`${stats.departments} departments · ${stats.programmes} programmes`} />
        <StatCard label="Open exceptions" value={totalExceptions} hint={`${exceptions.length} flagged areas`} />
      </section>

      <section aria-label="Pipeline indicators" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Results in the pipeline" value={stats.results.total} hint="Not yet final" />
        <StatCard label="Clearance in progress" value={stats.pendingClearance} hint="Graduation / SIWES clearance" />
        <StatCard label="Admissions in pipeline" value={stats.applications.inPipeline} hint={`${stats.applications.admitted} admitted`} />
        <StatCard label="PG without supervisor" value={stats.pg.students} hint="See exceptions register" />
      </section>

      <section>
        <SectionHeading
          title="Exceptions register"
          subtitle="The committee's monitoring output — derived from real records, ordered by severity."
          action={
            <Link href="/portal/dvc/exceptions" className="text-sm font-semibold text-brand-strong hover:underline">
              View all →
            </Link>
          }
        />
        {exceptions.length === 0 ? (
          <EmptyState title="No open exceptions" body="Every monitored area is currently within expected limits." />
        ) : (
          <Table headers={["Severity", "Area", "Exception", "Count"]}>
            {exceptions.slice(0, 8).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <Badge tone={SEVERITY_TONE[e.severity]}>{EXCEPTION_SEVERITY_LABELS[e.severity]}</Badge>
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="Results pipeline"
            subtitle="Result rows at each approval stage (current session view)."
          />
          <HBars
            items={pipeline.stages.map((s) => ({
              label: s.stage.replaceAll("_", " "),
              count: s.count,
              pct: pct(s.count, pipeline.total),
            }))}
            tone={pipeline.stages[0]?.count ? "bg-amber-500" : "bg-brand-strong"}
          />
        </div>
        <div>
          <SectionHeading
            title="Committee roster"
            subtitle="Membership is the authorization boundary for this workspace. The Chairman is a designation, not a separate permission set."
          />
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
        </div>
      </section>

      <section aria-label="Reading note">
        <p className="text-xs text-slate/60">
          This workspace is read-only. No committee page writes application data; every export is
          recorded in the audit trail. HOD / Dean / Senate result approvals remain authoritative.
        </p>
      </section>
    </div>
  );
}
