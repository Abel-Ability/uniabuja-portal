import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "../guard";
import { CATEGORY_LABELS, MATTER_STATUS_LABELS } from "@/lib/senate";
import { PageHeader, SectionHeading, Table, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { MatterForm } from "./matter-form";
import { MatterActions } from "./matter-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Senate Matters" };

const CATEGORY_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  ACADEMIC: "brand",
  ADMINISTRATIVE: "slate",
  EXAMINATIONS: "gold",
  DISCIPLINE: "red",
  FINANCE: "amber",
  STAFF: "neutral",
  STUDENT: "neutral",
  OTHER: "neutral",
};

export default async function SbcMattersPage() {
  await requireSbcChairman();

  const matters = await prisma.senateMatter.findMany({
    orderBy: { createdAt: "desc" },
    include: { submittedBy: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Matters before Senate"
        description="Raise matters and screen them for Senate consideration. A decision may only be recorded once a matter has been screened — every step is audited."
      />

      <section className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
        <SectionHeading title="Raise a matter" subtitle="Submit a new matter for Senate consideration (stage: Submitted)." />
        <div className="max-w-3xl">
          <MatterForm />
        </div>
      </section>

      <section>
        <SectionHeading
          title="All matters"
          subtitle="Submitted matters can be screened; screened matters can receive a recorded decision."
        />
        {matters.length === 0 ? (
          <EmptyState title="No matters raised" body="Raise the first matter for Senate consideration above." />
        ) : (
          <Table headers={["Reference", "Matter", "Category", "Submitted by", "Status", "Action"]}>
            {matters.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate/60">{m.reference}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{m.title}</p>
                  <p className="max-w-md truncate text-xs text-slate/75">{m.summary}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={CATEGORY_TONES[m.category] ?? "neutral"}>
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate/70">{m.submittedBy.fullName}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={m.status} />
                  <p className="mt-1 text-xs text-slate/60">
                    {MATTER_STATUS_LABELS[m.status] ?? m.status}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <MatterActions id={m.id} status={m.status} reference={m.reference} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
