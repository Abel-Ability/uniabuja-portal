import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { CorrectionRequestForm } from "@/components/correction-request-form";
import { requestResultCorrection } from "../actions";
import { SectionHeading, EmptyState, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Request for Result Correction" };

export default async function ResultCorrectionPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; session?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));
  const user = session.user;

  const params = await searchParams;
  const requests = await prisma.resultCorrectionRequest.findMany({
    where: { requesterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">Request for Result Correction</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Flag a posted result that needs amending. Requests go to Exams &amp;
          Records as SUBMITTED for review.
        </p>
      </section>

      <section className="max-w-3xl">
        <SectionHeading title="New request" subtitle="Complete the details below." />
        <div className="rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
          <CorrectionRequestForm
            action={requestResultCorrection}
            initial={{ course: params.course, session: params.session }}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Previous requests" subtitle="Your correction history." />
        {requests.length === 0 ? (
          <EmptyState title="No requests yet" body="Submitted correction requests will appear here." />
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate/10 bg-white p-4 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate">
                    {r.courseCode} · {r.studentMatricNo}
                    {r.studentName ? <span className="font-normal text-slate/70"> — {r.studentName}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate/70">
                    {r.academicSession} · {SEMESTER_LABELS[r.semester]} · {r.requestedChange}
                  </p>
                  <p className="mt-0.5 text-xs text-slate/70">
                    {r.createdAt.toLocaleString("en-NG")}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
