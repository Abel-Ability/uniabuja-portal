import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVC } from "../guard";
import {
  governanceStats,
  facultyComparison,
  departmentComparison,
  studentOverview,
  staffOverview,
  courseAllocationMonitor,
  resultsPipeline,
  admissionsMonitor,
  graduationMonitor,
  postgraduateMonitor,
  EXCEPTION_SEVERITY_LABELS,
} from "@/lib/governance";
import {
  PageHeader,
  StatCard,
  Table,
  EmptyState,
  SectionHeading,
  Badge,
} from "@/components/ui";
function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic Performance" };

export default async function VcAcademicPerformancePage() {
  await requireVC();

  const [stats, facultyRows, deptResults, pipeline, admissions, graduation, pg, courseAlloc] =
    await Promise.all([
      governanceStats(),
      facultyComparison(),
      departmentComparison(),
      resultsPipeline(12),
      admissionsMonitor(12),
      graduationMonitor(),
      postgraduateMonitor(),
      courseAllocationMonitor(),
    ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Academic Performance"
        description="University-wide academic monitoring and faculty/department comparison"
      />

      <section aria-label="Faculty comparison" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facultyRows.length === 0 ? (
          <EmptyState title="No faculty data" />
        ) : (
          <Table headers={["Faculty", "Students", "Staff", "Programmes", "Courses", "Results Pending", "Clearance", "Pipeline Apps"]}>
            {facultyRows.map((f) => (
              <tr key={f.faculty}>
                <td className="px-4 py-3 font-medium text-slate">{f.faculty}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.students}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.staff}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.programmes}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.programmes}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.resultsPending}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.pendingClearance}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.pipelineApplications}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section aria-label="Department comparison" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deptResults.length === 0 ? (
          <EmptyState title="No department data" />
        ) : (
          <Table headers={["Department", "Faculty", "Students", "Lecturers", "Programmes", "Courses", "Coordinators", "Advisers", "Pending Results"]}>
            {deptResults.map((d) => (
              <tr key={d.department}>
                <td className="px-4 py-3 font-medium text-slate">{d.department}</td>
                <td className="px-4 py-3 font-medium text-slate">{d.faculty ?? "—"}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.students}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.lecturers}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.programmes}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.coursesAssigned}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.coordinators}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.advisers}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.pendingResults}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section aria-label="Results pipeline" className="grid gap-4">
        <SectionHeading title="Results Pipeline" subtitle="Result rows at each approval stage" />
        <Table headers={["Stage", "Count", "Percentage"]}>
          {pipeline.stages.map((s) => (
            <tr key={s.stage}>
              <td className="px-4 py-3">{s.stage.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pct(s.count, pipeline.total)}%</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Admissions" className="grid gap-4">
        <SectionHeading title="Admissions Pipeline" subtitle="Applications by status and recent submissions" />
        <Table headers={["Status", "Count"]}>
          {admissions.byStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-sm text-slate/70">Admitted: {admissions.admitted} · Offers: {admissions.offers}</p>
      </section>

      <section aria-label="Graduation" className="grid gap-4">
        <SectionHeading title="Graduation & Clearance" subtitle="Clearance progress and convocation readiness" />
        <Table headers={["Status", "Count"]}>
          {[
            { status: "In Progress", count: graduation.clearance.inProgress },
            { status: "Completed", count: graduation.clearance.completed },
            { status: "On Hold", count: graduation.clearance.onHold },
          ].map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3">{s.status}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-sm text-slate/70">Convocations: {graduation.convocations} · Graduation records: {graduation.graduationRecords}</p>
      </section>

      <section aria-label="Postgraduate" className="grid gap-4">
        <SectionHeading title="Postgraduate Monitor" subtitle="PG students, supervision and research" />
        <Table headers={["Metric", "Count"]}>
          <tr>
            <td className="px-4 py-3">PG Students</td>
            <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pg.students}</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Applications</td>
            <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pg.applications}</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Without Supervisor</td>
            <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pg.withoutSupervisor}</td>
          </tr>
          <tr>
            <td className="px-4 py-3">Theses</td>
            <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pg.theses}</td>
          </tr>
        </Table>
        <p className="mt-2 text-sm text-slate/70">Theses by status: {pg.thesesByStatus.map((s) => `${s.status}: ${s.count}`).join(", ")}</p>
      </section>

      <section aria-label="Course allocation" className="grid gap-4">
        <SectionHeading title="Course Allocation" subtitle="Current session course allocations" />
        <Table headers={["Faculty", "Assigned", "Unassigned"]}>
          {courseAlloc.byFaculty.map((f) => (
            <tr key={f.faculty ?? "unassigned"}>
              <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.assigned}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{courseAlloc.unassigned}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-sm text-slate/70">Total courses: {courseAlloc.totalCourses} · Assigned: {courseAlloc.assignedThisSession} · Unassigned: {courseAlloc.unassigned}</p>
      </section>
    </div>
  );
}
