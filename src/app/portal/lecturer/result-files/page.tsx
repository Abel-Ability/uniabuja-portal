import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { SectionHeading, EmptyState, StatusBadge, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My Result Files" };

export default async function ResultFilesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));
  const user = session.user;

  const files = await prisma.resultFile.findMany({
    where: { lecturerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-brand">Lecturer workspace</p>
        <h1 className="font-head text-3xl font-bold text-slate">My Result Files</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Every CSV you upload is stored so you can review the outcome and
          re-download the original file.
        </p>
      </section>

      <section>
        <SectionHeading
          title="Upload history"
          subtitle="Most recent files first."
          action={
            <Link href="/portal/lecturer/post-results" className="text-sm font-semibold text-brand hover:underline">
              Post new results →
            </Link>
          }
        />
        {files.length === 0 ? (
          <EmptyState title="No uploads yet" body="Post your first result file from the Post Results page." />
        ) : (
          <div className="space-y-4">
            {files.map((f) => (
              <div key={f.id} className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-head font-semibold text-slate">
                      {f.courseCode}{" "}
                      <span className="text-sm font-normal text-slate/70">— {f.courseTitle}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate/70">
                      {f.academicSession} · {SEMESTER_LABELS[f.semester]} · {f.kind === "BACKLOG" ? "Backlog" : "Normal"} · {f.contentType}
                    </p>
                    <p className="mt-0.5 text-xs text-slate/70">
                      {f.fileName} · {f.createdAt.toLocaleString("en-NG")} · {f.rowCount} rows (
                      {f.processedCount} processed, {f.failedCount} failed)
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={f.status} />
                    <a
                      href={`/portal/lecturer/result-files/${f.id}`}
                      download
                      className="rounded-full bg-brand-strong px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      Download CSV
                    </a>
                  </div>
                </div>
                {f.errorSummary ? (
                  <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate/5 p-3 text-xs text-red-700">
                    {f.errorSummary}
                  </pre>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone={f.kind === "BACKLOG" ? "amber" : "neutral"}>
                    {f.kind === "BACKLOG" ? "Backlog" : "Session"}
                  </Badge>
                  <span className="text-xs text-slate/70">CA max {f.caMax}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
