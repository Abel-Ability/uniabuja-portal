import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, CURRENT_SESSION, SEMESTER_LABELS } from "@/lib/constants";
import { facultyDepartments, facultyDepartmentOverview } from "@/lib/faculty";
import {
  PageHeader,
  StatCard,
  SectionHeading,
  Table,
  Badge,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic Management" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

export default async function DeanAcademicManagementPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);
  const deptFilter = departments.length ? { in: departments } : undefined;

  const [overview, allocations, coordinators, advisers, staff] = await Promise.all([
    facultyDepartmentOverview(faculty),
    prisma.courseAssignment.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION },
      include: { course: true, lecturer: true },
      orderBy: [{ department: "asc" }, { courseCode: "asc" }],
    }),
    prisma.levelCoordinator.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION },
      include: { coordinator: true },
      orderBy: [{ department: "asc" }, { level: "asc" }],
    }),
    prisma.levelAdvisorAssignment.findMany({
      where: { department: deptFilter, academicSession: CURRENT_SESSION, status: "ACTIVE" },
      include: { adviser: true, programme: true },
      orderBy: [{ department: "asc" }, { level: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "LECTURER", faculty, department: deptFilter },
      select: { id: true, fullName: true, department: true, staffProfile: { select: { designation: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const loadMap = new Map<string, number>();
  for (const a of allocations) {
    loadMap.set(a.lecturerId, (loadMap.get(a.lecturerId) ?? 0) + 1);
  }
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

  const totalSlots = allocations.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Academic Management"
        description={`Course allocation, teaching load and level coordination across ${faculty ?? "your faculty"} for the ${CURRENT_SESSION} session. Read-only oversight.`}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses allocated" value={nfmt(totalSlots)} hint={`Session ${CURRENT_SESSION}`} />
        <StatCard label="Lecturer slots" value={nfmt(staff.length)} hint="Academic staff in the faculty" />
        <StatCard label="Coordinators" value={nfmt(coordinators.length)} hint="Level coordinators this session" />
        <StatCard label="Advisers" value={nfmt(advisers.length)} hint="Active level advisers" />
      </section>

      <section>
        <SectionHeading
          title="Department workload"
          subtitle="Allocation and coordination coverage per department."
        />
        {overview.length === 0 ? (
          <EmptyState title="No departments" body="Departments are derived from the faculty's staff roster." />
        ) : (
          <Table headers={["Department", "Staff", "Courses", "Coordinators", "Advisers"]}>
            {overview.map((d) => (
              <tr key={d.department}>
                <td className="px-4 py-3 font-medium text-slate">{d.department}</td>
                <td className="px-4 py-3">{d.staff}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.coursesCurrent > 0 ? "slate" : "neutral"}>{nfmt(d.coursesCurrent)}</Badge>
                </td>
                <td className="px-4 py-3">{nfmt(d.coordinators)}</td>
                <td className="px-4 py-3">{nfmt(d.advisers)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Teaching load"
          subtitle="Lecturer course load, coordinator and adviser roles for the current session."
        />
        {staff.length === 0 ? (
          <EmptyState title="No academic staff" body="Lecturers assigned to the faculty's departments will appear here." />
        ) : (
          <Table headers={["Staff", "Department", "Designation", "Courses", "Coordination roles"]}>
            {staff.map((s) => {
              const roles = [
                ...(coordinatorRoles.get(s.id) ?? []).map((lvl) => `${lvl} Coordinator`),
                ...(adviserRoles.get(s.id) ?? []).map((lvl) => `${lvl} Adviser`),
              ];
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate">{s.fullName}</td>
                  <td className="px-4 py-3 text-slate">{s.department ?? "—"}</td>
                  <td className="px-4 py-3 text-slate">{s.staffProfile?.designation ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={loadMap.get(s.id) ? "slate" : "neutral"}>{nfmt(loadMap.get(s.id) ?? 0)}</Badge>
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
                </tr>
              );
            })}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Course allocations"
          subtitle={`Every course allocated to the faculty's departments for ${CURRENT_SESSION}.`}
        />
        {allocations.length === 0 ? (
          <EmptyState title="No allocations this session" body="Course allocations for the current session will appear here." />
        ) : (
          <Table headers={["Course", "Department", "Semester", "Lecturer", "Units"]}>
            {allocations.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-medium text-slate">{a.courseCode}</p>
                  <p className="text-sm text-slate/70">{a.courseTitle}</p>
                </td>
                <td className="px-4 py-3 text-slate">{a.department}</td>
                <td className="px-4 py-3 text-slate">{SEMESTER_LABELS[a.semester] ?? a.semester}</td>
                <td className="px-4 py-3 text-slate">{a.lecturer?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{a.course?.units ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
