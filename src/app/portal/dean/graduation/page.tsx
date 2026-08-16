import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { facultyDepartments } from "@/lib/faculty";
import { formatDate } from "@/lib/utils";
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

export const metadata: Metadata = { title: "Graduation & Clearance" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

export default async function DeanGraduationPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);
  const deptFilter = departments.length ? { in: departments } : undefined;

  const [requests, completed] = await Promise.all([
    prisma.clearanceRequest.findMany({
      where: { status: "IN_PROGRESS", user: { role: "STUDENT", department: deptFilter } },
      orderBy: { submittedAt: "desc" },
      take: 60,
      include: { user: true, items: true },
    }),
    prisma.clearanceRequest.count({
      where: { status: "COMPLETED", user: { role: "STUDENT", department: deptFilter } },
    }),
  ]);

  const pendingByDept = new Map<string, number>();
  for (const r of requests) {
    if (!r.user.department) continue;
    pendingByDept.set(r.user.department, (pendingByDept.get(r.user.department) ?? 0) + 1);
  }

  const deptRows = [...pendingByDept.entries()]
    .map(([department, pending]) => ({ department, pending }))
    .sort((a, b) => b.pending - a.pending);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Graduation & Clearance"
        description={`Clearance progress for students across ${faculty ?? "your faculty"}. Read-only oversight — sign-offs happen in the designated offices.`}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clearances in progress" value={nfmt(requests.length)} hint="Across the faculty" />
        <StatCard label="Completed" value={nfmt(completed)} hint="Fully signed off" />
        <StatCard label="Departments" value={nfmt(departments.length)} hint="In this faculty" />
        <StatCard label="Departments with pending" value={nfmt(deptRows.length)} hint="At least one open clearance" />
      </section>

      <section>
        <SectionHeading
          title="Pending clearance by department"
          subtitle="Where the outstanding clearances are concentrated."
        />
        {deptRows.length === 0 ? (
          <EmptyState title="No pending clearance" body="There are no in-progress clearance requests for the faculty." />
        ) : (
          <Table headers={["Department", "Pending clearances"]}>
            {deptRows.map((d) => (
              <tr key={d.department}>
                <td className="px-4 py-3 font-medium text-slate">{d.department}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.pending > 0 ? "amber" : "brand"}>{nfmt(d.pending)}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Clearance requests"
          subtitle="Recent in-progress requests with their sign-off progress."
        />
        {requests.length === 0 ? (
          <EmptyState title="No clearance requests" body="Clearance requests from the faculty's students will appear here." />
        ) : (
          <Table headers={["Student", "Department", "Type", "Progress", "Status", "Submitted"]}>
            {requests.map((r) => {
              const signed = r.items.filter((i) => i.status === "SIGNED_OFF").length;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                  <td className="px-4 py-3 text-slate">{r.user.department ?? "—"}</td>
                  <td className="px-4 py-3 text-slate/70">{r.clearanceType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate/70">{signed}/{r.items.length}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate/70">{formatDate(r.submittedAt)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </div>
  );
}
