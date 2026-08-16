import type { Metadata } from "next";
import { PageHeader, Card, Badge, Table, EmptyState, SectionHeading } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireGovernanceOversight } from "../guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Communications" };

const CATEGORY_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  NEWS: "brand",
  NOTICE: "slate",
  DEADLINE: "gold",
  ADMISSION: "amber",
  GENERAL: "neutral",
};

const SCOPE_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  PUBLIC: "neutral",
  STUDENT: "brand",
  STAFF: "slate",
  ROLE: "gold",
};

const fmt = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function DvcCommunicationsPage() {
  await requireGovernanceOversight();

  const [announcements, notifications] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 50 }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Communications"
        description="University-wide announcements and the notification send log — monitored read-only. Publishing announcements is outside this workspace."
      />

      <section>
        <SectionHeading title="Announcements" subtitle="Public and staff-facing announcements." />
        {announcements.length === 0 ? (
          <Card><EmptyState title="No announcements yet" /></Card>
        ) : (
          <Table headers={["Title", "Category", "Scope", "Published"]}>
            {announcements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{a.title}</p>
                  <p className="max-w-md truncate text-xs text-slate/75">{a.body}</p>
                </td>
                <td className="px-4 py-3"><Badge tone={CATEGORY_TONES[a.category] ?? "neutral"}>{a.category}</Badge></td>
                <td className="px-4 py-3"><Badge tone={SCOPE_TONES[a.scope] ?? "neutral"}>{a.scope}</Badge></td>
                <td className="px-4 py-3 text-slate/70">{fmt(a.publishedAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Notification send log" subtitle="Latest notifications dispatched across in-app, email and SMS channels." />
        {notifications.length === 0 ? (
          <Card><EmptyState title="No notifications sent yet" /></Card>
        ) : (
          <Table headers={["Recipient", "Channel", "Subject", "Status", "Sent"]}>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-3 font-medium text-slate">{n.user.fullName}</td>
                <td className="px-4 py-3"><Badge tone="neutral">{n.channel}</Badge></td>
                <td className="px-4 py-3 text-slate/70">{n.subject}</td>
                <td className="px-4 py-3 text-slate/70">{n.status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate/70">{fmt(n.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
