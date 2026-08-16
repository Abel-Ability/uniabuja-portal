import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS, CURRENT_SESSION, CURRENT_SEMESTER } from "@/lib/constants";
import { facultyStats, facultyCourseCodeDepartmentMap } from "@/lib/faculty";
import { ReturnResultButton } from "./return-result-button";
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

export const metadata: Metadata = { title: "Faculty Results" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

export default async function DeanResultsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const stats = await facultyStats(faculty);
  const codes = stats.scope.courseCodes;

  const [recent, failedFiles, codeDeptMap] = await Promise.all([
    codes.length === 0
      ? []
      : prisma.result.findMany({
          where: { course: { code: { in: codes } }, academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { user: true, course: true, submittedBy: true },
        }),
    codes.length === 0
      ? []
      : prisma.resultFile.findMany({
          where: { courseCode: { in: codes }, status: "FAILED" },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { lecturer: true },
        }),
    facultyCourseCodeDepartmentMap(faculty, stats.scope.departments),
  ]);

  const deptOf = (code: string) => codeDeptMap.get(code);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Faculty Results"
        description={`Read-only oversight of the ${CURRENT_SESSION} (semester ${CURRENT_SEMESTER}) results pipeline for ${faculty ?? "your faculty"}. Approval runs HoD → Exams & Records; you can return HoD-approved results to the department with a reason.`}
      />

      <section aria-label="Pipeline summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Awaiting HoD" value={nfmt(stats.results.submitted)} hint="Submitted by lecturers" />
        <StatCard label="HoD-approved" value={nfmt(stats.results.hodApproved)} hint="Awaiting Senate finalisation" />
        <StatCard label="Published" value={nfmt(stats.results.senateApproved + stats.results.final)} hint="Senate-approved / final grades" />
      </section>

      <section>
        <SectionHeading
          title="Grade pipeline"
          subtitle={`Recent result records for ${CURRENT_SESSION} semester ${CURRENT_SEMESTER} across all departments in the faculty, newest first. Returning an HoD-approved result sends it back to the department with a reason.`}
        />
        {recent.length === 0 ? (
          <EmptyState title="No results on record" body="Results for the faculty's courses will appear here." />
        ) : (
          <Table headers={["Student", "Department", "Course", "Session", "Total", "Grade", "Submitted by", "Status", "Action"]}>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                <td className="px-4 py-3 text-slate">
                  {deptOf(r.course.code) ?? <span className="text-slate/50">—</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-slate">{r.course.code}</p>
                  <p className="max-w-xs truncate text-xs text-slate/60">{r.course.title}</p>
                </td>
                <td className="px-4 py-3 text-slate/70">
                  {r.academicSession} · {SEMESTER_LABELS[r.semester] ?? `S${r.semester}`}
                </td>
                <td className="px-4 py-3 text-slate">{r.total ?? "—"}</td>
                <td className="px-4 py-3 font-head font-bold text-slate">{r.grade ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{r.submittedBy?.fullName ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.gradeStatus} />
                </td>
                <td className="px-4 py-3">
                  {r.gradeStatus === "HOD_APPROVED" ? (
                    <div>
                      <ReturnResultButton id={r.id} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate/70">Read-only</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Failed result files"
          subtitle="CSV uploads that did not parse cleanly — the relevant department should re-upload."
        />
        {failedFiles.length === 0 ? (
          <EmptyState title="No failed uploads" body="Result files that fail to parse will be flagged here." />
        ) : (
          <Table headers={["Course", "Department", "Lecturer", "Rows", "Uploaded"]}>
            {failedFiles.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate">{f.courseCode}</td>
                <td className="px-4 py-3 text-slate">
                  {deptOf(f.courseCode) ?? <span className="text-slate/50">—</span>}
                </td>
                <td className="px-4 py-3 text-slate">{f.lecturer?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">
                  <Badge tone="red">{nfmt(f.failedCount)}</Badge>
                </td>
                <td className="px-4 py-3 text-slate/70">
                  {f.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
