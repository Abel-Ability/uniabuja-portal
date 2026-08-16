import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, CURRENT_SESSION } from "@/lib/constants";
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

export const metadata: Metadata = { title: "Faculty Staff" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

export default async function DeanStaffPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);
  const deptFilter = departments.length ? { in: departments } : undefined;

  const [staff, coordinators, advisers, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LECTURER", faculty, department: deptFilter },
      include: { staffProfile: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.levelCoordinator.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION },
      select: { level: true, coordinatorId: true },
    }),
    prisma.levelAdvisorAssignment.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION, status: "ACTIVE" },
      select: { level: true, adviserId: true, programmeId: true, programme: { select: { name: true } } },
    }),
    prisma.courseAssignment.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION },
      select: { lecturerId: true },
    }),
  ]);

  const coordinatorRoles = new Map<string, string[]>();
  for (const c of coordinators) {
    const list = coordinatorRoles.get(c.coordinatorId) ?? [];
    list.push(`${c.level} Level`);
    coordinatorRoles.set(c.coordinatorId, list);
  }

  const adviserRoles = new Map<string, string[]>();
  for (const a of advisers) {
    const scope = a.programme && a.programmeId ? `${a.programme.name} · ` : "";
    const list = adviserRoles.get(a.adviserId) ?? [];
    list.push(`${scope}${a.level} Level`);
    adviserRoles.set(a.adviserId, list);
  }

  const assignmentCounts = new Map<string, number>();
  for (const asg of assignments) {
    assignmentCounts.set(asg.lecturerId, (assignmentCounts.get(asg.lecturerId) ?? 0) + 1);
  }

  const activeStaff = staff.filter((s) => s.status === "ACTIVE").length;
  const withProfile = staff.filter((s) => s.staffProfile).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Faculty Staff"
        description={`All academic staff across the departments of ${faculty ?? "your faculty"}. Coordination roles and course load are for the ${CURRENT_SESSION} session.`}
      />

      <section aria-label="Staff summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total staff" value={nfmt(staff.length)} hint="Lecturers across the faculty" />
        <StatCard label="Active staff" value={nfmt(activeStaff)} hint="Status ACTIVE" />
        <StatCard label="With public profile" value={nfmt(withProfile)} hint="StaffProfile records" />
        <StatCard label="Courses assigned" value={nfmt(assignments.length)} hint={`Session ${CURRENT_SESSION}`} />
      </section>

      <section aria-label="Staff list">
        <SectionHeading
          title="Staff list"
          subtitle="Every lecturer recorded under the faculty's departments, with their current-session coordination roles and course load."
        />
        {staff.length === 0 ? (
          <EmptyState title="No staff in this faculty" body="Lecturers assigned to the faculty's departments will appear here." />
        ) : (
          <Table
            headers={[
              "Staff No",
              "Name",
              "Department",
              "Designation",
              "Contact",
              "Status",
              "Current-session roles",
              "Courses",
              "Last login",
            ]}
          >
            {staff.map((s) => {
              const roles = [
                ...(coordinatorRoles.get(s.id) ?? []).map((lvl) => `${lvl} Coordinator`),
                ...(adviserRoles.get(s.id) ?? []).map((lvl) => `${lvl} Adviser`),
              ];
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate">{s.staffNo ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate">{s.fullName}</td>
                  <td className="px-4 py-3 text-slate">{s.department ?? "—"}</td>
                  <td className="px-4 py-3 text-slate">{s.staffProfile?.designation ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate">{s.email}</p>
                    {s.phone ? <p className="text-xs text-slate/60">{s.phone}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    {roles.length === 0 ? (
                      <span className="text-slate/50">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <Badge key={r} tone="brand">{r}</Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={assignmentCounts.get(s.id) ? "slate" : "neutral"}>
                      {nfmt(assignmentCounts.get(s.id) ?? 0)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate/70">
                    {s.lastLoginAt ? formatDate(s.lastLoginAt) : "Never"}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </div>
  );
}
