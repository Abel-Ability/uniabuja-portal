import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, Table, EmptyState, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { landingForRole, PAYMENT_CHANNEL_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Financial Reports" };

const OUTSTANDING_INVOICE_STATUSES = ["OPEN", "OVERDUE", "PARTIAL"];

const invoiceRemaining = (i: {
  amountCents: number;
  payments: { amountCents: number; status: string }[];
}) =>
  Math.max(
    0,
    i.amountCents -
      i.payments
        .filter((p) => p.status === "SUCCESS" || p.status === "RECONCILED")
        .reduce((sum, p) => sum + p.amountCents, 0),
  );

export default async function ReportsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [revenueByModule, openInvoices, waivers, scholarships, clearedCount, channelTotals] = await Promise.all([
    prisma.payment.groupBy({
      by: ["module"],
      where: { status: { in: ["SUCCESS", "RECONCILED"] } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: OUTSTANDING_INVOICE_STATUSES } },
      orderBy: { dueOn: "asc" },
      take: 200,
      include: { user: true, payments: true },
    }),
    prisma.waiver.findMany({ include: { user: true, invoice: true }, take: 100, orderBy: { createdAt: "desc" } }),
    prisma.scholarship.findMany({ include: { user: true }, take: 100, orderBy: { createdAt: "desc" } }),
    prisma.feeAccount.count({ where: { clearanceStatus: true } }),
    prisma.payment.groupBy({
      by: ["channel"],
      where: { status: { in: ["SUCCESS", "RECONCILED"] } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
  ]);

  const totalRevenue = revenueByModule.reduce((sum, r) => sum + (r._sum.amountCents ?? 0), 0);
  const totalOutstanding = openInvoices.reduce((sum, i) => sum + invoiceRemaining(i), 0);

  const byModuleRemaining = new Map<string, { remaining: number; count: number }>();
  for (const i of openInvoices) {
    const entry = byModuleRemaining.get(i.module) ?? { remaining: 0, count: 0 };
    entry.remaining += invoiceRemaining(i);
    entry.count += 1;
    byModuleRemaining.set(i.module, entry);
  }

  const debtors = new Map<string, { remaining: number; name: string; registrationNo: string | null }>();
  for (const i of openInvoices) {
    const remaining = invoiceRemaining(i);
    if (remaining <= 0) continue;
    const entry = debtors.get(i.userId) ?? {
      remaining: 0,
      name: i.user?.fullName ?? "Unknown",
      registrationNo: i.user?.registrationNo ?? null,
    };
    entry.remaining += remaining;
    debtors.set(i.userId, entry);
  }
  const topDebtors = [...debtors.values()].sort((a, b) => b.remaining - a.remaining).slice(0, 10);

  const approvedWaivers = waivers.filter((w) => w.status === "APPROVED");
  const approvedScholarships = scholarships.filter((s) => s.status === "APPROVED");
  const scholarshipValue = approvedScholarships.reduce((sum, s) => sum + s.amountCents, 0);
  const waivedValue = approvedWaivers.reduce((sum, w) => {
    if (w.invoiceId) return sum + (w.invoice ? Math.round((w.invoice.amountCents * w.percent) / 100) : 0);
    return sum;
  }, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Financial Reports"
        description="Revenue, outstanding balances, concessions and clearance summaries"
      />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Total Collected</h3>
          <p className="font-head text-2xl font-bold text-brand-strong">{totalRevenue > 0 ? formatMoney(totalRevenue) : "—"}</p>
          <p className="mt-1 text-xs text-slate/60">All-time successful + reconciled payments</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Outstanding</h3>
          <p className="font-head text-2xl font-bold text-red-600">{totalOutstanding > 0 ? formatMoney(totalOutstanding) : "—"}</p>
          <p className="mt-1 text-xs text-slate/60">Remaining balances on open invoices</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Waivers Approved</h3>
          <p className="font-head text-2xl font-bold text-slate">{approvedWaivers.length}</p>
          <p className="mt-1 text-xs text-slate/60">≈ {waivedValue > 0 ? formatMoney(waivedValue) : "₦0"} in concessions</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Scholarships Approved</h3>
          <p className="font-head text-2xl font-bold text-slate">{approvedScholarships.length}</p>
          <p className="mt-1 text-xs text-slate/60">≈ {scholarshipValue > 0 ? formatMoney(scholarshipValue) : "₦0"} awarded</p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Revenue by Module</h2>
          {revenueByModule.length === 0 ? (
            <EmptyState title="No collections yet" />
          ) : (
            <Table headers={["Module", "Payments", "Amount"]}>
              {revenueByModule.map((row) => (
                <tr key={row.module}>
                  <td className="px-4 py-3 text-slate/70">{row.module.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate/70">{row._count._all}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(Number(row._sum.amountCents ?? 0))}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Outstanding by Module</h2>
          {byModuleRemaining.size === 0 ? (
            <EmptyState title="No outstanding balances" />
          ) : (
            <Table headers={["Module", "Open Invoices", "Remaining"]}>
              {[...byModuleRemaining.entries()].map(([module, { remaining, count }]) => (
                <tr key={module}>
                  <td className="px-4 py-3 text-slate/70">{module.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate/70">{count}</td>
                  <td className="px-4 py-3 font-medium text-slate">{remaining > 0 ? formatMoney(remaining) : "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Top Debtors</h2>
          {topDebtors.length === 0 ? (
            <EmptyState title="No outstanding balances" />
          ) : (
            <Table headers={["Student", "Reg No", "Outstanding"]}>
              {topDebtors.map((d) => (
                <tr key={d.registrationNo ?? d.name}>
                  <td className="px-4 py-3 font-medium text-slate">{d.name}</td>
                  <td className="px-4 py-3 text-slate/70">{d.registrationNo ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(d.remaining)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Collections by Channel</h2>
          {channelTotals.length === 0 ? (
            <EmptyState title="No collections yet" />
          ) : (
            <Table headers={["Channel", "Payments", "Amount"]}>
              {channelTotals.map((row) => (
                <tr key={row.channel}>
                  <td className="px-4 py-3 text-slate/70">{PAYMENT_CHANNEL_LABELS[row.channel] ?? row.channel}</td>
                  <td className="px-4 py-3 text-slate/70">{row._count._all}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(Number(row._sum.amountCents ?? 0))}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Clearance Summary</h2>
        <p className="text-slate/70">
          <Badge tone="brand">{clearedCount}</Badge> students currently have fee clearance granted. Students with open
          tuition/acceptance invoices are not fee-cleared and cannot complete course registration.
        </p>
        <p className="mt-2 text-slate/70">
          Recent Bursary activity is visible on the <Link href="/portal/bursary/audit" className="text-brand-strong hover:underline">Audit / Activity</Link> page.
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Report limitations</h2>
        <ul className="list-disc space-y-1 pl-6 text-sm text-slate/70">
          <li>Invoices and payments carry no academic-session field, so revenue/outstanding cannot be attributed to a session — figures are all-time.</li>
          <li>There is no separate Fee/Charge model; obligations are modelled as invoices (tuition, acceptance, hostel, etc.).</li>
          <li>There is no Refund/Credit model, so refunds and credit notes cannot be reported.</li>
          <li>Scholarships have no invoice link, so approved awards are reported as amounts awarded, not as balance reductions.</li>
          <li>FeeAccount.clearanceStatus is a boolean; there is no historical record of when clearance was granted or revoked.</li>
        </ul>
      </section>
    </div>
  );
}
