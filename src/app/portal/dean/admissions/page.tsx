import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { facultyProgrammeIds, facultyDepartments } from "@/lib/faculty";
import {
  PageHeader,
  StatCard,
  SectionHeading,
  Table,
  StatusBadge,
  Badge,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admissions" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

const STATUS_ORDER = ["DRAFT", "SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED", "REJECTED", "WITHDRAWN"];

export default async function DeanAdmissionsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);
  const programmeIds = await facultyProgrammeIds(faculty, departments);

  const [applications, admitted] = await Promise.all([
    programmeIds.length === 0
      ? []
      : prisma.application.findMany({
          where: { programmeId: { in: programmeIds } },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { user: true, programme: true },
        }),
    programmeIds.length === 0
      ? 0
      : prisma.application.count({
          where: { programmeId: { in: programmeIds }, status: "ADMITTED" },
        }),
  ]);

  const inPipeline = applications.filter((a) =>
    ["SUBMITTED", "SCREENING", "PENDING_CAPS"].includes(a.status),
  ).length;

  const groups = new Map<string, typeof applications>();
  for (const app of applications) {
    groups.set(app.status, [...(groups.get(app.status) ?? []), app]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Admissions"
        description={`Applications for the programmes offered to ${faculty ?? "this faculty"}'s departments. Read-only oversight — screening happens in the Registry.`}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={nfmt(applications.length)} hint={`${nfmt(programmeIds.length)} programmes in scope`} />
        <StatCard label="In pipeline" value={nfmt(inPipeline)} hint="SUBMITTED · SCREENING · PENDING_CAPS" />
        <StatCard label="Admitted" value={nfmt(admitted)} hint="Across the programmes in scope" />
        <StatCard label="Departments" value={nfmt(departments.length)} hint="In this faculty" />
      </section>

      <section aria-label="Applications">
        <SectionHeading
          title="Applications"
          subtitle="Grouped by pipeline stage. Only programmes that students of this faculty actually study are included."
        />
        {applications.length === 0 ? (
          <EmptyState title="No applications" body="Applications for the faculty's programmes will appear here." />
        ) : (
          <div className="space-y-10">
            {STATUS_ORDER.map((status) => {
              const rows = groups.get(status);
              if (!rows || rows.length === 0) return null;
              return (
                <div key={status}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-head text-lg font-bold text-slate">{status.replaceAll("_", " ")}</h3>
                    <Badge tone="slate">{nfmt(rows.length)}</Badge>
                  </div>
                  <Table headers={["Applicant", "Programme", "JAMB", "Status", "CAPS", "Submitted"]}>
                    {rows.map((app) => (
                      <tr key={app.id}>
                        <td className="px-4 py-3 font-medium text-slate">{app.user.fullName}</td>
                        <td className="px-4 py-3 text-slate">{app.programme.code} · {app.programme.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate/70">{app.jambNo ?? "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                        <td className="px-4 py-3">
                          {app.capsStatus ? <StatusBadge status={app.capsStatus} /> : <span className="text-xs text-slate/70">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate/70">
                          {app.submittedAt
                            ? app.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
