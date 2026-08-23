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
  SectionHeading,
  Table,
  EmptyState,
  StatCard,
} from "@/components/ui";
import { ChairmanDecisionButtons } from "./chairman-decision-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Chairman Review" };

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "A")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Only the Admissions Committee Chairman can access this page." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have chairman permissions to review admission decisions.</p>
          </Card>
        </div>
      </div>
    );
  }

  // Verify chairman membership
  const membership = await prisma.committeeMembership.findFirst({
    where: {
      committee: "ADMISSIONS_COMMITTEE",
      userId: user.id,
      designation: "CHAIRMAN",
      status: "ACTIVE",
    },
  });

  if (!membership) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="You are not the Admissions Committee Chairman." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">Only the active chairman of the Admissions Committee can access this page.</p>
          </Card>
        </div>
      </div>
    );
  }

  const pendingReview = await prisma.application.findMany({
    where: { status: "CHAIRMAN_REVIEW" },
    include: { programme: true },
    orderBy: { compositeScore: "desc" },
  });

  const recentlyDecided = await prisma.application.findMany({
    where: {
      chairmanDecision: { not: null },
      chairmanDecisionAt: { not: null },
    },
    include: { programme: true },
    orderBy: { chairmanDecisionAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Chairman Review"
        description="Final admission confirmation — review and decide on committee selections"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Summary */}
        <section aria-label="Summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Pending Review" value={pendingReview.length} />
            <StatCard
              label="Recently Decided"
              value={recentlyDecided.length}
              hint="Last 20 decisions"
            />
          </div>
        </section>

        {/* Pending Review */}
        <section aria-label="Pending chairman review">
          <SectionHeading
            title="Pending Chairman Review"
            subtitle="Candidates selected by the committee, awaiting your final decision"
          />
          {pendingReview.length > 0 ? (
            <Table headers={["Applicant", "Programme", "Score", "Category", "Eligibility", "Actions"]}>
              {pendingReview.map((app) => (
                <tr key={app.id} className="hover:bg-slate/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/admissions/applications/${app.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {app.applicantName ?? "Unknown"}
                    </Link>
                    <p className="text-xs text-slate/60">{app.jambNo ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{app.programmeName ?? app.programme?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {app.compositeScore !== null ? `${app.compositeScore.toFixed(2)}/100` : "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="gold">{app.committeeCategory ?? "MERIT"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={app.eligible === true ? "brand" : "red"}>
                      {app.eligible === true ? "Eligible" : "Ineligible"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ChairmanDecisionButtons applicationId={app.id} />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No candidates pending review"
              body="Candidates will appear here once committee members submit them for chairman review."
            />
          )}
        </section>

        {/* Recently Decided */}
        {recentlyDecided.length > 0 && (
          <section aria-label="Recently decided">
            <SectionHeading title="Recently Decided" subtitle="Your most recent admission decisions" />
            <Table headers={["Applicant", "Programme", "Score", "Decision", "Date"]}>
              {recentlyDecided.map((app) => (
                <tr key={app.id} className="hover:bg-slate/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/admissions/applications/${app.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {app.applicantName ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{app.programmeName ?? app.programme?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {app.compositeScore !== null ? `${app.compositeScore.toFixed(2)}/100` : "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.chairmanDecision ?? "UNKNOWN"} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate/60">
                    {app.chairmanDecisionAt ? new Date(app.chairmanDecisionAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          </section>
        )}
      </div>
    </div>
  );
}
