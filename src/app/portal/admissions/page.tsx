import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  StatCard,
  SectionHeading,
  Table,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admission Dashboard" };

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "R")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Your role does not have access to the Admission Committee workspace." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have permission to view this page.</p>
          </Card>
        </div>
      </div>
    );
  }

  const [applications, committeeStats] = await Promise.all([
    prisma.application.findMany({
      where: { status: { notIn: ["DRAFT"] } },
      include: { programme: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.committeeMembership.findMany({
      where: { committee: "ADMISSIONS_COMMITTEE", status: "ACTIVE" },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    }),
  ]);

  const totalApplications = applications.length;
  const eligibleCount = applications.filter((a) => a.eligible === true).length;
  const ineligibleCount = applications.filter((a) => a.eligible === false).length;
  const cutoffMetCount = applications.filter((a) => a.cutoffMet === true).length;
  const submittedCount = applications.filter((a) => a.status === "SUBMITTED").length;
  const shortlistedCount = applications.filter((a) => a.status === "SHORTLISTED").length;
  const selectedCount = applications.filter((a) => a.status === "SELECTED").length;
  const chairmanReviewCount = applications.filter((a) => a.status === "CHAIRMAN_REVIEW").length;
  const admittedCount = applications.filter((a) => a.status === "ADMITTED").length;
  const notAdmittedCount = applications.filter((a) => a.status === "NOT_ADMITTED").length;

  const statusBreakdown = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const programmeBreakdown = applications.reduce((acc, app) => {
    const name = app.programmeName ?? app.programme?.name ?? "Unknown";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const committeeMembers = committeeStats.filter((m) => m.designation === "MEMBER");
  const chairman = committeeStats.find((m) => m.designation === "CHAIRMAN");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Admission Dashboard"
        description="Overview of application activity and committee progress"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Summary Statistics */}
        <section aria-label="Summary statistics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Applications" value={totalApplications} />
            <StatCard label="Eligible" value={eligibleCount} hint={`${ineligibleCount} ineligible`} />
            <StatCard label="Cut-off Met" value={cutoffMetCount} />
            <StatCard label="Admitted" value={admittedCount} hint={`${notAdmittedCount} not admitted`} />
          </div>
        </section>

        {/* Committee Workflow Status */}
        <section aria-label="Workflow status">
          <SectionHeading title="Committee Workflow" subtitle="Applications by pipeline stage" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard label="Submitted" value={submittedCount} hint="Awaiting review" />
            <StatCard label="Shortlisted" value={shortlistedCount} />
            <StatCard label="Selected" value={selectedCount} hint="Pending chairman" />
            <StatCard label="Chairman Review" value={chairmanReviewCount} />
            <StatCard label="Decided" value={admittedCount + notAdmittedCount} hint="Final decisions" />
          </div>
        </section>

        {/* Status Breakdown Table */}
        <section aria-label="Status breakdown">
          <SectionHeading title="Status Breakdown" />
          {Object.keys(statusBreakdown).length > 0 ? (
            <Table headers={["Status", "Count"]}>
              {Object.entries(statusBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, count]) => (
                  <tr key={status} className="hover:bg-slate/5">
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{count}</td>
                  </tr>
                ))}
            </Table>
          ) : (
            <EmptyState title="No applications yet" body="Applications will appear here once the Google Apps Script integration is connected." />
          )}
        </section>

        {/* Programme Breakdown */}
        <section aria-label="Programme breakdown">
          <SectionHeading title="Applications by Programme" />
          {Object.keys(programmeBreakdown).length > 0 ? (
            <Table headers={["Programme", "Count"]}>
              {Object.entries(programmeBreakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 20)
                .map(([programme, count]) => (
                  <tr key={programme} className="hover:bg-slate/5">
                    <td className="px-4 py-3 text-sm">{programme}</td>
                    <td className="px-4 py-3 text-sm font-medium">{count}</td>
                  </tr>
                ))}
            </Table>
          ) : (
            <EmptyState title="No programme data" body="Programme breakdown will appear once applications are synced." />
          )}
        </section>

        {/* Committee Members */}
        <section aria-label="Committee members">
          <SectionHeading title="Admissions Committee" subtitle="Active committee members" />
          <Card>
            {chairman && (
              <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">Chairman</p>
                <p className="mt-1 text-sm font-semibold text-slate">{chairman.user.fullName}</p>
                <p className="text-xs text-slate/60">{chairman.user.role}</p>
              </div>
            )}
            {committeeMembers.length > 0 ? (
              <div className="space-y-2">
                {committeeMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate">{m.user.fullName}</p>
                      <p className="text-xs text-slate/60">{m.user.role}</p>
                    </div>
                    <Badge tone="neutral">Member</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate/60">No active committee members configured.</p>
            )}
          </Card>
        </section>

        {/* Quick Links */}
        <section aria-label="Quick links">
          <SectionHeading title="Quick Actions" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link href="/portal/admissions/merit-list" className="rounded-xl border border-slate/10 bg-white p-5 shadow-sm transition-colors hover:bg-slate/5 dark:border-slate-700/60 dark:bg-slate-800/80">
              <p className="font-head text-sm font-bold text-slate">Merit List</p>
              <p className="mt-1 text-xs text-slate/60">View ranked eligible applicants</p>
            </Link>
            <Link href="/portal/admissions/selected" className="rounded-xl border border-slate/10 bg-white p-5 shadow-sm transition-colors hover:bg-slate/5 dark:border-slate-700/60 dark:bg-slate-800/80">
              <p className="font-head text-sm font-bold text-slate">Selected Candidates</p>
              <p className="mt-1 text-xs text-slate/60">Review committee selections</p>
            </Link>
            <Link href="/portal/admissions/chairman" className="rounded-xl border border-slate/10 bg-white p-5 shadow-sm transition-colors hover:bg-slate/5 dark:border-slate-700/60 dark:bg-slate-800/80">
              <p className="font-head text-sm font-bold text-slate">Chairman Review</p>
              <p className="mt-1 text-xs text-slate/60">Final admission confirmation</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
