import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, StatusBadge, Table } from "@/components/ui";
import { TicketForm } from "./ticket-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Helpdesk" };

export default async function HelpdeskPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const tickets = await prisma.helpTicket.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Helpdesk"
        description="Raise a ticket, or review the status of your existing requests. Urgent issues are triaged first."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Raise a ticket</h2>
          <Card>
            <TicketForm />
          </Card>
        </section>
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Your tickets</h2>
          {tickets.length === 0 ? (
            <Card>
              <p className="text-sm text-slate/75">No tickets yet.</p>
            </Card>
          ) : (
            <Table headers={["Subject", "Priority", "Status", "Opened"]}>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-slate">{t.subject}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.priority === "NORMAL" ? "REVIEW" : t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-slate/70">
                    {t.createdAt.toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
