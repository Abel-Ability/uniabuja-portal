import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "./guard";
import {
  MATTER_STATUS_LABELS,
  RESOLUTION_LABELS,
  AGENDA_STATUS_LABELS,
} from "@/lib/senate";
import {
  PageHeader,
  StatCard,
  SectionHeading,
  Table,
  StatusBadge,
  Badge,
  EmptyState,
} from "@/components/ui";
import { getResultPipelineStats } from "@/lib/academic-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Senate Business Dashboard" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

const RESOLUTION_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  APPROVED: "brand",
  RATIFIED: "brand",
  ADOPTED: "brand",
  REJECTED: "red",
  DEFERRED: "gold",
  WITHDRAWN: "neutral",
};

type GroupedCount = { [key: string]: unknown; _count: { _all: number } };

function statusCount(groups: GroupedCount[], key: string, status: string): number {
  return groups.find((g) => g[key] === status)?._count._all ?? 0;
}

export default async function SbcDashboardPage() {
  await requireSbcChairman();

  const [
    matterByStatus,
    decisions,
    agendas,
    recentMatters,
    resultsByStatus,
    senateAnnouncements,
  ] = await Promise.all([
    prisma.senateMatter.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.senateDecision.findMany({
      orderBy: { recordedAt: "desc" },
      take: 6,
      include: { matter: true, recordedBy: true },
    }),
    prisma.senateAgenda.findMany({
      where: { meetingDate: { gte: new Date() } },
      orderBy: { meetingDate: "asc" },
      take: 5,
      include: { createdBy: true },
    }),
    prisma.senateMatter.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { submittedBy: true },
    }),
    getResultPipelineStats(),
    prisma.announcement.findMany({
      where: { scope: { in: ["STAFF", "ROLE"] } },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
  ]);

  const mattersTotal = matterByStatus.reduce((a, g) => a + g._count._all, 0);
  const decisionsTotal = decisions.length;

  const pipelineTotal = resultsByStatus.total;
  const gradeStatus = (s: keyof typeof resultsByStatus.byStage) => resultsByStatus.byStage[s];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Senate Business Dashboard"
        description="Matters before Senate, recorded decisions, the upcoming agenda and read-only oversight of the results pipeline."
      />

      <section aria-label="Senate summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Matters this session" value={nfmt(mattersTotal)} hint="Across all categories" />
        <StatCard label="Awaiting screening" value={nfmt(statusCount(matterByStatus, "status", "SUBMITTED"))} hint="Not yet admitted to the agenda" />
        <StatCard label="Screened" value={nfmt(statusCount(matterByStatus, "status", "SCREENED"))} hint="Admitted, decision pending" />
        <StatCard label="Decisions recorded" value={nfmt(statusCount(matterByStatus, "status", "DECIDED"))} hint="Recorded through the workflow" />
      </section>

      <section aria-label="Results pipeline oversight" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Results awaiting HoD" value={nfmt(gradeStatus("SUBMITTED"))} hint="Read-only oversight" />
        <StatCard label="HoD-approved" value={nfmt(gradeStatus("HOD_APPROVED"))} hint="Read-only oversight" />
        <StatCard label="Senate-approved" value={nfmt(gradeStatus("SENATE_APPROVED"))} hint="Read-only oversight" />
        <StatCard label="Final" value={nfmt(gradeStatus("FINAL"))} hint="Read-only oversight" />
      </section>
      <p className="text-xs text-slate/70">
        The SBC Chairman holds read-only access to grades for {resultsByStatus.academicSession} semester {resultsByStatus.semester} ({pipelineTotal.toLocaleString("en-NG")} result records on record). The
        Chairman cannot approve, edit or return any result.
      </p>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="Recent matters"
            subtitle="Latest matters raised before Senate, newest first."
          />
          {recentMatters.length === 0 ? (
            <EmptyState title="No matters yet" body="Matters raised for Senate consideration will appear here." />
          ) : (
            <div className="space-y-3">
              {recentMatters.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate/10 bg-white p-4 shadow-sm dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-slate/60">{m.reference}</p>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-1 font-medium text-slate">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate/70">{m.summary}</p>
                  <p className="mt-2 text-xs text-slate/60">
                    {MATTER_STATUS_LABELS[m.status] ?? m.status} · submitted by {m.submittedBy.fullName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading
            title="Upcoming Senate agenda"
            subtitle="The official agenda is prepared by Registry / Exams & Records — read-only here. The Chairman cannot create it."
          />
          {agendas.length === 0 ? (
            <EmptyState title="No upcoming agenda" body="The next scheduled Senate agenda will appear here." />
          ) : (
            <div className="space-y-3">
              {agendas.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate/10 bg-white p-4 shadow-sm dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate">{a.title}</p>
                    <Badge tone="amber">{AGENDA_STATUS_LABELS[a.status] ?? a.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate/70">
                    {a.meetingDate.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {Array.isArray(a.items) && a.items.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate/70">
                      {(a.items as unknown[]).slice(0, 4).map((item, i) => (
                        <li key={i}>{String(item)}</li>
                      ))}
                      {(a.items as unknown[]).length > 4 ? <li className="text-slate/50">… and more</li> : null}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Latest decisions"
          subtitle="Senate decisions recorded through the matter workflow."
        />
        {decisionsTotal === 0 ? (
          <EmptyState title="No decisions recorded" body="Decisions appear here once recorded on screened matters." />
        ) : (
          <Table headers={["Matter", "Reference", "Resolution", "Decision", "Recorded by", "Recorded"]}>
            {decisions.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-slate">{d.matter.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate/60">{d.matter.reference}</td>
                <td className="px-4 py-3">
                  <Badge tone={RESOLUTION_TONES[d.resolution] ?? "neutral"}>
                    {RESOLUTION_LABELS[d.resolution] ?? d.resolution}
                  </Badge>
                </td>
                <td className="max-w-xs px-4 py-3 text-slate/70">
                  <p className="truncate">{d.decisionBody}</p>
                </td>
                <td className="px-4 py-3 text-slate/70">{d.recordedBy.fullName}</td>
                <td className="px-4 py-3 text-slate/70">
                  {d.recordedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Senate communications"
          subtitle="Announcements published to staff or Senate roles."
        />
        {senateAnnouncements.length === 0 ? (
          <EmptyState title="No Senate announcements" body="Publish announcements from the Communications page." />
        ) : (
          <Table headers={["Title", "Scope", "Published"]}>
            {senateAnnouncements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{a.title}</p>
                  <p className="max-w-md truncate text-xs text-slate/75">{a.body}</p>
                </td>
                <td className="px-4 py-3"><Badge tone="slate">{a.scope}</Badge></td>
                <td className="px-4 py-3 text-slate/70">
                  {a.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <p className="text-xs text-slate/60">
        <Link href="/portal/sbc/matters" className="font-semibold text-brand-strong hover:underline">
          Manage matters →
        </Link>{" "}
        · <Link href="/portal/sbc/decisions" className="font-semibold text-brand-strong hover:underline">Decisions</Link> ·{" "}
        <Link href="/portal/sbc/results" className="font-semibold text-brand-strong hover:underline">Results pipeline</Link>
      </p>
    </div>
  );
}
