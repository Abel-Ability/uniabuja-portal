import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { computeCGPA, awardClass } from "@/lib/utils";
import { PageHeader, Card, Table, StatCard, StatusBadge, EmptyState, Badge, SectionHeading } from "@/components/ui";
import { GradeEntryForm } from "./grade-entry-form";
import { ApproveResultButton } from "./approve-result-button";
import { FileAppealForm, ReviewAppealButton, AppealStatus } from "./appeal-form";
import { LogMisconductForm, AdvanceMisconductButton } from "./misconduct-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Exams & Records" };

const SEMESTER_LABEL = { 1: "First Semester", 2: "Second Semester" } as Record<number, string>;

export default async function ResultsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const [results, appeals] = await Promise.all([
      prisma.result.findMany({
        where: { userId: user.id },
        orderBy: [{ academicSession: "asc" }, { semester: "asc" }],
        include: { course: true },
      }),
      prisma.appeal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    ]);

    const groups = new Map<string, typeof results>();
    for (const r of results) {
      const key = `${r.academicSession}|${r.semester}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const cgpa = computeCGPA(
      results
        .filter((r) => r.grade && r.gradeStatus === "FINAL")
        .map((r) => ({ units: r.course.units, grade: r.grade! })),
    );

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 3 · Records"
          title="Results & Academic Records"
          description="Your official transcript of results. Senate-approved results are final."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Overall CGPA" value={results.some((r) => r.gradeStatus === "FINAL") ? cgpa.toFixed(2) : "—"} hint={results.some((r) => r.gradeStatus === "FINAL") ? awardClass(cgpa) : undefined} />
            <StatCard label="Courses completed" value={results.filter((r) => r.gradeStatus === "FINAL").length} hint="Final grades" />
            <StatCard label="Units" value={results.filter((r) => r.gradeStatus === "FINAL").reduce((a, r) => a + r.course.units, 0)} hint="Completed units" />
          </section>

          {results.length === 0 ? (
            <EmptyState title="No results published" body="Results appear here after Senate approval." />
          ) : (
            [...groups.entries()].map(([key, rows]) => {
              const [academicSession, semesterRaw] = key.split("|");
              const gpa = computeCGPA(rows.filter((r) => r.grade).map((r) => ({ units: r.course.units, grade: r.grade! })));
              const totalUnits = rows.reduce((a, r) => a + r.course.units, 0);
              return (
                <section key={key}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-head text-xl font-bold text-slate">
                      {academicSession} · {SEMESTER_LABEL[Number(semesterRaw)] ?? "Semester"}
                    </h2>
                    <Badge tone="slate">
                      GPA {gpa.toFixed(2)} · {totalUnits} units
                    </Badge>
                  </div>
                  <Table headers={["Code", "Course", "Units", "CA", "Exam", "Total", "Grade", "Status"]}>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono text-xs text-slate">{r.course.code}</td>
                        <td className="px-4 py-3 text-slate">{r.course.title}</td>
                        <td className="px-4 py-3 text-slate/70">{r.course.units}</td>
                        <td className="px-4 py-3 text-slate/70">{r.caScore ?? "—"}</td>
                        <td className="px-4 py-3 text-slate/70">{r.examScore ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-slate">{r.total ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`font-head font-bold ${r.grade === "F" ? "text-red-600" : "text-slate"}`}>
                            {r.grade ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.gradeStatus} />
                        </td>
                      </tr>
                    ))}
                  </Table>
                </section>
              );
            })
          )}

          <section aria-label="Appeals">
            <SectionHeading title="Appeals" subtitle="Dispute a grade or a misconduct decision through the records unit." />
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h3 className="mb-4 font-head text-lg font-bold text-slate">File an appeal</h3>
                <FileAppealForm />
              </Card>
              <Card>
                <h3 className="mb-4 font-head text-lg font-bold text-slate">My appeals</h3>
                {appeals.length === 0 ? (
                  <EmptyState title="No appeals filed" />
                ) : (
                  <ul className="space-y-3">
                    {appeals.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate/10 p-3">
                        <div>
                          <p className="text-sm font-semibold text-slate">
                            {a.caseType === "GRADE" ? "Grade appeal" : "Misconduct appeal"} · {a.caseRef ?? "—"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate/75">{a.grounds}</p>
                        </div>
                        <AppealStatus status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "LECTURER") {
    const [submissions, registrations] = await Promise.all([
      prisma.result.findMany({
        where: { submittedById: user.id },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { course: true, user: true },
      }),
      prisma.courseRegistration.findMany({
        where: { status: "ACTIVE" },
        include: { course: true, user: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const coursesMap = new Map<string, { id: string; code: string; title: string; students: { id: string; fullName: string }[] }>();
    for (const reg of registrations) {
      const entry = coursesMap.get(reg.courseId) ?? { id: reg.courseId, code: reg.course.code, title: reg.course.title, students: [] };
      entry.students.push({ id: reg.userId, fullName: reg.user.fullName });
      coursesMap.set(reg.courseId, entry);
    }
    const courses = [...coursesMap.values()];

    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 3 · Lecturer" title="Result Submissions" description="Enter grades and track them through the approval pipeline." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <Card>
            <h3 className="mb-4 font-head text-lg font-bold text-slate">Enter grades</h3>
            <GradeEntryForm courses={courses} />
          </Card>
          <section aria-label="Submissions">
            <SectionHeading title="Submitted results" subtitle={`${submissions.length} submissions in the pipeline.`} />
            {submissions.length === 0 ? (
              <EmptyState title="No submissions yet" body="Enter results for your courses to see them here." />
            ) : (
              <Table headers={["Student", "Course", "Total", "Grade", "Status"]}>
                {submissions.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{r.course.code} · {r.course.title}</td>
                    <td className="px-4 py-3 text-slate">{r.total ?? "—"}</td>
                    <td className="px-4 py-3 font-head font-bold text-slate">{r.grade ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.gradeStatus} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "HOD_DEAN" || user.role === "EXAMS_RECORDS") {
    const [pending, appeals] = await Promise.all([
      prisma.result.findMany({
        where: { gradeStatus: user.role === "HOD_DEAN" ? "SUBMITTED" : "HOD_APPROVED" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { course: true, user: true, submittedBy: true },
      }),
      prisma.appeal.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: true } }),
    ]);
    const stage = user.role === "HOD_DEAN" ? "awaiting HOD approval" : "awaiting exams-unit finalisation";
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 3 · Approvals" title="Results Pipeline" description={`Results ${stage} (${pending.length} pending).`} />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {pending.length === 0 ? (
            <EmptyState title="Pipeline clear" />
          ) : (
            <Table headers={["Student", "Course", "Session", "Total", "Grade", "Submitted by", "Status", "Action"]}>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                  <td className="px-4 py-3 text-slate">{r.course.code}</td>
                  <td className="px-4 py-3 text-slate/70">{r.academicSession}</td>
                  <td className="px-4 py-3 text-slate">{r.total ?? "—"}</td>
                  <td className="px-4 py-3 font-head font-bold text-slate">{r.grade ?? "—"}</td>
                  <td className="px-4 py-3 text-slate/70">{r.submittedBy?.fullName ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.gradeStatus} /></td>
                  <td className="px-4 py-3">
                    <ApproveResultButton id={r.id} label={user.role === "HOD_DEAN" ? "Approve (HOD)" : "Senate finalise"} />
                  </td>
                </tr>
              ))}
            </Table>
          )}

          <section aria-label="Appeal queue">
            <SectionHeading title="Appeal queue" subtitle="Review grade and misconduct appeals." />
            {appeals.length === 0 ? (
              <EmptyState title="No appeals on record" />
            ) : (
              <Table headers={["Student", "Type", "Reference", "Grounds", "Status", "Action"]}>
                {appeals.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-slate">{a.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{a.caseType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{a.caseRef ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">{a.grounds}</td>
                    <td className="px-4 py-3"><AppealStatus status={a.status} /></td>
                    <td className="px-4 py-3">
                      {["SUBMITTED", "UNDER_REVIEW"].includes(a.status) ? <ReviewAppealButton id={a.id} /> : <span className="text-xs text-slate/70">Resolved</span>}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "STUDENT_AFFAIRS") {
    const [cases, students] = await Promise.all([
      prisma.misconductCase.findMany({ orderBy: { createdAt: "desc" }, include: { student: true } }),
      prisma.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    ]);
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 3 · Student Affairs" title="Misconduct Register" description="Log cases, advance through investigation → hearing → decision → closure. Every action is audit-trailed." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <Card>
            <h3 className="mb-4 font-head text-lg font-bold text-slate">Log a new case</h3>
            <LogMisconductForm students={students} />
          </Card>
          <section aria-label="Cases">
            <SectionHeading title="Cases" subtitle={`${cases.length} on record.`} />
            {cases.length === 0 ? (
              <EmptyState title="No cases logged" />
            ) : (
              <Table headers={["Student", "Title", "Evidence", "Status", "Action"]}>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate">{c.student.fullName}</td>
                    <td className="px-4 py-3 text-slate">{c.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{c.evidenceRef ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      {c.status !== "CLOSED" && c.status !== "APPEALED" ? <AdvanceMisconductButton id={c.id} /> : null}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "VERIFIER") {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 3 · Verify" title="Verification" description="Third-party verification of academic records." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">
              Transcript verification is available publicly at{" "}
              <a href="/verify" className="font-semibold text-brand underline">/verify</a> using the
              reference number printed on issued transcripts, and results can be
              verified through{" "}
              <a href="/api/v1/verify/result" className="font-semibold text-brand underline">/api/v1/verify/result</a>{" "}
              or ID cards via{" "}
              <a href="/api/v1/verify/id" className="font-semibold text-brand underline">/api/v1/verify/id</a>.
              Every check is audit-logged.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (user.role === "VC") {
    const [pipeline, appeals] = await Promise.all([
      prisma.result.findMany({
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { course: true, user: true, submittedBy: true },
      }),
      prisma.appeal.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: true } }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 3 · Read-only"
          title="Results & Academic Records"
          description="Institutional read-only view of the grade pipeline. No grade or course mutation."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Grade pipeline">
            <SectionHeading
              title="Grade pipeline"
              subtitle={`${pipeline.length} recent result records across the approval stages.`}
            />
            {pipeline.length === 0 ? (
              <EmptyState title="No results on record" />
            ) : (
              <Table headers={["Student", "Course", "Session", "Total", "Grade", "Submitted by", "Status"]}>
                {pipeline.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{r.course.code} · {r.course.title}</td>
                    <td className="px-4 py-3 text-slate/70">{r.academicSession} · S{r.semester}</td>
                    <td className="px-4 py-3 text-slate">{r.total ?? "—"}</td>
                    <td className="px-4 py-3 font-head font-bold text-slate">{r.grade ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">{r.submittedBy?.fullName ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.gradeStatus} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Appeal register">
            <SectionHeading
              title="Appeal register"
              subtitle={`${appeals.length} recent grade and misconduct appeals.`}
            />
            {appeals.length === 0 ? (
              <EmptyState title="No appeals on record" />
            ) : (
              <Table headers={["Student", "Type", "Reference", "Grounds", "Status"]}>
                {appeals.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-slate">{a.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{a.caseType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{a.caseRef ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">{a.grounds}</td>
                    <td className="px-4 py-3"><AppealStatus status={a.status} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
