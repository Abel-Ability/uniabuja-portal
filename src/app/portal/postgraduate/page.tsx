import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  PageHeader,
  Card,
  Table,
  StatCard,
  StatusBadge,
  Badge,
  SectionHeading,
  EmptyState,
} from "@/components/ui";
import { ApplyPgForm } from "./apply-form";
import { AdvancePgApplicationButton } from "./advance-application-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Postgraduate School" };

const fmtDate = (d: Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const READ_ONLY_ROLES = ["LECTURER", "HOD", "DEAN", "BURSARY", "EXAMS_RECORDS", "DVC_OVERSIGHT", "VC"];

export default async function PostgraduatePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const [pgProgrammes, application, supervision, thesis] = await Promise.all([
      prisma.programme.findMany({
        where: { programmeType: "PG" },
        orderBy: { code: "asc" },
      }),
      prisma.pGApplication.findFirst({
        where: { userId: user.id },
        include: { programme: true },
      }),
      prisma.supervisorAssignment.findFirst({
        where: { pgStudentId: user.id },
        include: { staff: true },
      }),
      prisma.thesis.findFirst({ where: { pgStudentId: user.id } }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 9 · Postgraduate"
          title="Postgraduate & Research"
          description="Apply for postgraduate study, track your application and supervision, and monitor thesis progress."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Application"
              value={application ? application.screeningStatus.replaceAll("_", " ") : "Not started"}
              hint={application ? application.programme?.code ?? "PG programme" : "No application yet"}
            />
            <StatCard
              label="Supervisor"
              value={supervision?.staff?.fullName ?? "Not assigned"}
              hint={supervision?.programme ?? undefined}
            />
            <StatCard
              label="Thesis"
              value={thesis ? thesis.status.replaceAll("_", " ") : "Not started"}
              hint={thesis ? `Proposal ${thesis.proposalSubmittedAt ? fmtDate(thesis.proposalSubmittedAt) : "—"}` : undefined}
            />
          </section>

          {!application ? (
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Apply for a postgraduate programme</h3>
              <ApplyPgForm
                programmes={pgProgrammes.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
              />
            </Card>
          ) : (
            <section aria-label="Application">
              <SectionHeading
                title="My application"
                subtitle="Track your postgraduate application through screening, interview and admission."
              />
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-head text-lg font-bold text-slate">{application.programme?.name ?? "Postgraduate programme"}</p>
                    <p className="text-sm text-slate/75">
                      {application.programme?.code} · Applied {fmtDate(application.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={application.screeningStatus} />
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">Referee 1</dt>
                    <dd className="text-sm text-slate">{application.referee1Name ?? "—"} · {application.referee1Email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">Referee 2</dt>
                    <dd className="text-sm text-slate">{application.referee2Name ?? "—"}{application.referee2Email ? ` · ${application.referee2Email}` : ""}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">Interview</dt>
                    <dd className="text-sm text-slate">{fmtDate(application.interviewAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">Interview outcome</dt>
                    <dd className="text-sm text-slate">{application.interviewOutcome ?? "Pending"}</dd>
                  </div>
                </dl>
              </Card>
            </section>
          )}

          <section aria-label="Supervision" className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Supervisor</h3>
              {supervision ? (
                <div className="space-y-2">
                  <p className="font-medium text-slate">{supervision.staff?.fullName ?? "Unnamed supervisor"}</p>
                  <p className="text-sm text-slate/75">
                    {supervision.programme ?? "Postgraduate programme"} · {supervision.workloadUnits} workload unit(s)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate/75">A supervisor is assigned after admission.</p>
              )}
            </Card>
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Thesis</h3>
              {thesis ? (
                <div className="space-y-3">
                  <p className="font-medium text-slate">{thesis.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="brand">Proposal {thesis.proposalStatus.replaceAll("_", " ")}</Badge>
                    <Badge tone="gold">Similarity {thesis.plagiarismScore ?? "—"}%</Badge>
                  </div>
                  <p className="text-xs text-slate/75">
                    Defence {fmtDate(thesis.defenseScheduledAt)} · Examiner {thesis.externalExaminer ?? "—"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate/75">Your thesis record appears after proposal submission.</p>
              )}
            </Card>
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "PG_SCHOOL") {
    const [applications, assignments, theses] = await Promise.all([
      prisma.pGApplication.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: true, programme: true },
      }),
      prisma.supervisorAssignment.findMany({
        orderBy: { createdAt: "desc" },
        include: { pgStudent: true, staff: true },
      }),
      prisma.thesis.findMany({
        orderBy: { createdAt: "desc" },
        include: { pgStudent: true },
      }),
    ]);
    const pendingCount = applications.filter((a) => a.screeningStatus !== "ADMITTED").length;

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 9 · Postgraduate School"
          title="PG & Research Console"
          description="Screen applications, track supervision assignments and thesis progress."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Applications" value={applications.length} hint={`${pendingCount} in the pipeline`} />
            <StatCard label="Supervisions" value={assignments.length} hint="Active assignments" />
            <StatCard label="Theses" value={theses.length} hint="On record" />
          </section>

          <section aria-label="Applications">
            <SectionHeading
              title="PG applications"
              subtitle="Advance applications through screening → interview → admission."
            />
            {applications.length === 0 ? (
              <EmptyState title="No applications yet" />
            ) : (
              <Table headers={["Student", "Programme", "Referees", "Interview", "Status", "Action"]}>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-slate">{a.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{a.programme?.code ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.referee1Name ?? "—"}{a.referee2Name ? `, ${a.referee2Name}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate/70">{fmtDate(a.interviewAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.screeningStatus} /></td>
                    <td className="px-4 py-3">
                      {a.screeningStatus !== "ADMITTED" ? (
                        <AdvancePgApplicationButton id={a.id} />
                      ) : (
                        <span className="text-xs text-slate/70">Admitted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Supervisions">
            <SectionHeading
              title="Supervisor roster"
              subtitle="Assignments between postgraduate students and academic staff."
            />
            {assignments.length === 0 ? (
              <EmptyState title="No assignments yet" />
            ) : (
              <Table headers={["Student", "Programme", "Supervisor", "Workload"]}>
                {assignments.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate">{s.pgStudent.fullName}</td>
                    <td className="px-4 py-3 text-slate">{s.programme ?? "—"}</td>
                    <td className="px-4 py-3 text-slate">{s.staff.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{s.workloadUnits} unit(s)</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Theses">
            <SectionHeading
              title="Theses"
              subtitle="Proposal, similarity and defence status of all registered theses."
            />
            {theses.length === 0 ? (
              <EmptyState title="No theses registered" />
            ) : (
              <Table headers={["Student", "Title", "Proposal", "Similarity", "Status", "Defence"]}>
                {theses.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-slate">{t.pgStudent.fullName}</td>
                    <td className="px-4 py-3 text-slate">{t.title}</td>
                    <td className="px-4 py-3 text-slate/70">{t.proposalStatus.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate/70">{t.plagiarismScore ?? "—"}%</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-slate/70">{fmtDate(t.defenseScheduledAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (READ_ONLY_ROLES.includes(user.role)) {
    const [applications, theses] = await Promise.all([
      prisma.pGApplication.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: true, programme: true },
      }),
      prisma.thesis.findMany({
        orderBy: { createdAt: "desc" },
        include: { pgStudent: true },
      }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 9 · Read-only"
          title="Postgraduate & Research"
          description="Review postgraduate applications and thesis records."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Applications">
            <SectionHeading title="PG applications" subtitle="Applications submitted across all programmes." />
            {applications.length === 0 ? (
              <EmptyState title="No applications yet" />
            ) : (
              <Table headers={["Student", "Programme", "Referees", "Interview", "Status"]}>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-slate">{a.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{a.programme?.code ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.referee1Name ?? "—"}{a.referee2Name ? `, ${a.referee2Name}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate/70">{fmtDate(a.interviewAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.screeningStatus} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Theses">
            <SectionHeading title="Theses" subtitle="All registered theses and their progress." />
            {theses.length === 0 ? (
              <EmptyState title="No theses registered" />
            ) : (
              <Table headers={["Student", "Title", "Proposal", "Similarity", "Status"]}>
                {theses.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-slate">{t.pgStudent.fullName}</td>
                    <td className="px-4 py-3 text-slate">{t.title}</td>
                    <td className="px-4 py-3 text-slate/70">{t.proposalStatus.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate/70">{t.plagiarismScore ?? "—"}%</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
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
