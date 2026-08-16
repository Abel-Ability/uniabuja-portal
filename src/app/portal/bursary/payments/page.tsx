import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { landingForRole, PAYMENT_STATUSES, PAYMENT_CHANNEL_LABELS } from "@/lib/constants";
import { ReconcilePaymentButton } from "@/app/portal/bursary/reconcile-payment-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payments" };

type SearchParams = Promise<{ status?: string }>;

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const params = await searchParams;
  const statusFilter = params.status ?? "ALL";

  const [payments, byStatus, totalSum] = await Promise.all([
    prisma.payment.findMany({
      where: statusFilter === "ALL" ? {} : { status: statusFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: true, invoice: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({ _sum: { amountCents: true } }),
  ]);

  const filters = ["ALL", ...PAYMENT_STATUSES];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Payments"
        description="Payment transactions, receipts and reconciliation status"
      />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Total Volume</h3>
          <p className="font-head text-2xl font-bold text-slate">{totalSum._sum.amountCents ? formatMoney(totalSum._sum.amountCents) : "—"}</p>
          <p className="mt-1 text-xs text-slate/60">All payments, all channels</p>
        </Card>
        {PAYMENT_STATUSES.map((s) => {
          const row = byStatus.find((r) => r.status === s);
          return (
            <Card key={s} className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
              <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">
                <StatusBadge status={s} />
              </h3>
              <p className="font-head text-2xl font-bold text-slate">{row?._count._all ?? 0}</p>
              <p className="mt-1 text-xs text-slate/60">{row?._sum.amountCents ? formatMoney(row._sum.amountCents) : "₦0"}</p>
            </Card>
          );
        })}
      </section>
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <Link
              key={f}
              href={`/portal/bursary/payments?status=${f}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                statusFilter === f ? "bg-brand-strong text-white" : "bg-slate/5 text-slate/80 hover:bg-slate/10"
              }`}
            >
              {f === "ALL" ? "All" : f.replaceAll("_", " ")}
            </Link>
          ))}
        </div>
        {payments.length === 0 ? (
          <EmptyState title="No payments" body="No payments match this filter." />
        ) : (
          <Table headers={["Reference", "Student", "Module", "Amount", "Channel", "TSA", "Status", "Date", "Reconcile"]}>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate">{p.reference}</td>
                <td className="px-4 py-3 text-slate">
                  {p.user ? (
                    <Link href={`/portal/bursary/accounts?userId=${p.userId}`} className="hover:underline">
                      {p.user.fullName}
                    </Link>
                  ) : (
                    p.userId
                  )}
                </td>
                <td className="px-4 py-3 text-slate/70">{p.module.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountCents)}</td>
                <td className="px-4 py-3 text-slate/70">{PAYMENT_CHANNEL_LABELS[p.channel] ?? p.channel.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate/70">{p.tsaSwept ? "Swept" : "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-slate/70">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  {p.status === "SUCCESS" ? <ReconcilePaymentButton paymentId={p.id} /> : null}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate/60">
          Manual reconciliation only accepts SUCCESS payments and records before/after state in the audit trail.
        </p>
      </section>
    </div>
  );
}
