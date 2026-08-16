import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { Card, StatusBadge, PageHeader, Table, EmptyState, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { landingForRole, UNRECONCILED_PAYMENT_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bursary Dashboard" };

const OUTSTANDING_INVOICE_STATUSES = ["OPEN", "OVERDUE", "PARTIAL"];
const FEE_MODULES = ["TUITION", "ACCEPTANCE"];

export default async function BursaryDashboard() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    openInvoices,
    pendingWaivers,
    pendingScholarships,
    todayPayments,
    pendingPaymentCount,
    unreconciledCount,
    clearedAccounts,
    awaitingClearanceGroups,
    totalCollected,
    recentActivity,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: OUTSTANDING_INVOICE_STATUSES } },
      orderBy: { dueOn: "asc" },
      take: 200,
      include: { user: true, payments: true },
    }),
    prisma.waiver.findMany({ where: { status: "PENDING" }, take: 5, include: { user: true } }),
    prisma.scholarship.findMany({ where: { status: "PENDING" }, take: 5, include: { user: true } }),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCESS", "RECONCILED"] }, createdAt: { gte: todayStart } },
      select: { amountCents: true },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: { in: [...UNRECONCILED_PAYMENT_STATUSES] } } }),
    prisma.feeAccount.count({ where: { clearanceStatus: true } }),
    prisma.invoice.groupBy({
      by: ["userId"],
      where: { status: { in: OUTSTANDING_INVOICE_STATUSES }, module: { in: FEE_MODULES } },
    }),
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: { in: ["SUCCESS", "RECONCILED"] } },
    }),
    prisma.auditLog.findMany({
      where: { module: { in: ["FEES", "GRAD_CLEARANCE"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const invoiceRemaining = (i: { amountCents: number; payments: { amountCents: number; status: string }[] }) =>
    Math.max(
      0,
      i.amountCents -
        i.payments
          .filter((p) => p.status === "SUCCESS" || p.status === "RECONCILED")
          .reduce((sum, p) => sum + p.amountCents, 0),
    );

  const todayCollections = todayPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const outstandingStudentFees = openInvoices.reduce((sum, i) => sum + invoiceRemaining(i), 0);
  const awaitingFinancialClearance = awaitingClearanceGroups.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Bursary Dashboard"
        description="Financial-management overview"
      />
      <section aria-label="Summary cards" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Today&apos;s Collections</h3>
          <p className="font-head text-2xl font-bold text-brand-strong">{todayCollections > 0 ? formatMoney(todayCollections) : "—"}</p>
          <p className="mt-1 text-xs text-slate/60">Successful + reconciled payments today</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Pending Payments</h3>
          <p className="font-head text-2xl font-bold text-amber-600">{pendingPaymentCount}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Outstanding Student Fees</h3>
          <p className="font-head text-2xl font-bold text-red-600">{outstandingStudentFees > 0 ? formatMoney(outstandingStudentFees) : "—"}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Financially Cleared Students</h3>
          <p className="font-head text-2xl font-bold text-green-600">{clearedAccounts}</p>
        </Card>
      </section>
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Awaiting Financial Clearance</h3>
          <p className="font-head text-2xl font-bold text-red-600">{awaitingFinancialClearance}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Unreconciled Transactions</h3>
          <p className="font-head text-2xl font-bold text-slate-600">{unreconciledCount}</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Total Collections</h3>
          <p className="font-head text-2xl font-bold text-brand-strong">
            {totalCollected._sum.amountCents ? formatMoney(totalCollected._sum.amountCents) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate/60">All-time successful + reconciled payments</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Pending Waivers & Scholarships</h3>
          <p className="font-head text-2xl font-bold text-slate-600">{pendingWaivers.length + pendingScholarships.length}</p>
        </Card>
      </section>
      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Outstanding Invoices</h2>
        {openInvoices.length === 0 ? (
          <EmptyState title="No outstanding invoices" body="All student financial obligations are currently settled." />
        ) : (
          <Table headers={["Student", "Module", "Description", "Remaining", "Due", "Status"]}>
            {openInvoices.slice(0, 10).map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium text-slate">{i.user?.fullName}</td>
                <td className="px-4 py-3 text-slate/70">{i.module.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate/70">{i.description}</td>
                <td className="px-4 py-3 font-medium text-slate">{formatMoney(invoiceRemaining(i))}</td>
                <td className="px-4 py-3 text-slate/70">{i.dueOn.toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Pending Waivers & Scholarships</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-head text-sm font-bold text-slate">Pending Waivers</h3>
              <Link href="/portal/bursary/waivers" className="text-sm font-medium text-brand-strong hover:underline">
                Manage
              </Link>
            </div>
            {pendingWaivers.length === 0 ? (
              <p className="text-sm text-slate/60">No pending waivers.</p>
            ) : (
              <Table headers={["Student", "Waiver", "%", "Status"]}>
                {pendingWaivers.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3 font-medium text-slate">{w.user?.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{w.title}</td>
                    <td className="px-4 py-3 text-slate/70">{w.percent}%</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
          <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-head text-sm font-bold text-slate">Pending Scholarships</h3>
              <Link href="/portal/bursary/scholarships" className="text-sm font-medium text-brand-strong hover:underline">
                Manage
              </Link>
            </div>
            {pendingScholarships.length === 0 ? (
              <p className="text-sm text-slate/60">No pending scholarships.</p>
            ) : (
              <Table headers={["Student", "Scholarship", "Amount", "Status"]}>
                {pendingScholarships.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate">{s.user?.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{s.title}</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(s.amountCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      </section>
      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Recent Financial Activity</h2>
        {recentActivity.length === 0 ? (
          <EmptyState title="No recent activity" />
        ) : (
          <Table headers={["Date", "Actor", "Action", "Target", "Status"]}>
            {recentActivity.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-slate/70">{a.createdAt.toLocaleString("en-GB")}</td>
                <td className="px-4 py-3 text-slate">{a.actorUsername}</td>
                <td className="px-4 py-3 font-medium text-slate">{a.action}</td>
                <td className="px-4 py-3 text-slate/70">
                  {a.targetType}
                  {a.targetId ? <span className="ml-1 font-mono text-xs text-slate/60">#{a.targetId.slice(-6)}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={a.action === "RECONCILE" ? "brand" : "slate"}>{a.module}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
