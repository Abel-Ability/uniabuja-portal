import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS, STUDENT_CATEGORIES } from "@/lib/constants";
import { departmentCourseCodes, isHodRole } from "@/lib/hod";
import { PageHeader, StatCard, Table, StatusBadge, EmptyState, SectionHeading } from "@/components/ui";
import { ApproveResultButton } from "@/app/portal/results/approve-result-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Results & Approvals" };

export default async function HodApprovalsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;
  const deptCodes = dept ? await departmentCourseCodes(dept) : [];

  const [pending, approvedRecently, pendingFiles, filesRecently] = await Promise.all([
    prisma.result.findMany({
      where: { gradeStatus: "SUBMITTED", course: { code: { in: deptCodes } }, user: { role: "STUDENT", studentCategory: STUDENT_CATEGORIES.UNDERGRADUATE } },
      include: { user: true, course: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.result.findMany({
      where: { gradeStatus: "HOD_APPROVED", course: { code: { in: deptCodes } }, user: { role: "STUDENT", studentCategory: STUDENT_CATEGORIES.UNDERGRADUATE } },
      include: { user: true, course: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.resultFile.count({
      where: { courseCode: { in: deptCodes }, status: { in: ["PROCESSED", "PARTIAL", "FAILED"] } },
    }),
    prisma.resultFile.findMany({
      where: { courseCode: { in: deptCodes } },
      include: { lecturer: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Results & Approvals"
        description="Sign off grades submitted for courses allocated to your department."
      />

      <section aria-label="Stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting approval" value={pending.length} hint="Grades submitted by lecturers" />
        <StatCard label="Approved (HoD)" value={approvedRecently.length} hint="Recently signed off" />
        <StatCard label="Result files" value={pendingFiles} hint="Uploaded for dept courses" />
        <StatCard label="Department" value={dept ?? "—"} hint={user.faculty ?? "Faculty not set"} />
      </section>

      <section>
        <SectionHeading title="Pending approvals" subtitle="Grades awaiting your sign-off before Senate review." />
        {pending.length === 0 ? (
          <EmptyState title="No pending approvals" body="All submitted grades for your department have been actioned." />
        ) : (
          <Table headers={["Student", "Course", "Session", "Total", "Grade", "Action"]}>
            {pending.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                <td className="px-4 py-3">
                  {r.course.code} · {r.course.title}
                </td>
                <td className="px-4 py-3">
                  {r.academicSession} · {SEMESTER_LABELS[r.semester] ?? r.semester}
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
        <SectionHeading title="Recently signed off" subtitle="Latest grades moved to the Senate approval stage." />
        {approvedRecently.length === 0 ? (
          <EmptyState title="Nothing approved yet" body="Approved grades will appear here." />
        ) : (
          <Table headers={["Student", "Course", "Session", "Total", "Grade"]}>
            {approvedRecently.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                <td className="px-4 py-3">
                  {r.course.code} · {r.course.title}
                </td>
                <td className="px-4 py-3">
                  {r.academicSession} · {SEMESTER_LABELS[r.semester] ?? r.semester}
                </td>
                <td className="px-4 py-3">{r.total}</td>
                <td className="px-4 py-3">{r.grade}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Recent result files" subtitle="CSV uploads for your department's courses." />
        {filesRecently.length === 0 ? (
          <EmptyState title="No result files" body="Files uploaded by lecturers appear here." />
        ) : (
          <Table headers={["Course", "Session", "Semester", "Lecturer", "Status", "Rows"]}>
            {filesRecently.map((f) => (
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
    </div>
  );
}
