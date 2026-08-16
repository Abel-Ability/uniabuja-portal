import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { CsvResultForm } from "@/components/csv-result-form";
import { postResultsAction } from "../actions";
import { SectionHeading, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Post Results" };

export default async function PostResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; session?: string; semester?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));
  const user = session.user;

  const params = await searchParams;
  const assignments = await prisma.courseAssignment.findMany({
    where: {
      OR: [{ lecturerId: user.id }, { teamMembers: { some: { lecturerId: user.id } } }],
    },
    select: { id: true, courseCode: true, courseTitle: true, academicSession: true, semester: true },
    orderBy: [{ academicSession: "desc" }, { semester: "asc" }, { courseCode: "asc" }],
  });

  const selected =
    assignments.find(
      (a) =>
        a.courseCode === params.course &&
        a.academicSession === params.session &&
        (params.semester === undefined || a.semester === Number(params.semester)),
    ) ?? assignments[0];

  // The roster is always derived from legitimate ACTIVE registrations for the
  // selected course/session/semester — never from an uploaded file.
  const roster = selected
    ? await prisma.courseRegistration.findMany({
        where: {
          course: { code: selected.courseCode },
          academicSession: selected.academicSession,
          semester: selected.semester,
          status: "ACTIVE",
        },
        select: {
          user: {
            select: {
              fullName: true,
              registrationNo: true,
              username: true,
              programme: { select: { name: true } },
            },
          },
        },
        orderBy: { user: { fullName: "asc" } },
      })
    : [];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">Post Results</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Upload a CSV of session results for one of your assigned courses.
          The file is posted as SUBMITTED and routed to Exams &amp; Records for
          HoD and Senate approval.
        </p>
      </section>

      <section className="max-w-3xl">
        <SectionHeading title="New upload" subtitle="Choose the course, then attach your CSV." />
        <div className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
          <CsvResultForm
            action={postResultsAction}
            kind="NORMAL"
            assignments={assignments.map((a) => ({
              code: a.courseCode,
              title: a.courseTitle,
              session: a.academicSession,
              semester: a.semester,
            }))}
            initial={{
              course: params.course,
              session: params.session,
              semester: params.semester ? Number(params.semester) : undefined,
            }}
          />
        </div>
      </section>

      <section className="max-w-3xl">
        <SectionHeading
          title="Registered students"
          subtitle={
            selected
              ? `${selected.courseCode} · ${selected.academicSession} · ${SEMESTER_LABELS[selected.semester]} — ${roster.length} student${roster.length === 1 ? "" : "s"} registered`
              : "No course selected yet."
          }
        />
        {!selected || roster.length === 0 ? (
          <EmptyState
            title="No registered students yet"
            body="Students appear here once they register this course for the session."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Matric</th>
                  <th scope="col" className="px-4 py-3">Programme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/10">
                {roster.map((r) => (
                  <tr key={r.user.username}>
                    <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate/75">{r.user.registrationNo ?? r.user.username}</td>
                    <td className="px-4 py-3 text-slate/75">{r.user.programme?.name ?? "—"}</td>
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
