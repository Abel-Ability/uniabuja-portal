import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { computeCGPA, gradePoint, awardClass } from "@/lib/utils";
import { SectionHeading, EmptyState, Badge, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cumulative / Detailed Result" };

const inputCls =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export default async function CumulativeResultPage({
  searchParams,
}: {
  searchParams: Promise<{ matric?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));

  const params = await searchParams;
  const matric = (params.matric ?? "").trim().toUpperCase();

  let student: { fullName: string; registrationNo: string | null } | null = null;
  let results: {
    academicSession: string;
    semester: number;
    resultKind: string;
    caScore: number | null;
    examScore: number | null;
    total: number | null;
    grade: string | null;
    gradeStatus: string;
    course: { code: string; title: string; units: number };
  }[] = [];
  let lookupError: string | null = null;

  if (matric) {
    const found = await prisma.user.findFirst({
      where: { role: "STUDENT", OR: [{ registrationNo: matric }, { username: matric }] },
      select: { id: true, fullName: true, registrationNo: true },
    });
    if (!found) {
      lookupError = `No student found for matric number ${matric}.`;
    } else {
      student = found;
      results = await prisma.result.findMany({
        where: { userId: found.id },
        include: { course: true },
        orderBy: [{ academicSession: "asc" }, { semester: "asc" }, { course: { code: "asc" } }],
      });
    }
  }

  const units = results.map((r) => r.course.units);
  const totalUnits = units.reduce((a, b) => a + b, 0);
  const cgpa = computeCGPA(results.map((r) => ({ units: r.course.units, grade: r.grade ?? "F" })));
  const goodStanding = !results.some((r) => r.grade === "F");

  const bySession = new Map<string, typeof results>();
  for (const r of results) {
    const key = r.academicSession;
    bySession.set(key, [...(bySession.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-brand">Level Adviser</p>
        <h1 className="font-head text-3xl font-bold text-slate">Cumulative / Detailed Result</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Look up a student by matric number to review their full result history
          and cumulative GPA.
        </p>
      </section>

      <section>
        <form method="GET" className="flex max-w-2xl flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="matric"
            defaultValue={matric}
            required
            placeholder="e.g. UAH2021001"
            className={inputCls}
          />
          <button
            type="submit"
            className="rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Look up student
          </button>
        </form>
      </section>

      {lookupError ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
          {lookupError}
        </p>
      ) : null}

      {student && results.length === 0 ? (
        <EmptyState title="No results on record" body={`${student.fullName} has no posted results yet.`} />
      ) : null}

      {student && results.length > 0 ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Student</p>
              <p className="mt-1 font-head text-xl font-bold text-slate">{student.fullName}</p>
              <p className="text-sm text-slate/70">{student.registrationNo}</p>
            </div>
            <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">CGPA</p>
              <p className="mt-1 font-head text-2xl font-bold text-slate">{cgpa.toFixed(2)}</p>
              <p className="text-xs text-slate/70">{totalUnits} units</p>
            </div>
            <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Class / Standing</p>
              <p className="mt-1 font-head text-lg font-bold text-slate">{awardClass(cgpa)}</p>
              <Badge tone={goodStanding ? "brand" : "red"}>
                {goodStanding ? "Good standing" : "Not in good standing"}
              </Badge>
            </div>
          </section>

          <section>
            <SectionHeading title="Detailed results" subtitle="Every posted result, newest session first." />
            <div className="overflow-x-auto rounded-xl border border-slate/10">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                    <th scope="col" className="px-4 py-3">Session</th>
                    <th scope="col" className="px-4 py-3">Course</th>
                    <th scope="col" className="px-4 py-3">Units</th>
                    <th scope="col" className="px-4 py-3">CA</th>
                    <th scope="col" className="px-4 py-3">Exam</th>
                    <th scope="col" className="px-4 py-3">Total</th>
                    <th scope="col" className="px-4 py-3">Grade</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/10">
                  {results.map((r) => (
                    <tr key={`${r.academicSession}-${r.semester}-${r.course.code}`}>
                      <td className="px-4 py-3">
                        <p className="text-slate">{r.academicSession}</p>
                        <p className="text-xs text-slate/70">{SEMESTER_LABELS[r.semester]}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate">{r.course.code}</p>
                        <p className="max-w-[260px] truncate text-xs text-slate/70">{r.course.title}</p>
                      </td>
                      <td className="px-4 py-3 text-slate/75">{r.course.units}</td>
                      <td className="px-4 py-3 text-slate/75">{r.caScore ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/75">{r.examScore ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate">{r.total ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={r.grade === "F" ? "red" : "neutral"}>
                          {r.grade ?? "—"} · {gradePoint(r.grade ?? "F")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.gradeStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionHeading title="Per-session GPA" subtitle="Grade point average for each session." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...bySession.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([key, rows]) => {
                  const gpa = computeCGPA(rows.map((r) => ({ units: r.course.units, grade: r.grade ?? "F" })));
                  const units = rows.reduce((a, r) => a + r.course.units, 0);
                  return (
                    <div key={key} className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
                      <p className="font-head font-semibold text-slate">{key}</p>
                      <p className="mt-1 font-head text-2xl font-bold text-brand-strong">{gpa.toFixed(2)}</p>
                      <p className="text-xs text-slate/70">{rows.length} courses · {units} units</p>
                    </div>
                  );
                })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
