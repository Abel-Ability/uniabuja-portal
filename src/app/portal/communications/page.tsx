import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  SectionHeading,
  Table,
  EmptyState,
} from "@/components/ui";
import { AnnouncementForm } from "./announcement-form";
import { NotificationPreferenceForm } from "./notification-preference-form";

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

const CHANNEL_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  IN_APP: "brand",
  EMAIL: "slate",
  SMS: "gold",
};

const fmt = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function CommunicationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const canWrite = can(session.user.role, "COMMUNICATIONS", "W");
  const canView = can(session.user.role, "COMMUNICATIONS", "R");

  const [announcements, templates, notifications, preference] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 50 }),
    prisma.messageTemplate.findMany({ orderBy: { code: "asc" } }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: true },
    }),
    prisma.notificationPreference.findUnique({ where: { userId: session.userId } }),
  ]);

  const prefs = {
    allowEmail: preference?.allowEmail ?? true,
    allowSms: preference?.allowSms ?? true,
    allowInApp: preference?.allowInApp ?? true,
    allowPromotional: preference?.allowPromotional ?? false,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cross-cutting"
        title="Communications"
        description="Announcements, message templates and the notification delivery log for the portal."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {!canView ? (
          <Card>
            <EmptyState title="No access" body="Your role cannot view the communications console." />
          </Card>
        ) : (
          <>
            <section>
              <SectionHeading
                title="Announcements"
                subtitle={canWrite ? "Publish notices to students and staff." : "Read-only announcement feed."}
              />
              <div className="space-y-6">
                {canWrite ? (
                  <Card>
                    <h3 className="mb-4 font-head text-lg font-bold text-slate">Publish announcement</h3>
                    <AnnouncementForm />
                  </Card>
                ) : null}
                {announcements.length === 0 ? (
                  <Card>
                    <EmptyState title="No announcements yet" body="Published announcements appear here." />
                  </Card>
                ) : (
                  <Table headers={["Title", "Category", "Scope", "Published"]}>
                    {announcements.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate">{a.title}</p>
                          <p className="max-w-md truncate text-xs text-slate/75">{a.body}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={CATEGORY_TONES[a.category] ?? "neutral"}>{a.category}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={SCOPE_TONES[a.scope] ?? "neutral"}>{a.scope}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate/70">{fmt(a.publishedAt)}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            </section>

            <section>
              <SectionHeading title="Message templates" subtitle="Reusable templates for email and SMS campaigns." />
              {templates.length === 0 ? (
                <Card>
                  <EmptyState title="No templates" />
                </Card>
              ) : (
                <Table headers={["Code", "Subject", "Body"]}>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate/70">{t.code}</td>
                      <td className="px-4 py-3 font-medium text-slate">{t.subject}</td>
                      <td className="max-w-md px-4 py-3 text-slate/70">
                        <p className="line-clamp-2">{t.body}</p>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>

            <section>
              <SectionHeading
                title="Send log"
                subtitle="Latest notifications dispatched across in-app, email and SMS channels."
              />
              {notifications.length === 0 ? (
                <Card>
                  <EmptyState title="No notifications sent yet" />
                </Card>
              ) : (
                <Table headers={["Recipient", "Channel", "Subject", "Status", "Sent"]}>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td className="px-4 py-3 font-medium text-slate">{n.user.fullName}</td>
                      <td className="px-4 py-3">
                        <Badge tone={CHANNEL_TONES[n.channel] ?? "neutral"}>{n.channel}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate/70">{n.subject}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={n.status} />
                      </td>
                      <td className="px-4 py-3 text-slate/70">{fmt(n.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>

            <section>
              <SectionHeading
                title="Notification preference centre"
                subtitle="Choose which channels the portal may use to reach you."
              />
              <Card>
                <NotificationPreferenceForm initial={prefs} />
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
