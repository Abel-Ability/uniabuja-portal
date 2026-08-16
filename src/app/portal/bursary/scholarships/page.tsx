import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { landingForRole } from "@/lib/constants";
import { ScholarshipDecisionButtons } from "@/app/portal/bursary/scholarship-decision-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Scholarships" };

export default async function ScholarshipsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const scholarships = await prisma.scholarship.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, approvedBy: true },
  });

  const pendingCount = scholarships.filter((s) => s.status === "PENDING").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Scholarships"
        description="Approve or reject scholarship awards"
      />
      <p className="text-sm text-slate/60">
        Approving or rejecting a scholarship records the Bursary decision and is written to the audit trail. The current
        schema has no scholarship-to-invoice link, so approved amounts are not automatically applied to an invoice
        balance.
      </p>
      {scholarships.length === 0 ? (
        <EmptyState title="No scholarships" body="There are no scholarship awards yet." />
      ) : (
        <Table headers={["Student", "Scholarship", "Amount", "Status", "Decided by", "Date", "Decision"]}>
          {scholarships.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3 font-medium text-slate">
                <Link href={`/portal/bursary/accounts?userId=${s.userId}`} className="hover:underline">
                  {s.user?.fullName}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate/70">{s.title}</td>
              <td className="px-4 py-3 font-medium text-slate">{formatMoney(s.amountCents)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-4 py-3 text-slate/70">{s.approvedBy?.fullName ?? "—"}</td>
              <td className="px-4 py-3 text-slate/70">{formatDate(s.createdAt)}</td>
              <td className="px-4 py-3">{s.status === "PENDING" ? <ScholarshipDecisionButtons scholarshipId={s.id} /> : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-sm text-slate/60">
        {pendingCount} pending scholarship award(s) awaiting a Bursary decision.
      </p>
    </div>
  );
}
