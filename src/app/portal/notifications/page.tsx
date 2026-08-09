import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        description="In-app, email and SMS messages sent to you by the portal."
      />
      <div className="mx-auto max-w-4xl space-y-4 px-4 sm:px-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate/75">
            {notifications.filter((n) => !n.readAt).length} unread
          </p>
          {notifications.some((n) => !n.readAt) ? (
            <form action={markAllRead}>
              <button
                type="submit"
                className="text-sm font-semibold text-brand hover:underline"
              >
                Mark all as read
              </button>
            </form>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <Card>
            <p className="text-sm text-slate/75">No notifications yet.</p>
          </Card>
        ) : (
          notifications.map((n) => (
            <Card key={n.id} className={n.readAt ? "opacity-70" : ""}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={n.channel === "EMAIL" ? "slate" : "brand"}>{n.channel}</Badge>
                <span className="text-xs text-slate/70">
                  {n.createdAt.toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <h3 className="mt-2 font-head font-semibold text-slate">{n.subject}</h3>
              <p className="mt-1 text-sm text-slate/70">{n.body}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
