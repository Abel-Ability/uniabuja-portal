import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, HOD_MENU, SEMESTER_LABELS, STUDENT_CATEGORIES } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { departmentCourseCodes } from "@/lib/hod";
import { getDepartmentAcademicStats } from "@/lib/academic-stats";
import { PageHeader, StatCard, Table, StatusBadge, EmptyState, SectionHeading } from "@/components/ui";
import { ApproveResultButton } from "@/app/portal/results/approve-result-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Department Overview" };

export default async function HodHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;
  const deptCodes = dept ? await departmentCourseCodes(dept) : [];
  const academic = dept ? await getDepartmentAcademicStats(dept) : null;

  const [students, staff, assigned, pendingResults, recentFiles] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", department: dept, studentCategory: STUDENT_CATEGORIES.UNDERGRADUATE } }),
    prisma.user.count({ where: { role: "LECTURER", department: dept } }),
    prisma.courseAssignment.count({ where: { department: dept ?? undefined } }),
    prisma.result.findMany({
      where: { gradeStatus: "SUBMITTED", course: { code: { in: deptCodes } } },
      include: { user: true, course: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.resultFile.findMany({
      where: { courseCode: { in: deptCodes } },
      include: { lecturer: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-2">
      <PageHeader
        eyebrow="HoD Workspace"
        title={`${dept ?? "Department"} Overview`}
        description="Department stats, pending approvals and quick actions."
      />

      <section aria-label="Stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Department students" value={students} hint="Enrolled in this department" />
        <StatCard label="Lecturers" value={staff} hint="Academic staff" />
        <StatCard label="Pending approvals" value={pendingResults.length} hint="Results awaiting your sign-off" />
        <StatCard label="Course assignments" value={assigned} hint="All-time allocations" />
      </section>

      {academic && (
        <section>
          <SectionHeading
            title="Department academic overview"
            subtitle={`${academic.academicSession} · Semester ${academic.semester} — shared with the faculty and university views.`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Registered (active)" value={academic.activeRegistrations} hint="Course registrations this session" />
            <StatCard label="Results entered" value={academic.gradedResults} hint="Graded result rows" />
            <StatCard label="Pipeline complete" value={`${academic.pipeline.completionPct}%`} hint={`${academic.pipeline.finalised}/${academic.pipeline.total} finalised`} />
            <StatCard label="Pass rate" value={`${academic.gradeDistribution.passPct}%`} hint="Of graded results, ≥40 total" />
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Submitted" value={academic.pipeline.byStage.SUBMITTED} hint="Awaiting HoD approval" />
            <StatCard label="HoD approved" value={academic.pipeline.byStage.HOD_APPROVED} hint="Awaiting Dean oversight" />
            <StatCard label="Senate approved" value={academic.pipeline.byStage.SENATE_APPROVED} hint="Awaiting finalisation" />
            <StatCard label="Final" value={academic.pipeline.byStage.FINAL} hint="Permanent results" />
          </div>
        </section>
      )}

      <section>
        <SectionHeading title="Pending results" subtitle="Grades submitted by lecturers, awaiting HoD approval." />
        {pendingResults.length === 0 ? (
          <EmptyState title="Nothing to approve" body="Results submitted by your department's lecturers will appear here." />
        ) : (
          <Table headers={["Student", "Course", "Total", "Grade", "Action"]}>
            {pendingResults.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                <td className="px-4 py-3">
                  {r.course.code} · {r.course.title}
                </td>
                <td className="px-4 py-3">{r.total}</td>
                <td className="px-4 py-3">{r.grade}</td>
                <td className="px-4 py-3">
                  <ApproveResultButton id={r.id} label="Approve (HoD)" />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Recent result files" subtitle="Latest CSV uploads for courses allocated to your department." />
        {recentFiles.length === 0 ? (
          <EmptyState title="No uploads yet" body="When lecturers post results, the files are tracked here." />
        ) : (
          <Table headers={["Course", "Session", "Semester", "Lecturer", "Status", "Rows"]}>
            {recentFiles.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-medium text-slate">
                  {f.courseCode} · {f.courseTitle}
                </td>
                <td className="px-4 py-3">{f.academicSession}</td>
                <td className="px-4 py-3">{SEMESTER_LABELS[f.semester] ?? f.semester}</td>
                <td className="px-4 py-3">{f.lecturer.fullName}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-3">{f.processedCount}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Quick actions" subtitle="Jump straight to the work that matters." />
        <div className="grid gap-3 sm:grid-cols-2">
          {HOD_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate/10 bg-white p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-light/5 dark:border-slate-200/15 dark:bg-slate-900"
            >
              <p className="font-semibold text-slate">{item.label}</p>
              <p className="mt-1 text-sm text-slate/60">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
