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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admission Decisions" };

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
            <p className="text-sm text-slate/70">You do not have permission to view admission decisions.</p>
          </Card>
        </div>
      </div>
    );
  }

  const [admitted, notAdmitted, returned] = await Promise.all([
    prisma.application.findMany({
      where: { status: "ADMITTED" },
      include: { programme: true },
      orderBy: { chairmanDecisionAt: "desc" },
    }),
    prisma.application.findMany({
      where: { status: "NOT_ADMITTED" },
      include: { programme: true },
      orderBy: { chairmanDecisionAt: "desc" },
    }),
    prisma.application.findMany({
      where: { status: "RETURNED" },
      include: { programme: true },
      orderBy: { chairmanDecisionAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Admission Decisions"
        description="Final admission decisions made by the Chairman"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Summary */}
        <section aria-label="Summary">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Admitted" value={admitted.length} />
            <StatCard label="Not Admitted" value={notAdmitted.length} />
            <StatCard label="Returned for Review" value={returned.length} />
          </div>
        </section>

        {/* Admitted */}
        <section aria-label="Admitted candidates">
          <SectionHeading title="Admitted Candidates" subtitle="Final admission confirmed by the Chairman" />
          {admitted.length > 0 ? (
            <Table headers={["Applicant", "Programme", "Score", "Category", "Decision Date"]}>
              {admitted.map((app) => (
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
                    {app.chairmanDecisionAt ? new Date(app.chairmanDecisionAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No admitted candidates yet" body="Admission decisions will appear here after the Chairman confirms candidates." />
          )}
        </section>

        {/* Not Admitted */}
        <section aria-label="Not admitted candidates">
          <SectionHeading title="Not Admitted" subtitle="Candidates rejected by the Chairman" />
          {notAdmitted.length > 0 ? (
            <Table headers={["Applicant", "Programme", "Score", "Decision Date"]}>
              {notAdmitted.map((app) => (
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
                  <td className="px-4 py-3 text-sm text-slate/60">
                    {app.chairmanDecisionAt ? new Date(app.chairmanDecisionAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No rejected candidates" body="Rejected decisions will appear here." />
          )}
        </section>

        {/* Returned */}
        {returned.length > 0 && (
          <section aria-label="Returned candidates">
            <SectionHeading title="Returned for Review" subtitle="Candidates returned to the committee by the Chairman" />
            <Table headers={["Applicant", "Programme", "Score", "Returned Date"]}>
              {returned.map((app) => (
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
