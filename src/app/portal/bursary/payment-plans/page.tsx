import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { landingForRole, PAYMENT_PLAN_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payment Plans" };

export default async function PaymentPlansPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [plans, byStatus] = await Promise.all([
    prisma.paymentPlan.findMany({
      orderBy: { id: "asc" },
      take: 100,
      include: { user: true, invoice: true },
    }),
    prisma.paymentPlan.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountPerInstallmentCents: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Payment Plans"
        description="Installment plans attached to student invoices"
      />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {byStatus.map((row) => (
          <Card key={row.status} className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
            <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">
              <StatusBadge status={row.status} />
            </h3>
            <p className="font-head text-2xl font-bold text-slate">{row._count._all}</p>
            <p className="mt-1 text-xs text-slate/60">
              {formatMoney(Number(row._sum.amountPerInstallmentCents ?? 0))} per installment (total of all plans)
            </p>
          </Card>
        ))}
      </section>
      {plans.length === 0 ? (
        <EmptyState title="No payment plans" body="There are no installment plans yet." />
      ) : (
        <Table headers={["Student", "Invoice", "Installments", "Per Installment", "Interval (days)", "Status"]}>
          {plans.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium text-slate">
                <Link href={`/portal/bursary/accounts?userId=${p.userId}`} className="hover:underline">
                  {p.user?.fullName}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate/70">
                {p.invoice.module.replaceAll("_", " ")} · {formatMoney(p.invoice.amountCents)} ·{" "}
                <StatusBadge status={p.invoice.status} />
              </td>
              <td className="px-4 py-3 text-slate/70">{p.installments}</td>
              <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountPerInstallmentCents)}</td>
              <td className="px-4 py-3 text-slate/70">{p.intervalDays}</td>
              <td className="px-4 py-3">
                <StatusBadge status={PAYMENT_PLAN_STATUS_LABELS[p.status] ?? p.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-sm text-slate/60">
        Payment plans are view-only in this milestone. Plan creation and installment scheduling remain student-side
        responsibilities; no schema change was made.
      </p>
    </div>
  );
}
