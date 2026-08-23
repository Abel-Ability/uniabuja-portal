import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import { OLEVEL_MAX_RAW_POINTS, OLEVEL_MAX_WEIGHTED, JAMB_MAX_SCORE, JAMB_MAX_WEIGHTED } from "@/lib/constants";
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
import { SelectCandidateButton } from "./select-candidate-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Applicant Detail" };

type OLevelSubject = {
  subject: string;
  grade: string;
  points: number;
  relevant: boolean;
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "R")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Your role does not have access to this page." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have permission to view applicant details.</p>
          </Card>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: { programme: true, documents: true, offers: true },
  });

  if (!application) notFound();

  const olevelSubjects = (application.olevelSubjects as OLevelSubject[] | null) ?? [];
  const relevantSubjects = olevelSubjects.filter((s) => s.relevant);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title={application.applicantName ?? "Applicant Detail"}
        description={`Application ${application.id.slice(0, 8)} · ${application.programmeName ?? application.programme?.name ?? ""}`}
        breadcrumbs={["Admissions", "Applicant Detail"]}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Status & Quick Actions */}
        <section aria-label="Status">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={application.status} />
            {application.eligible !== null && (
              <Badge tone={application.eligible ? "brand" : "red"}>
                {application.eligible ? "Eligible" : "Ineligible"}
              </Badge>
            )}
            {application.cutoffMet !== null && (
              <Badge tone={application.cutoffMet ? "brand" : "red"}>
                Cut-off {application.cutoffMet ? "Met" : "Not Met"}
              </Badge>
            )}
            {application.committeeCategory && (
              <Badge tone="gold">{application.committeeCategory}</Badge>
            )}
          </div>
        </section>

        {/* Score Overview */}
        <section aria-label="Score overview">
          <SectionHeading title="Admission Score" subtitle="Composite score from the authoritative analysis source" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="JAMB Contribution"
              value={application.jambContribution !== null ? `${application.jambContribution.toFixed(2)}/50` : "N/A"}
              hint={application.jambRawScore !== null ? `Raw: ${application.jambRawScore}/${JAMB_MAX_SCORE}` : undefined}
            />
            <StatCard
              label="O-Level Contribution"
              value={application.olevelContribution !== null ? `${application.olevelContribution.toFixed(2)}/50` : "N/A"}
              hint={application.olevelRawPoints !== null ? `Raw: ${application.olevelRawPoints}/${OLEVEL_MAX_RAW_POINTS}` : undefined}
            />
            <StatCard
              label="Post-UTME"
              value={application.postUtmContribution !== null ? `${application.postUtmContribution.toFixed(2)}` : "N/A"}
              hint={application.postUtmScore !== null ? `Raw: ${application.postUtmScore}` : undefined}
            />
            <StatCard
              label="Final Score"
              value={application.compositeScore !== null ? `${application.compositeScore.toFixed(2)}/100` : "N/A"}
              hint={application.programmeCutoff !== null ? `Cut-off: ${application.programmeCutoff}` : undefined}
            />
          </div>
        </section>

        {/* Personal Information */}
        <section aria-label="Personal information">
          <SectionHeading title="Personal Information" />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate/70">Full Name</p>
                <p className="text-sm text-slate">{application.applicantName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Application ID</p>
                <p className="text-sm text-slate">{application.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Email</p>
                <p className="text-sm text-slate">{application.applicantEmail ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Phone</p>
                <p className="text-sm text-slate">{application.applicantPhone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">JAMB Registration</p>
                <p className="text-sm text-slate">{application.jambNo ?? "—"}</p>
              </div>

            </div>
          </Card>
        </section>

        {/* Programme Information */}
        <section aria-label="Programme information">
          <SectionHeading title="Programme" />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-slate/70">Faculty</p>
                <p className="text-sm text-slate">{application.faculty ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Department</p>
                <p className="text-sm text-slate">{application.department ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Programme</p>
                <p className="text-sm text-slate">{application.programmeName ?? application.programme?.name ?? "—"}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* O-Level Results */}
        <section aria-label="O-Level results">
          <SectionHeading
            title="O-Level Results"
            subtitle="Five relevant subjects for the selected programme"
          />
          {relevantSubjects.length > 0 ? (
            <Table headers={["Subject", "Grade", "Points", "Relevant"]}>
              {relevantSubjects.map((s, i) => (
                <tr key={i} className="hover:bg-slate/5">
                  <td className="px-4 py-3 text-sm font-medium">{s.subject}</td>
                  <td className="px-4 py-3 text-sm">{s.grade}</td>
                  <td className="px-4 py-3 text-sm">{s.points} / 6</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.relevant ? "brand" : "neutral"}>
                      {s.relevant ? "Yes" : "No"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No O-Level data available" body="O-Level data will be displayed once the Google Apps Script integration is connected." />
          )}
          {olevelSubjects.length > 0 && (
            <Card className="mt-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold text-slate/70">Raw Points</p>
                  <p className="text-sm font-medium text-slate">{application.olevelRawPoints ?? "N/A"} / {OLEVEL_MAX_RAW_POINTS}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate/70">Weighted Contribution</p>
                  <p className="text-sm font-medium text-slate">{application.olevelContribution?.toFixed(2) ?? "N/A"} / {OLEVEL_MAX_WEIGHTED}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate/70">Grade Scale</p>
                  <p className="text-xs text-slate/60">A1=6, B2=5, B3=4, C4=3, C5=2, C6=1, D7-E9=0</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate/70">Max Raw Points</p>
                  <p className="text-xs text-slate/60">{OLEVEL_MAX_RAW_POINTS} (5 subjects x 6)</p>
                </div>
              </div>
            </Card>
          )}
        </section>

        {/* JAMB Score Breakdown */}
        <section aria-label="JAMB breakdown">
          <SectionHeading title="JAMB Score Breakdown" />
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold text-slate/70">Raw Score</p>
                <p className="text-sm font-medium text-slate">{application.jambRawScore ?? "N/A"} / {JAMB_MAX_SCORE}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Contribution</p>
                <p className="text-sm font-medium text-slate">{application.jambContribution?.toFixed(2) ?? "N/A"} / {JAMB_MAX_WEIGHTED}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Formula</p>
                <p className="text-xs text-slate/60">(Raw / {JAMB_MAX_SCORE}) x {JAMB_MAX_WEIGHTED}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Weight</p>
                <p className="text-xs text-slate/60">50% of composite</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Committee Decision */}
        <section aria-label="Committee decision">
          <SectionHeading title="Committee Decision" />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate/70">Selection Status</p>
                <StatusBadge status={application.status} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Category</p>
                <p className="text-sm text-slate">{application.committeeCategory ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Selected By</p>
                <p className="text-sm text-slate">{application.committeeSelectionUserId ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate/70">Selected At</p>
                <p className="text-sm text-slate">
                  {application.committeeSelectionAt ? new Date(application.committeeSelectionAt).toLocaleString() : "—"}
                </p>
              </div>
              {application.committeeJustification && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-slate/70">Justification</p>
                  <p className="text-sm text-slate">{application.committeeJustification}</p>
                </div>
              )}
              {application.chairmanDecision && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate/70">Chairman Decision</p>
                    <StatusBadge status={application.chairmanDecision} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate/70">Decision Date</p>
                    <p className="text-sm text-slate">
                      {application.chairmanDecisionAt ? new Date(application.chairmanDecisionAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  {application.chairmanDecisionNotes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-slate/70">Chairman Notes</p>
                      <p className="text-sm text-slate">{application.chairmanDecisionNotes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </section>

        {/* Documents */}
        <section aria-label="Documents">
          <SectionHeading title="Documents" />
          {application.documents.length > 0 ? (
            <Table headers={["Type", "File", "Status", "Uploaded"]}>
              {application.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate/5">
                  <td className="px-4 py-3 text-sm">{doc.kind}</td>
                  <td className="px-4 py-3 text-sm">{doc.fileName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.verificationStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No documents uploaded" body="Documents will appear here once the Google Apps Script integration is connected." />
          )}
        </section>

        {/* Actions */}
        {can(user.role, "ADMISSIONS", "W") && application.status === "SUBMITTED" && application.eligible !== false && application.cutoffMet !== false && (
          <section aria-label="Actions">
            <Card>
              <SelectCandidateButton applicationId={application.id} />
            </Card>
          </section>
        )}

        {/* Back Link */}
        <div className="flex justify-end">
          <Link href="/portal/admissions/merit-list" className="text-sm text-brand hover:underline">
            Back to Merit List
          </Link>
        </div>
      </div>
    </div>
  );
}
