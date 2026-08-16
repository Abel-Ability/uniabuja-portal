import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "../guard";
import { RESOLUTION_LABELS } from "@/lib/senate";
import { PageHeader, SectionHeading, Table, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Senate Decisions" };

const RESOLUTION_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  APPROVED: "brand",
  RATIFIED: "brand",
  ADOPTED: "brand",
  REJECTED: "red",
  DEFERRED: "gold",
  WITHDRAWN: "neutral",
};

export default async function SbcDecisionsPage() {
  await requireSbcChairman();

  const decisions = await prisma.senateDecision.findMany({
    orderBy: { recordedAt: "desc" },
    take: 200,
    include: { matter: true, recordedBy: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Recorded Senate Decisions"
        description="Every decision is recorded through the matter workflow — a matter must be screened before a decision can be recorded, and each recording is audit-logged."
      />

      <section>
        <SectionHeading
          title="Decision register"
          subtitle="Decisions recorded on screened matters, newest first."
        />
        {decisions.length === 0 ? (
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
                <td className="max-w-md px-4 py-3 text-slate/70">{d.decisionBody}</td>
                <td className="px-4 py-3 text-slate/70">{d.recordedBy.fullName}</td>
                <td className="px-4 py-3 text-slate/70">
                  {d.recordedAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  {d.recordedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
