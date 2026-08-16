import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { landingForRole, INVOICE_MODULES, INVOICE_MODULE_LABELS, INVOICE_STATUSES } from "@/lib/constants";
import { IssueInvoiceForm } from "@/app/portal/bursary/issue-invoice-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Invoices" };

type SearchParams = Promise<{ status?: string }>;

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

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const params = await searchParams;
  const statusFilter = params.status ?? "ALL";

  const invoices = await prisma.invoice.findMany({
    where: statusFilter === "ALL" ? {} : { status: statusFilter },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, payments: true },
  });

  const byStatus = await prisma.invoice.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amountCents: true },
  });

  const moduleOptions = INVOICE_MODULES.map((m) => ({ value: m, label: INVOICE_MODULE_LABELS[m] ?? m }));

  const filters = ["ALL", ...INVOICE_STATUSES];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Invoices"
        description="Issue invoices and review outstanding obligations"
      />
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <Link
                key={f}
                href={`/portal/bursary/invoices?status=${f}`}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  statusFilter === f
                    ? "bg-brand-strong text-white"
                    : "bg-slate/5 text-slate/80 hover:bg-slate/10"
                }`}
              >
                {f === "ALL" ? "All" : f.replaceAll("_", " ")}
              </Link>
            ))}
          </div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" body="No invoices match this filter." />
          ) : (
            <Table headers={["Student", "Module", "Description", "Amount", "Remaining", "Due", "Status"]}>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate">
                    <Link href={`/portal/bursary/accounts?userId=${i.userId}`} className="hover:underline">
                      {i.user?.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate/70">{i.module.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate/70">{i.description}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(i.amountCents)}</td>
                  <td className="px-4 py-3 font-medium text-slate">
                    {invoiceRemaining(i) > 0 ? formatMoney(invoiceRemaining(i)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate/70">{i.dueOn.toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <p className="mt-3 text-xs text-slate/60">Showing up to 100 invoices. Remaining = amount less successful/reconciled payments.</p>
        </div>
        <div>
          <IssueInvoiceForm moduleOptions={moduleOptions} />
          <div className="mt-4 rounded-xl border border-slate/10 bg-white p-4 dark:border-slate-200/15 dark:bg-slate-900">
            <h3 className="mb-3 font-head text-sm font-bold text-slate uppercase tracking-wider">By status</h3>
            {byStatus.length === 0 ? (
              <p className="text-sm text-slate/60">No invoices yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {byStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate/70">
                      <StatusBadge status={row.status} />
                    </span>
                    <span className="font-semibold text-slate">
                      {formatMoney(row._sum.amountCents ?? 0)}{" "}
                      <span className="font-normal text-slate/60">({row._count._all})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-slate/10 pt-3 text-xs text-slate/60">
              Issuing a TUITION/ACCEPTANCE invoice re-blocks the student&apos;s course registration until it is paid or waived.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
