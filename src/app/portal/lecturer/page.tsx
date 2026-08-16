import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS, academicSessions } from "@/lib/constants";
import { getCourseRegResultCounts } from "@/lib/academic-stats";
import { Card, StatCard, Badge, SectionHeading, EmptyState, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Lecturer Workspace" };

export default async function LecturerHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));
  const user = session.user;

  const [assignments, files, corrections] = await Promise.all([
    prisma.courseAssignment.findMany({
      where: {
        OR: [{ lecturerId: user.id }, { teamMembers: { some: { lecturerId: user.id } } }],
      },
      orderBy: [{ academicSession: "desc" }, { semester: "asc" }, { courseCode: "asc" }],
    }),
    prisma.resultFile.findMany({
      where: { lecturerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.resultCorrectionRequest.findMany({
      where: { requesterId: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sessions = academicSessions();

  // Per assigned course, how many students registered and how many already have
  // a submitted result this session/semester (shared with every other level).
  const scopeKeys = new Set<string>();
  for (const a of assignments) scopeKeys.add(`${a.academicSession}|${a.semester}`);
  const regCounts = new Map<string, { registered: number; submitted: number; completionPct: number }>();
  for (const key of scopeKeys) {
    const [academicSession, semesterRaw] = key.split("|");
    const semester = Number(semesterRaw);
    const codes = assignments
      .filter((a) => a.academicSession === academicSession && a.semester === semester)
      .map((a) => a.courseCode);
    const counts = await getCourseRegResultCounts(codes, { academicSession, semester });
    for (const entry of counts.values()) {
      regCounts.set(`${academicSession}|${semester}|${entry.courseCode}`, entry);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">Welcome back, {user.fullName}.</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Post and track results for the courses assigned to you by your HoD.
          Uploads go to Exams &amp; Records as SUBMITTED for approval, and every
          action is recorded in the tamper-evident audit log.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.faculty && <Badge tone="brand">{user.faculty}</Badge>}
          {user.department && <Badge tone="neutral">{user.department}</Badge>}
        </div>
      </section>

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Assigned courses" value={assignments.length} hint="This session & earlier" />
        <StatCard
          label="Result files posted"
          value={files.length === 5 ? "5+" : files.length}
          hint="Latest five shown"
        />
        <StatCard
          label="Open corrections"
          value={corrections.length}
          hint="Submitted or under review"
        />
        <StatCard label="Current session" value={sessions[sessions.length - 1] ?? "—"} />
      </section>

      <section>
        <SectionHeading
          title="My assigned courses"
          subtitle="Courses allocated to you by session and semester."
        />
        {assignments.length === 0 ? (
          <EmptyState
            title="No courses assigned yet"
            body="Your HoD assigns courses for each session and semester. Assigned courses will appear here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((a) => (
              <Card key={a.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-head font-semibold text-slate">{a.courseCode}</p>
                  <p className="mt-0.5 text-sm text-slate/70">{a.courseTitle}</p>
                  <p className="mt-1 text-xs text-slate/70">
                    {a.academicSession} · {SEMESTER_LABELS[a.semester]}
                  </p>
                  {(() => {
                    const stats = regCounts.get(`${a.academicSession}|${a.semester}|${a.courseCode}`);
                    return stats ? (
                      <p className="mt-1 text-xs text-slate/70">
                        {stats.registered} registered · {stats.submitted} submitted ·{" "}
                        {stats.completionPct}% complete
                      </p>
                    ) : null;
                  })()}
                  <p className="mt-1 text-xs">
                    {a.lecturerId === user.id ? (
                      <Badge tone="brand">Main lecturer</Badge>
                    ) : (
                      <Badge tone="neutral">Co-lecturer</Badge>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone="brand">{a.department}</Badge>
                  <div className="flex gap-2">
                    <Link
                      href={`/portal/lecturer/post-results?course=${encodeURIComponent(a.courseCode)}&session=${encodeURIComponent(a.academicSession)}&semester=${a.semester}`}
                      className="rounded-full bg-brand-strong px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Post results
                    </Link>
                    <Link
                      href={`/portal/lecturer/post-backlog?course=${encodeURIComponent(a.courseCode)}&session=${encodeURIComponent(a.academicSession)}`}
                      className="rounded-full border border-brand-strong px-3 py-1.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-strong hover:text-white"
                    >
                      Backlog
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Recent uploads"
          subtitle="Your latest result files."
          action={
            <Link href="/portal/lecturer/result-files" className="text-sm font-semibold text-brand hover:underline">
              View all →
            </Link>
          }
        />
        {files.length === 0 ? (
          <EmptyState title="No uploads yet" body="Post your first result file from the Post Results page." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                  <th scope="col" className="px-4 py-3">Course</th>
                  <th scope="col" className="px-4 py-3">Session</th>
                  <th scope="col" className="px-4 py-3">Rows</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/10">
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate">{f.courseCode}</p>
                      <p className="text-xs text-slate/70">{f.fileName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate/75">{f.academicSession}</td>
                    <td className="px-4 py-3 text-slate/75">
                      {f.processedCount}/{f.rowCount}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
