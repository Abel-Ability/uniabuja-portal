import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, DEAN_MENU } from "@/lib/constants";
import {
  facultyStats,
  facultyDepartmentOverview,
} from "@/lib/faculty";
import {
  fetchFacultyStudents,
  computeStudentStats,
} from "@/lib/student-stats";
import {
  PageHeader,
  StatCard,
  Table,
  EmptyState,
  SectionHeading,
  Badge,
} from "@/components/ui";
import { HBars } from "@/components/hbar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faculty Overview" };

// Pending-action labels reflect the Dean's actual authority per module — the
// Dean reviews, monitors or approves within their faculty and nothing else.
const DEAN_PENDING_LABELS: Record<string, string> = {
  "/portal/dean/results": "Review Faculty Results",
  "/portal/dean/admissions": "Awaiting Dean Review",
  "/portal/dean/graduation": "Faculty Graduation Monitoring",
  "/portal/dean/academic-management": "Items Requiring Faculty Review",
  "/portal/dean/postgraduate": "Faculty PG Monitoring",
  "/portal/dean/students": "View & Export Students",
  "/portal/dean/staff": "Review Faculty Staff",
  "/portal/dean/communications": "Create & Publish",
};

export default async function DeanHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Dean Workspace"
          title="Faculty Overview"
          description="Your account has not been assigned to a faculty yet."
        />
        <EmptyState
          title="No faculty assignment"
          body="Contact the Registry so a faculty can be linked to your Dean account."
        />
      </div>
    );
  }

  const stats = await facultyStats(faculty);
  const [departments, studentStats] = await Promise.all([
    facultyDepartmentOverview(faculty),
    fetchFacultyStudents(stats.scope.departments).then(computeStudentStats),
  ]);

  const students = stats.students;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title={`${faculty} Faculty Overview`}
        description="Faculty-wide statistics, pipeline status and department comparison for the current session."
      />

      <section aria-label="Stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Departments" value={stats.scope.departments.length} hint="In this faculty" />
        <StatCard label="Students" value={students.total} hint={`${students.active} active`} />
        <StatCard label="Academic staff" value={stats.staff.lecturers} hint={`${stats.staff.active} active`} />
        <StatCard label="Programmes" value={stats.programmes} hint="Offered to faculty students" />
      </section>

      <section aria-label="Course and postgraduate stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses this session" value={stats.courses.currentSession} hint={`${stats.courses.everAllocated} allocated all-time`} />
        <StatCard label="Postgraduate students" value={stats.pg.students} hint={`${stats.pg.applications} applications, ${stats.pg.supervision} supervisory slots, ${stats.pg.theses} theses`} />
        <StatCard label="Coordinators" value={stats.coordinators} hint="Level coordinators this session" />
        <StatCard label="Level advisers" value={stats.advisers} hint="Active adviser assignments" />
      </section>

      <section>
        <SectionHeading
          title="Pipeline watch"
          subtitle="Items in flight across the faculty — read-only oversight. The Dean can review and return results; approval runs HoD → Exams & Records."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Awaiting HoD" value={stats.results.submitted} hint="Results submitted by lecturers" />
          <StatCard label="HoD-approved" value={stats.results.hodApproved} hint="Awaiting Senate finalisation" />
          <StatCard label="Published" value={stats.results.senateApproved + stats.results.final} hint="Senate-approved / final" />
          <StatCard label="Clearance in progress" value={stats.pendingClearance} hint="Across the faculty" />
          <StatCard label="Failed result files" value={stats.resultFiles.failed} hint="CSV uploads that did not parse" />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Department comparison"
          subtitle="Student, staffing and workload picture for each department in the faculty."
        />
        {departments.length === 0 ? (
          <EmptyState title="No departments" body="Departments are derived from the faculty's staff roster." />
        ) : (
          <Table headers={["Department", "Students", "Staff", "Courses", "Coordinators", "Advisers", "Pending results", "Clearance"]}>
            {departments.map((d) => (
              <tr key={d.department}>
                <td className="px-4 py-3">
                  <Link href={`/portal/dean/students?department=${encodeURIComponent(d.department)}`} className="font-medium text-slate hover:text-brand-strong">
                    {d.department}
                  </Link>
                  <p className="text-xs text-slate/60">{d.programmes} programmes</p>
                </td>
                <td className="px-4 py-3">{d.students}</td>
                <td className="px-4 py-3">{d.staff}</td>
                <td className="px-4 py-3">{d.coursesCurrent}</td>
                <td className="px-4 py-3">{d.coordinators}</td>
                <td className="px-4 py-3">{d.advisers}</td>
                <td className="px-4 py-3">
                  {d.pendingResults > 0 ? <Badge tone="amber">{d.pendingResults}</Badge> : <span className="text-slate/60">0</span>}
                </td>
                <td className="px-4 py-3">
                  {d.pendingClearance > 0 ? <Badge tone="gold">{d.pendingClearance}</Badge> : <span className="text-slate/60">0</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Students by level" subtitle="Session-derived level distribution across the faculty." />
          <HBars
            items={studentStats.byLevel.buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct }))}
            unknown={studentStats.byLevel.unknown}
            unknownLabel="level unknown"
          />
        </div>
        <div>
          <SectionHeading title="Students by sex" subtitle="Male / female split across the faculty." />
          <HBars
            items={studentStats.bySex.buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct }))}
            unknown={studentStats.bySex.unknown}
            unknownLabel="sex unknown"
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Quick actions" subtitle="Jump straight to a faculty-wide view. Labels state the exact action available to you." />
        <div className="grid gap-3 sm:grid-cols-2">
          {DEAN_MENU.filter((item) => item.href !== "/portal/dean").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate/10 bg-white p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-light/5 dark:border-slate-200/15 dark:bg-slate-900"
            >
              <p className="font-semibold text-slate">{item.label}</p>
              <p className="mt-1 text-sm text-slate/60">{item.description}</p>
              {DEAN_PENDING_LABELS[item.href] ? (
                <span className="mt-2 inline-block">
                  <Badge tone="brand">{DEAN_PENDING_LABELS[item.href]}</Badge>
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
