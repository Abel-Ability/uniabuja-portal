import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "../guard";
import { SEMESTER_LABELS, CURRENT_SESSION, CURRENT_SEMESTER } from "@/lib/constants";
import { getResultPipelineStats } from "@/lib/academic-stats";
import { PageHeader, StatCard, SectionHeading, Table, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Results Pipeline Oversight" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

function statusCount(groups: { gradeStatus: string; _count: { _all: number } }[], status: string): number {
  return groups.find((g) => g.gradeStatus === status)?._count._all ?? 0;
}

export default async function SbcResultsPage() {
  await requireSbcChairman();

  const pipeline = await getResultPipelineStats();

  const [recent, totalRecent] = await Promise.all([
    prisma.result.findMany({
      where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { user: true, course: true, submittedBy: true },
    }),
    prisma.result.count({ where: { academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } }),
  ]);

  const byStatus = [
    { gradeStatus: "SUBMITTED", _count: { _all: pipeline.byStage.SUBMITTED } },
    { gradeStatus: "HOD_APPROVED", _count: { _all: pipeline.byStage.HOD_APPROVED } },
    { gradeStatus: "SENATE_APPROVED", _count: { _all: pipeline.byStage.SENATE_APPROVED } },
    { gradeStatus: "FINAL", _count: { _all: pipeline.byStage.FINAL } },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Results Pipeline — Oversight"
        description={`University-wide read-only view of the ${CURRENT_SESSION} (semester ${CURRENT_SEMESTER}) grades pipeline. The SBC Chairman may not approve, edit or return any result; finalisation remains with the Exams & Records office.`}
      />

      <section aria-label="Pipeline summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting HoD" value={nfmt(statusCount(byStatus, "SUBMITTED"))} hint="Submitted by lecturers" />
        <StatCard label="HoD-approved" value={nfmt(statusCount(byStatus, "HOD_APPROVED"))} hint="Awaiting Senate finalisation" />
        <StatCard label="Senate-approved" value={nfmt(statusCount(byStatus, "SENATE_APPROVED"))} hint="Finalised by Exams & Records" />
        <StatCard label="Final" value={nfmt(statusCount(byStatus, "FINAL"))} hint="Frozen / published" />
      </section>

      <section>
        <SectionHeading
          title="Recent result records"
          subtitle={`Newest result records for ${CURRENT_SESSION} semester ${CURRENT_SEMESTER} (${nfmt(totalRecent)} in total). This is oversight only — no action buttons are available.`}
        />
        {recent.length === 0 ? (
          <EmptyState title="No results on record" body="Results will appear here as the pipeline fills." />
        ) : (
          <Table headers={["Student", "Course", "Session", "Total", "Grade", "Submitted by", "Status"]}>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
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
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
