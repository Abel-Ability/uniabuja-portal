import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Communications" };

export default async function CommunicationsPage() {
  const session = await getCurrentSession();
  if (!session) return null;
  const { user } = session;

  if (user.role !== "BURSARY") return null;

  const [
    feeNotices,
    paymentReminders,
    financialAnnouncements,
  ] = await Promise.all([
    prisma.announcement.findMany({
      where: { category: "NOTICE" },
      take: 6,
      orderBy: { publishedAt: "desc" },
    }),
    prisma.announcement.findMany({
      where: { category: "DEADLINE" },
      take: 6,
      orderBy: { publishedAt: "desc" },
    }),
    prisma.announcement.findMany({
      where: { category: "GENERAL" },
      take: 6,
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Communications"
        description="Fee notices, payment reminders, financial announcements and templates"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Fee Notices</h2>
          {feeNotices.length === 0 ? (
            <EmptyState title="No fee notices" />
          ) : (
            <Table headers={["Notice", "Notice Type", "Date", "Status"]}>
              {feeNotices.map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-3 text-slate">{n.title}</td>
                  <td className="px-4 py-3 text-slate/70">Fee Notice</td>
                  <td className="px-4 py-3 text-slate/70">{formatDate(n.publishedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status="SENT" /></td>
                </tr>
              ))}
            </Table>
          )}
        </section>
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Payment Reminders</h2>
          {paymentReminders.length === 0 ? (
            <EmptyState title="No payment reminders" />
          ) : (
            <Table headers={["Reminder", "Reminder Type", "Date", "Status"]}>
              {paymentReminders.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate">{r.title}</td>
                  <td className="px-4 py-3 text-slate/70">Payment Reminder</td>
                  <td className="px-4 py-3 text-slate/70">{formatDate(r.publishedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status="SENT" /></td>
                </tr>
              ))}
            </Table>
          )}
        </section>
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Financial Announcements</h2>
          {financialAnnouncements.length === 0 ? (
            <EmptyState title="No financial announcements" />
          ) : (
            <Table headers={["Announcement", "Type", "Date", "Status"]}>
              {financialAnnouncements.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-slate">{a.title}</td>
                  <td className="px-4 py-3 text-slate/70">Financial Announcement</td>
                  <td className="px-4 py-3 text-slate/70">{formatDate(a.publishedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status="SENT" /></td>
                </tr>
              ))}
            </Table>
          )}
        </section>
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Create Template</h2>
          <p className="text-slate/60">
            Communication templates are available for fee notices, payment reminders, and financial announcements. Contact the communications office to create new templates or modify existing ones.
          </p>
        </section>
      </div>
    </div>
  );
}