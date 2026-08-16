import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { recentGovernanceActivity } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Audit & Institutional Activity" };

export default async function VcAuditPage() {
  await requireVC();

  const activity = await recentGovernanceActivity(100);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Audit & Institutional Activity"
        description="Verified activity log for the institution"
      />

      <section>
        <SectionHeading title="Recent Activity" subtitle="Verified institutional activity" />
        {activity.length === 0 ? (
          <EmptyState title="No recent activity" body="No verified activity has occurred yet." />
        ) : (
          <Table headers={["Timestamp", "Action", "Module", "Target", "Actor", "Role"]}>
            {activity.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">{a.createdAt.toLocaleString("en-NG")}</td>
                <td className="px-4 py-3">{a.action}</td>
                <td className="px-4 py-3">{a.module}</td>
                <td className="px-4 py-3">{a.targetType ?? "—"}</td>
                <td className="px-4 py-3">{a.actorUsername ?? "—"}</td>
                <td className="px-4 py-3">{a.actorRole ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
