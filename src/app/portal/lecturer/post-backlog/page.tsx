import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { CsvResultForm } from "@/components/csv-result-form";
import { postBacklogResultsAction } from "../actions";
import { SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Post Backlog Results" };

export default async function PostBacklogResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; session?: string }>;
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

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">Post Backlog Results</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Upload re-sit / backlog results for one of your assigned courses.
          These rows are marked as BACKLOG so they are kept apart from the
          regular session results.
        </p>
      </section>

      <section className="max-w-3xl">
        <SectionHeading title="New upload" subtitle="Choose the course, then attach your CSV." />
        <div className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
          <CsvResultForm
            action={postBacklogResultsAction}
            kind="BACKLOG"
            assignments={assignments.map((a) => ({
              code: a.courseCode,
              title: a.courseTitle,
              session: a.academicSession,
              semester: a.semester,
            }))}
            initial={{
              course: params.course,
              session: params.session,
            }}
          />
        </div>
      </section>
    </div>
  );
}
