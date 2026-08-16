import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { landingForRole } from "@/lib/constants";
import { WaiverDecisionButtons } from "@/app/portal/bursary/waiver-decision-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Waivers" };

export default async function WaiversPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const waivers = await prisma.waiver.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, invoice: true, approvedBy: true },
  });

  const pendingCount = waivers.filter((w) => w.status === "PENDING").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Waivers"
        description="Approve or reject fee waiver requests"
      />
      <p className="text-sm text-slate/60">
        Approving a waiver linked to an invoice applies the concession: 100% marks the invoice WAIVED (and grants fee
        clearance); a partial percentage reduces the invoice amount and marks it PARTIAL. Every decision is audited.
      </p>
      {waivers.length === 0 ? (
        <EmptyState title="No waivers" body="There are no waiver requests yet." />
      ) : (
        <Table headers={["Student", "Waiver", "%", "Invoice", "Status", "Decided by", "Date", "Decision"]}>
          {waivers.map((w) => (
            <tr key={w.id}>
              <td className="px-4 py-3 font-medium text-slate">
                <Link href={`/portal/bursary/accounts?userId=${w.userId}`} className="hover:underline">
                  {w.user?.fullName}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate/70">{w.title}</td>
              <td className="px-4 py-3 text-slate/70">{w.percent}%</td>
              <td className="px-4 py-3 text-slate/70">
                {w.invoice ? (
                  <>
                    {w.invoice.module.replaceAll("_", " ")} · {formatMoney(w.invoice.amountCents)} ·{" "}
                    <StatusBadge status={w.invoice.status} />
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={w.status} />
              </td>
              <td className="px-4 py-3 text-slate/70">{w.approvedBy?.fullName ?? "—"}</td>
              <td className="px-4 py-3 text-slate/70">{formatDate(w.createdAt)}</td>
              <td className="px-4 py-3">{w.status === "PENDING" ? <WaiverDecisionButtons waiverId={w.id} /> : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-sm text-slate/60">
        {pendingCount} pending waiver request(s) awaiting a Bursary decision.
      </p>
    </div>
  );
}
