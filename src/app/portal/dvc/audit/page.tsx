import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, Badge, StatCard } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { recentGovernanceActivity } from "@/lib/governance";
import { verifyChain } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Audit Trail" };

const ACTION_TONES: Record<string, "brand" | "red" | "gold" | "neutral" | "slate"> = {
  CREATE: "brand",
  UPDATE: "gold",
  APPROVE: "brand",
  LOGIN: "slate",
  LOGOUT: "slate",
  DELETE: "red",
  REVOKE: "red",
  EXPORT: "slate",
};

export default async function DvcAuditPage() {
  await requireGovernanceOversight();

  const [activity, chain] = await Promise.all([
    recentGovernanceActivity(50),
    verifyChain(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Audit Trail"
        description="Recent activity from the append-only, hash-chained audit log. The committee reads the trail to monitor behaviour; it cannot edit it."
      />

      <section aria-label="Chain integrity" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Audit chain"
          value={chain.intact ? "Intact" : "Compromised"}
          hint={chain.intact ? "Hash chain verified end-to-end" : "Chain verification FAILED — investigate"}
        />
        <StatCard label="Audit entries" value={chain.count} hint="Entries in the chain" />
      </section>

      <section>
        <SectionHeading title="Recent activity" subtitle="The latest entries across all modules." />
        {activity.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <Table headers={["Timestamp", "Action", "Module", "Actor", "Role"]}>
            {activity.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs text-slate/60">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="px-4 py-3">
                  <Badge tone={ACTION_TONES[r.action] ?? "neutral"}>{r.action}</Badge>
                </td>
                <td className="px-4 py-3 font-medium text-slate">{r.module}</td>
                <td className="px-4 py-3 text-slate/70">{r.actorUsername ?? "system"}</td>
                <td className="px-4 py-3 text-slate/70">{r.actorRole?.replaceAll("_", " ") ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
