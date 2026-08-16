import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, EmptyState, SectionHeading, Badge, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { landingForRole } from "@/lib/constants";
import { verifyChain } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Audit / Activity" };

const ACTION_TONES: Record<string, "brand" | "red" | "gold" | "neutral" | "slate"> = {
  CREATE: "brand",
  UPDATE: "gold",
  APPROVE: "brand",
  RECONCILE: "brand",
  PAY: "brand",
  DELETE: "red",
  REVOKE: "red",
  EXPORT: "slate",
  LOGIN: "slate",
  LOGOUT: "slate",
};

export default async function BursaryAuditPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [activity, chain] = await Promise.all([
    prisma.auditLog.findMany({
      where: { module: { in: ["FEES", "GRAD_CLEARANCE"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    verifyChain(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Audit / Activity"
        description="Bursary activity from the append-only, hash-chained audit log"
      />
      <section aria-label="Chain integrity" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Audit chain"
          value={chain.intact ? "Intact" : "Compromised"}
          hint={chain.intact ? "Hash chain verified end-to-end" : "Chain verification FAILED — investigate"}
        />
        <StatCard label="Audit entries" value={chain.count} hint="Entries in the whole chain" />
      </section>
      <section>
        <SectionHeading
          title="Recent Bursary activity"
          subtitle="The latest FEES and GRAD_CLEARANCE entries. The bursary cannot edit this trail."
        />
        {activity.length === 0 ? (
          <EmptyState title="No Bursary activity yet" />
        ) : (
          <Table headers={["Timestamp", "Action", "Module", "Target", "Actor", "Role", "Before → After"]}>
            {activity.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs text-slate/60">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={ACTION_TONES[r.action] ?? "neutral"}>{r.action}</Badge>
                </td>
                <td className="px-4 py-3 font-medium text-slate">{r.module}</td>
                <td className="px-4 py-3 text-slate/70">
                  {r.targetType}
                  {r.targetId ? <span className="ml-1 font-mono text-xs text-slate/60">#{r.targetId.slice(-6)}</span> : null}
                </td>
                <td className="px-4 py-3 text-slate/70">{r.actorUsername ?? "system"}</td>
                <td className="px-4 py-3 text-slate/70">{r.actorRole?.replaceAll("_", " ") ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate/60">
                  {r.before ? JSON.stringify(r.before) : "—"} → {r.after ? JSON.stringify(r.after) : "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
