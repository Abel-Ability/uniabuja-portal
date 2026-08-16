import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, Table, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { landingForRole, PAYMENT_CHANNEL_LABELS, UNRECONCILED_PAYMENT_STATUSES } from "@/lib/constants";
import { ReconcilePaymentButton } from "@/app/portal/bursary/reconcile-payment-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [unreconciled, totalCount, reconciledCount, failedPayments, channelSettlement, duplicateReferences] =
    await Promise.all([
      prisma.payment.findMany({
        where: { status: { in: [...UNRECONCILED_PAYMENT_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: true },
      }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "RECONCILED" } }),
      prisma.payment.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      }),
      prisma.payment.groupBy({
        by: ["channel"],
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      prisma.payment.groupBy({
        by: ["reference"],
        _count: { _all: true },
        having: { reference: { _count: { gt: 1 } } },
      }),
    ]);

  const reconciledSum = await prisma.payment.aggregate({
    _sum: { amountCents: true },
    where: { status: "RECONCILED" },
  });

  const duplicateRows = await prisma.payment.findMany({
    where: { reference: { in: duplicateReferences.map((r) => r.reference) } },
    orderBy: { reference: "asc" },
    include: { user: true },
    take: 100,
  });

  const pendingCount = unreconciled.filter((p) => p.status === "PENDING").length;
  const successCount = unreconciled.filter((p) => p.status === "SUCCESS").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Reconciliation"
        description="Match successful payments against the TSA sweep and review exceptions"
      />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Total Payments</h3>
          <p className="font-head text-2xl font-bold text-slate">{totalCount}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Reconciled</h3>
          <p className="font-head text-2xl font-bold text-green-600">{reconciledCount}</p>
          <p className="mt-1 text-xs text-slate/60">{reconciledSum._sum.amountCents ? formatMoney(reconciledSum._sum.amountCents) : "₦0"}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Awaiting Reconciliation</h3>
          <p className="font-head text-2xl font-bold text-amber-600">{unreconciled.length}</p>
          <p className="mt-1 text-xs text-slate/60">{pendingCount} pending · {successCount} successful</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Failed</h3>
          <p className="font-head text-2xl font-bold text-red-600">{failedPayments.length}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Unreconciled Transactions</h2>
        {unreconciled.length === 0 ? (
          <EmptyState title="No unreconciled transactions" body="All payments are reconciled." />
        ) : (
          <Table headers={["Reference", "Student", "Module", "Amount", "Channel", "Status", "Date", "Reconcile"]}>
            {unreconciled.map((p) => (
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
                <td className="px-4 py-3 text-slate/70">{PAYMENT_CHANNEL_LABELS[p.channel] ?? p.channel}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-slate/70">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3">{p.status === "SUCCESS" ? <ReconcilePaymentButton paymentId={p.id} /> : null}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Payment-Channel Settlement</h2>
        {channelSettlement.length === 0 ? (
          <EmptyState title="No payment data" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {channelSettlement.map((row) => (
              <Card key={row.channel} className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
                <h3 className="font-head text-sm font-bold text-slate">{PAYMENT_CHANNEL_LABELS[row.channel] ?? row.channel}</h3>
                <p className="font-head text-xl font-bold">{formatMoney(Number(row._sum.amountCents ?? 0))}</p>
                <p className="text-slate/60">{row._count._all} transactions</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Exceptions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
            <h3 className="mb-3 flex items-center gap-2 font-head text-sm font-bold text-slate">
              Failed Payments
              <Badge tone="red">{failedPayments.length}</Badge>
            </h3>
            {failedPayments.length === 0 ? (
              <p className="text-sm text-slate/60">No failed payments.</p>
            ) : (
              <Table headers={["Reference", "Student", "Amount", "Date"]}>
                {failedPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate">{p.reference}</td>
                    <td className="px-4 py-3 text-slate">{p.user?.fullName ?? p.userId}</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountCents)}</td>
                    <td className="px-4 py-3 text-slate/70">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
          <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
            <h3 className="mb-3 flex items-center gap-2 font-head text-sm font-bold text-slate">
              Duplicate References
              <Badge tone="amber">{duplicateReferences.length}</Badge>
            </h3>
            {duplicateRows.length === 0 ? (
              <p className="text-sm text-slate/60">No duplicate references detected.</p>
            ) : (
              <Table headers={["Reference", "Student", "Amount", "Status"]}>
                {duplicateRows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate">{p.reference}</td>
                    <td className="px-4 py-3 text-slate">{p.user?.fullName ?? p.userId}</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate/60">
          Reconciliation confirms a gateway payment against the TSA sweep. Only SUCCESS payments can be reconciled; the
          original reference is preserved and every reconciliation is written to the hash-chained audit trail.
        </p>
      </section>
    </div>
  );
}
