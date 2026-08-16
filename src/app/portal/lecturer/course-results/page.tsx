import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { SectionHeading, EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Course Results" };

export default async function CourseResultsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));
  const user = session.user;

  const assignments = await prisma.courseAssignment.findMany({
    where: {
      OR: [{ lecturerId: user.id }, { teamMembers: { some: { lecturerId: user.id } } }],
    },
    orderBy: [{ academicSession: "desc" }, { semester: "asc" }, { courseCode: "asc" }],
  });

  const courseIds = assignments.map((a) => a.courseId).filter((c): c is string => Boolean(c));
  const results = courseIds.length
    ? await prisma.result.findMany({ where: { courseId: { in: courseIds } } })
    : [];

  const byKey = new Map<string, typeof results>();
  for (const r of results) {
    const key = `${r.courseId}|${r.academicSession}|${r.semester}|${r.resultKind}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }

  const GRADES = ["A", "B", "C", "D", "E", "F"] as const;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">Course Results</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          A read-only view of the results posted for your assigned courses and
          where they sit in the approval pipeline.
        </p>
      </section>

      <section>
        <SectionHeading
          title="Published & in-progress results"
          subtitle="SUBMITTED rows await HoD approval; FINAL rows have been approved."
        />
        {assignments.length === 0 ? (
          <EmptyState title="No courses assigned yet" body="Courses appear here once your HoD assigns them." />
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => {
              const normals = byKey.get(`${a.courseId}|${a.academicSession}|${a.semester}|NORMAL`) ?? [];
              const backlogs = byKey.get(`${a.courseId}|${a.academicSession}|${a.semester}|BACKLOG`) ?? [];
              const rows = [...normals, ...backlogs];
              const submitted = rows.filter((r) => r.gradeStatus === "SUBMITTED").length;
              const final = rows.filter((r) => r.gradeStatus === "FINAL").length;
              const dist = Object.fromEntries(GRADES.map((g) => [g, rows.filter((r) => r.grade === g).length]));

              return (
                <div key={a.id} className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-head font-semibold text-slate">{a.courseCode}</p>
                      <p className="mt-0.5 text-sm text-slate/70">{a.courseTitle}</p>
                      <p className="mt-1 text-xs text-slate/70">
                        {a.academicSession} · {SEMESTER_LABELS[a.semester]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="slate">{rows.length} rows</Badge>
                      <Badge tone="amber">{submitted} submitted</Badge>
                      <Badge tone="brand">{final} final</Badge>
                      {backlogs.length > 0 ? <Badge tone="neutral">{backlogs.length} backlog</Badge> : null}
                    </div>
                  </div>
                  {rows.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {GRADES.map((g) =>
                        dist[g] > 0 ? (
                          <Badge key={g} tone={g === "F" ? "red" : "neutral"}>
                            {g}: {dist[g]}
                          </Badge>
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate/70">No results posted for this assignment yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
