import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import {
  courseAllocationMonitor,
  levelCoordinationMonitor,
  resultsPipeline,
} from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic Affairs" };

export default async function AcademicAffairsPage() {
  await requireGovernanceOversight();

  const [allocation, coordination, pipeline] = await Promise.all([
    courseAllocationMonitor(),
    levelCoordinationMonitor(),
    resultsPipeline(12),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Academic Affairs"
        description="Course allocation, teaching load, level coordination and the results pipeline — monitored, never changed."
      />

      <section aria-label="Academic summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses" value={allocation.totalCourses} hint={`${allocation.assignedThisSession} allocated this session`} />
        <StatCard label="Unallocated courses" value={allocation.unassigned} hint="No current-session allocation" />
        <StatCard label="Level coordinators" value={coordination.coordinators} hint={`${coordination.withCoordinator} of ${coordination.departments} departments covered`} />
        <StatCard label="Level advisers" value={coordination.advisersActive} hint="Active adviser assignments" />
      </section>

      <section>
        <SectionHeading
          title="Results pipeline"
          subtitle="The latest rows still moving through approval — the HoD and Exams & Records drive approval; this committee only monitors."
          action={
            <Link href="/portal/dvc/reports?report=results-pipeline" className="text-sm font-semibold text-brand-strong hover:underline">
              Export pipeline →
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-5">
          {pipeline.stages.map((s) => (
            <StatCard key={s.stage} label={s.stage.replaceAll("_", " ")} value={s.count} />
          ))}
        </div>
        {pipeline.pending.length === 0 ? (
          <div className="mt-4"><EmptyState title="No pending results" body="Every posted result has reached its final stage." /></div>
        ) : (
          <div className="mt-4">
            <Table headers={["Student", "Reg No", "Course", "Department", "Stage", "Updated"]}>
              {pipeline.pending.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate">{r.studentName}</td>
                  <td className="px-4 py-3 text-slate/70">{r.regNo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate/70">{r.courseCode}</td>
                  <td className="px-4 py-3 text-slate/70">{r.department ?? "—"}</td>
                  <td className="px-4 py-3"><Badge tone="gold">{r.status.replaceAll("_", " ")}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate/60">{r.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Course allocation by faculty" subtitle="Current-session assignments grouped by faculty." />
          {allocation.byFaculty.length === 0 ? (
            <EmptyState title="No allocations" />
          ) : (
            <Table headers={["Faculty", "Courses assigned"]}>
              {allocation.byFaculty.map((f) => (
                <tr key={f.faculty ?? "none"}>
                  <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.assigned}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div>
          <SectionHeading title="Level coordination gaps" subtitle="Departments without a current-session coordinator or adviser." />
          {coordination.withoutCoordinator.length === 0 && coordination.withoutAdviser.length === 0 ? (
            <EmptyState title="Full coverage" body="Every department has a coordinator and an adviser for this session." />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate">Without a level coordinator ({coordination.withoutCoordinator.length})</p>
                {coordination.withoutCoordinator.length === 0 ? (
                  <p className="text-sm text-slate/60">None.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {coordination.withoutCoordinator.map((d) => (
                      <Badge key={d} tone="amber">{d}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate">Without an active adviser ({coordination.withoutAdviser.length})</p>
                {coordination.withoutAdviser.length === 0 ? (
                  <p className="text-sm text-slate/60">None.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {coordination.withoutAdviser.map((d) => (
                      <Badge key={d} tone="gold">{d}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
