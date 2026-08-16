import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireVC } from "../guard";
import {
  resultsPipeline,
} from "@/lib/governance";
import { getUniversityAcademicStats } from "@/lib/academic-stats";
import {
  PageHeader,
  StatCard,
  Table,
  SectionHeading,
  Badge,
} from "@/components/ui";
import { CURRENT_SESSION, CURRENT_SEMESTER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Results & Academic Progress" };

function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export default async function VcResultsPage() {
  await requireVC();

  const pipeline = await resultsPipeline(200);

  // Current-session university academic position, shared with the department
  // and faculty views so every level reports identical numbers.
  const academic = await getUniversityAcademicStats();

  const [submitted, hodApproved, senateApproved, final] =
    pipeline.stages.map((s) => s.count);

  const total = submitted + hodApproved + senateApproved + final;

  const outstandingCounts = await Promise.all([
    prisma.result.count({ where: { gradeStatus: "SUBMITTED", academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } }),
    prisma.result.count({ where: { gradeStatus: "HOD_APPROVED", academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } }),
    prisma.result.count({ where: { gradeStatus: "SENATE_APPROVED", academicSession: CURRENT_SESSION, semester: CURRENT_SEMESTER } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Results & Academic Progress"
        description={`Monitor the ${CURRENT_SESSION} (semester ${CURRENT_SEMESTER}) result pipeline from submission to publication`}
      />

      <section aria-label="Results pipeline overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Results" value={total} hint={`${CURRENT_SESSION} · Semester ${CURRENT_SEMESTER}`} />
        <StatCard label="Submitted" value={submitted} hint="Lecturer submitted, awaiting HoD" />
        <StatCard label="HOD Approved" value={hodApproved} hint="HoD sign-off completed" />
        <StatCard label="Senate Approved" value={senateApproved} hint="Senate consideration completed" />
        <StatCard label="Finalised" value={final} hint="Published" />
      </section>

      <section aria-label="Academic year overview">
        <SectionHeading
          title={`Academic Year Overview · ${academic.academicSession} Semester ${academic.semester}`}
          subtitle="University-wide position for the current session, shared with every level of the workflow."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Students" value={academic.students} hint="All faculties" />
          <StatCard label="Courses taught" value={academic.coursesTaught} hint="Allocated this session" />
          <StatCard label="Active registrations" value={academic.activeRegistrations} hint="Current session" />
          <StatCard label="Pipeline complete" value={`${academic.pipeline.completionPct}%`} hint={`${academic.pipeline.finalised}/${academic.pipeline.total} finalised`} />
          <StatCard label="Pass rate" value={`${academic.gradeDistribution.passPct}%`} hint="Of graded results, ≥40 total" />
        </div>
        {academic.faculties.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                  <th scope="col" className="px-4 py-3">Faculty</th>
                  <th scope="col" className="px-4 py-3">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/10">
                {academic.faculties.map((f) => (
                  <tr key={f.faculty}>
                    <td className="px-4 py-3 font-medium text-slate">{f.faculty}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Pipeline stages" className="grid gap-4">
        <SectionHeading title="Results Pipeline Stages" subtitle="Status at each approval stage" />
        <Table headers={["Stage", "Count", "Percentage"]}>
          {
            [
              { stage: "SUBMITTED", count: submitted, label: "Lecturer Submitted" },
              { stage: "HOD_APPROVED", count: hodApproved, label: "HOD Approved" },
              { stage: "SENATE_APPROVED", count: senateApproved, label: "Senate Approved" },
              { stage: "FINAL", count: final, label: "Final / Published" },
            ].map((s) => (
              <tr key={s.stage}>
                <td className="px-4 py-3">{s.label}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{pct(s.count, total)}%</td>
              </tr>
            ))
          }
        </Table>
      </section>

      <section aria-label="Outstanding results" className="grid gap-4">
        <SectionHeading title="Outstanding Result Processing" subtitle="Batches requiring attention" />
        <Table headers={["Stage", "Count", "Description"]}>
          {[
            { stage: "SUBMITTED", count: outstandingCounts[0], description: "Awaiting HoD approval" },
            { stage: "HOD_APPROVED", count: outstandingCounts[1], description: "Awaiting Senate finalisation" },
            { stage: "SENATE_APPROVED", count: outstandingCounts[2], description: "Awaiting publication" },
          ].map((r) => (
            <tr key={r.stage}>
              <td className="px-4 py-3">{r.stage.replaceAll("_", " ")}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{r.count}</td>
              <td className="px-4 py-3 text-sm text-slate/70">{r.description}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Recent pipeline activity" className="grid gap-4">
        <SectionHeading title="Recent Pipeline Activity" subtitle="Latest result rows in the pipeline" />
        <Table headers={["Student", "Course", "Department", "Stage", "Last Updated"]}>
          {pipeline.pending.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-slate">{r.studentName}</td>
              <td className="px-4 py-3">{r.courseCode}</td>
              <td className="px-4 py-3">{r.department ?? "—"}</td>
              <td className="px-4 py-3"><Badge tone="amber">{r.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3 text-xs text-slate/60">{r.updatedAt.toLocaleDateString("en-NG")}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
