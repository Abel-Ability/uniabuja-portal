import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { facultyDepartments } from "@/lib/faculty";
import {
  PageHeader,
  StatCard,
  SectionHeading,
  Table,
  StatusBadge,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Postgraduate" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

const fmtDate = (d: Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function DeanPostgraduatePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);
  const deptFilter = departments.length ? { in: departments } : undefined;

  const [pgStudents, applications, supervisions, theses] = await Promise.all([
    prisma.user.count({
      where: { role: "STUDENT", department: deptFilter, studentCategory: "POSTGRADUATE" },
    }),
    prisma.pGApplication.findMany({
      where: { user: { role: "STUDENT", department: deptFilter } },
      orderBy: { createdAt: "desc" },
      include: { user: true, programme: true },
    }),
    prisma.supervisorAssignment.findMany({
      where: { pgStudent: { role: "STUDENT", department: deptFilter } },
      orderBy: { createdAt: "desc" },
      include: { pgStudent: true, staff: true },
    }),
    prisma.thesis.findMany({
      where: { pgStudent: { role: "STUDENT", department: deptFilter } },
      orderBy: { createdAt: "desc" },
      include: { pgStudent: true },
    }),
  ]);

  const pendingApplications = applications.filter((a) => a.screeningStatus !== "ADMITTED").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Postgraduate"
        description={`Postgraduate applications, supervision and theses for students in ${faculty ?? "your faculty"}. Read-only oversight.`}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="PG students" value={nfmt(pgStudents)} hint="Category POSTGRADUATE" />
        <StatCard label="Applications" value={nfmt(applications.length)} hint={`${nfmt(pendingApplications)} in the pipeline`} />
        <StatCard label="Supervisions" value={nfmt(supervisions.length)} hint="Active assignments" />
        <StatCard label="Theses" value={nfmt(theses.length)} hint="On record" />
      </section>

      <section>
        <SectionHeading title="PG applications" subtitle="Applications submitted by the faculty's postgraduate students." />
        {applications.length === 0 ? (
          <EmptyState title="No applications yet" />
        ) : (
          <Table headers={["Student", "Department", "Programme", "Referees", "Interview", "Status"]}>
            {applications.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-slate">{a.user.fullName}</td>
                <td className="px-4 py-3 text-slate">{a.user.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{a.programme?.code ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">
                  {a.referee1Name ?? "—"}{a.referee2Name ? `, ${a.referee2Name}` : ""}
                </td>
                <td className="px-4 py-3 text-slate/70">{fmtDate(a.interviewAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={a.screeningStatus} /></td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Supervisor roster" subtitle="Assignments between the faculty's postgraduate students and academic staff." />
        {supervisions.length === 0 ? (
          <EmptyState title="No assignments yet" />
        ) : (
          <Table headers={["Student", "Department", "Programme", "Supervisor", "Workload"]}>
            {supervisions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate">{s.pgStudent.fullName}</td>
                <td className="px-4 py-3 text-slate">{s.pgStudent.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{s.programme ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{s.staff.fullName}</td>
                <td className="px-4 py-3 text-slate/70">{s.workloadUnits} unit(s)</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Theses" subtitle="Proposal, similarity and defence status of theses in the faculty." />
        {theses.length === 0 ? (
          <EmptyState title="No theses registered" />
        ) : (
          <Table headers={["Student", "Department", "Title", "Proposal", "Similarity", "Status", "Defence"]}>
            {theses.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-slate">{t.pgStudent.fullName}</td>
                <td className="px-4 py-3 text-slate">{t.pgStudent.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{t.title}</td>
                <td className="px-4 py-3 text-slate/70">{t.proposalStatus.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate/70">{t.plagiarismScore ?? "—"}%</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-slate/70">{fmtDate(t.defenseScheduledAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
