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
  SectionHeading,
  Table,
  EmptyState,
  StatCard,
} from "@/components/ui";
import { SubmitForReviewButton } from "./submit-for-review-button";
import { DeselectCandidateButton } from "./deselect-candidate-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Selected Candidates" };

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "R")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Your role does not have access to this page." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have permission to view selected candidates.</p>
          </Card>
        </div>
      </div>
    );
  }

  const selectedApplications = await prisma.application.findMany({
    where: { status: "SELECTED" },
    include: { programme: true },
    orderBy: { compositeScore: "desc" },
  });

  const chairmanReviewApplications = await prisma.application.findMany({
    where: { status: "CHAIRMAN_REVIEW" },
    include: { programme: true },
    orderBy: { compositeScore: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Selected Candidates"
        description="Candidates selected by committee members, pending chairman review"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Summary */}
        <section aria-label="Summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Selected (Pending Review)" value={selectedApplications.length} />
            <StatCard label="Sent to Chairman" value={chairmanReviewApplications.length} />
            <StatCard label="Total in Pipeline" value={selectedApplications.length + chairmanReviewApplications.length} />
          </div>
        </section>

        {/* Selected Candidates */}
        <section aria-label="Selected candidates">
          <SectionHeading
            title="Committee Selections"
            subtitle="Candidates selected by committee members"
          />
          {selectedApplications.length > 0 ? (
            <Table headers={["Applicant", "Programme", "Score", "Category", "Selected By", "Actions"]}>
              {selectedApplications.map((app) => (
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
                  <td className="px-4 py-3 text-sm text-slate/60">
                    {app.committeeSelectionAt ? new Date(app.committeeSelectionAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {can(user.role, "ADMISSIONS", "W") && (
                      <div className="flex gap-2">
                        <SubmitForReviewButton applicationId={app.id} />
                        <DeselectCandidateButton applicationId={app.id} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No selected candidates"
              body="Select candidates from the Merit List to see them here."
            />
          )}
        </section>

        {/* Pending Chairman Review */}
        {chairmanReviewApplications.length > 0 && (
          <section aria-label="Pending chairman review">
            <SectionHeading
              title="Pending Chairman Review"
              subtitle="Candidates submitted for chairman confirmation"
            />
            <Table headers={["Applicant", "Programme", "Score", "Category", "Submitted"]}>
              {chairmanReviewApplications.map((app) => (
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
                    <Badge tone="gold">{app.committeeCategory ?? "MERIT"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate/60">Awaiting chairman</td>
                </tr>
              ))}
            </Table>
          </section>
        )}
      </div>
    </div>
  );
}
