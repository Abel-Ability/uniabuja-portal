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
import { LogbookForm } from "./logbook-form";
import { SubmitRecordButton } from "./submit-record-button";
import { SignOffButton } from "./sign-off-button";
import { VisitationForm } from "./visitation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "SIWES / Industrial Training" };

const fmtDate = (d: Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function SiwesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const record = await prisma.sIWESRecord.findFirst({
      where: { userId: user.id },
      orderBy: { id: "desc" },
      include: { logbookEntries: { orderBy: { weekNo: "asc" } } },
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 10 · SIWES"
          title="Industrial Training"
          description="Your placement, weekly logbook and ITF sign-off."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {!record ? (
            <EmptyState title="No placement on record" body="Your SIWES placement record appears here once registered." />
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-head text-lg font-bold text-slate">{record.orgName}</p>
                    <p className="text-sm text-slate/75">
                      {record.orgAddress} · {record.academicSession}
                    </p>
                    <p className="text-xs text-slate/70">
                      {fmtDate(record.startAt)} – {fmtDate(record.endAt)}
                    </p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              </Card>

              <section aria-label="Logbook">
                <SectionHeading
                  title="Weekly logbook"
                  subtitle="Record your activities for each week of the placement."
                />
                <div className="grid gap-6 lg:grid-cols-2">
                  {record.status === "ACTIVE" ? (
                    <Card>
                      <h3 className="mb-4 font-head text-lg font-bold text-slate">Add a week</h3>
                      <LogbookForm />
                    </Card>
                  ) : null}
                  <Card>
                    <h3 className="mb-4 font-head text-lg font-bold text-slate">Entries</h3>
                    {record.logbookEntries.length === 0 ? (
                      <EmptyState title="No entries yet" body="Add your first weekly entry above." />
                    ) : (
                      <Table headers={["Week", "Activities", "Submitted", "Comment"]}>
                        {record.logbookEntries.map((e) => (
                          <tr key={e.id}>
                            <td className="px-4 py-3 font-head font-bold text-slate">Week {e.weekNo}</td>
                            <td className="px-4 py-3 text-slate">{e.activities}</td>
                            <td className="px-4 py-3 text-slate/70">{fmtDate(e.submittedAt)}</td>
                            <td className="px-4 py-3 text-slate/70">{e.supervisorComment ?? "—"}</td>
                          </tr>
                        ))}
                      </Table>
                    )}
                  </Card>
                </div>
              </section>

              {record.status === "ACTIVE" ? (
                <Card>
                  <h3 className="mb-4 font-head text-lg font-bold text-slate">Submit for sign-off</h3>
                  <p className="mb-4 text-sm text-slate/70">
                    Once your placement ends, submit your logbook for SIWES coordinator sign-off.
                  </p>
                  <SubmitRecordButton />
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "SIWES") {
    const records = await prisma.sIWESRecord.findMany({
      orderBy: { startAt: "desc" },
      include: {
        user: true,
        logbookEntries: true,
        visitationReports: { include: { coordinator: true }, orderBy: { visitedAt: "desc" } },
      },
    });
    const active = records.filter((r) => r.status === "ACTIVE");
    const awaiting = records.filter((r) => r.status === "SUBMITTED");
    const signable = records.filter((r) => ["ACTIVE", "SUBMITTED"].includes(r.status));

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 10 · SIWES Unit"
          title="SIWES Console"
          description="Manage placements, logbook reviews and ITF sign-off."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Placements" value={records.length} hint="All records" />
            <StatCard label="Active" value={active.length} hint="In progress" />
            <StatCard label="Awaiting sign-off" value={awaiting.length} hint="Submitted logbooks" />
          </section>

          <section aria-label="Placements">
            <SectionHeading
              title="Placements"
              subtitle="Students with registered SIWES placements and their logbook progress."
            />
            {records.length === 0 ? (
              <EmptyState title="No placements registered" />
            ) : (
              <Table headers={["Student", "Organisation", "Session", "Period", "Entries", "Status", "Action"]}>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{r.orgName}</td>
                    <td className="px-4 py-3 text-slate/70">{r.academicSession}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {fmtDate(r.startAt)} – {fmtDate(r.endAt)}
                    </td>
                    <td className="px-4 py-3 text-slate/70">{r.logbookEntries.length}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      {r.status === "SUBMITTED" ? (
                        <SignOffButton id={r.id} />
                      ) : r.status === "SIGNED_OFF" ? (
                        <span className="text-xs text-slate/70">Signed off</span>
                      ) : (
                        <span className="text-xs text-slate/70">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Visitation" className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Log a supervision visit</h3>
              <VisitationForm
                records={signable.map((r) => ({ id: r.id, label: `${r.user.fullName} · ${r.orgName}` }))}
              />
            </Card>
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Visitation reports</h3>
              {records.flatMap((r) => r.visitationReports).length === 0 ? (
                <EmptyState title="No visitation reports yet" />
              ) : (
                <ul className="space-y-3">
                  {records.flatMap((r) =>
                    r.visitationReports.map((v) => (
                      <li key={v.id} className="rounded-xl border border-slate/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate">
                            {r.user.fullName} · {r.orgName}
                          </p>
                          <Badge tone="slate">{fmtDate(v.visitedAt)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate/75">{v.coordinator?.fullName ?? "Coordinator"}</p>
                        <p className="mt-1 text-sm text-slate/70">{v.notes}</p>
                      </li>
                    )),
                  )}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "HOD" || user.role === "DVC_OVERSIGHT" || user.role === "VC") {
    const records = await prisma.sIWESRecord.findMany({
      orderBy: { startAt: "desc" },
      include: { user: true, logbookEntries: true },
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 10 · Read-only"
          title="SIWES / Industrial Training"
          description="Review placement and logbook records."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {records.length === 0 ? (
            <EmptyState title="No placements registered" />
          ) : (
            <Table headers={["Student", "Organisation", "Session", "Period", "Entries", "Status"]}>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                  <td className="px-4 py-3 text-slate">{r.orgName}</td>
                  <td className="px-4 py-3 text-slate/70">{r.academicSession}</td>
                  <td className="px-4 py-3 text-slate/70">
                    {fmtDate(r.startAt)} – {fmtDate(r.endAt)}
                  </td>
                  <td className="px-4 py-3 text-slate/70">{r.logbookEntries.length}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
