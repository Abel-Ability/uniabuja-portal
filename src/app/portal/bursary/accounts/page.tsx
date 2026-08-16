import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState, Input, Card, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { landingForRole, PAYMENT_PLAN_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Student Accounts" };

const OUTSTANDING_INVOICE_STATUSES = ["OPEN", "OVERDUE", "PARTIAL"];

type SearchParams = Promise<{ q?: string; userId?: string }>;

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

export default async function StudentAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const selectedUserId = (params.userId ?? "").trim();

  if (selectedUserId) {
    const student = await prisma.user.findUnique({
      where: { id: selectedUserId },
      include: {
        programme: true,
        feeAccount: true,
        invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
        waiversAwarded: { include: { approvedBy: true }, orderBy: { createdAt: "desc" } },
        scholarshipsAwarded: { include: { approvedBy: true }, orderBy: { createdAt: "desc" } },
        paymentPlans: { include: { invoice: true } },
      },
    });
    if (!student || student.role !== "STUDENT") {
      return (
        <div className="space-y-8">
          <PageHeader eyebrow="Bursary" title="Student Accounts" description="Financial view of a student account" />
          <EmptyState title="Student not found" body="The selected student could not be found." />
        </div>
      );
    }

    const openInvoices = student.invoices.filter((i) => OUTSTANDING_INVOICE_STATUSES.includes(i.status));
    const outstandingTotal = openInvoices.reduce((sum, i) => sum + invoiceRemaining(i), 0);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Bursary"
          title={`Account — ${student.fullName}`}
          description={`${student.registrationNo ?? "No registration no."} · ${student.programme?.name ?? "No programme"}`}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <p className="mb-6">
            <Link href="/portal/bursary/accounts" className="text-sm font-medium text-brand-strong hover:underline">
              ← Back to all accounts
            </Link>
          </p>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
              <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Outstanding Balance</h3>
              <p className="font-head text-2xl font-bold text-red-600">{outstandingTotal > 0 ? formatMoney(outstandingTotal) : "—"}</p>
              <p className="mt-1 text-xs text-slate/60">{openInvoices.length} open invoice(s)</p>
            </Card>
            <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
              <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Fee Account Balance</h3>
              <p className="font-head text-2xl font-bold text-brand-strong">
                {student.feeAccount ? formatMoney(student.feeAccount.balanceCents) : "—"}
              </p>
            </Card>
            <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
              <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Fee Clearance</h3>
              <p className="mt-2">
                {student.feeAccount?.clearanceStatus ? (
                  <Badge tone="brand">Cleared</Badge>
                ) : (
                  <Badge tone="amber">Not cleared</Badge>
                )}
              </p>
            </Card>
          </section>
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Invoices</h2>
            {student.invoices.length === 0 ? (
              <EmptyState title="No invoices" body="This student has no invoices." />
            ) : (
              <Table headers={["Module", "Description", "Amount", "Paid", "Remaining", "Due", "Status"]}>
                {student.invoices.map((i) => {
                  const paid = i.payments
                    .filter((p) => p.status === "SUCCESS" || p.status === "RECONCILED")
                    .reduce((sum, p) => sum + p.amountCents, 0);
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3 text-slate/70">{i.module.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3 text-slate/70">{i.description}</td>
                      <td className="px-4 py-3 font-medium text-slate">{formatMoney(i.amountCents)}</td>
                      <td className="px-4 py-3 text-slate/70">{paid > 0 ? formatMoney(paid) : "—"}</td>
                      <td className="px-4 py-3 font-medium text-slate">{invoiceRemaining(i) > 0 ? formatMoney(invoiceRemaining(i)) : "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{i.dueOn.toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            <div>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Waivers</h2>
              {student.waiversAwarded.length === 0 ? (
                <p className="text-sm text-slate/60">None.</p>
              ) : (
                <Table headers={["Waiver", "%", "Status"]}>
                  {student.waiversAwarded.map((w) => (
                    <tr key={w.id}>
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
            <div>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Scholarships</h2>
              {student.scholarshipsAwarded.length === 0 ? (
                <p className="text-sm text-slate/60">None.</p>
              ) : (
                <Table headers={["Scholarship", "Amount", "Status"]}>
                  {student.scholarshipsAwarded.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-slate/70">{s.title}</td>
                      <td className="px-4 py-3 text-slate/70">{formatMoney(s.amountCents)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
            <div>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Payment Plans</h2>
              {student.paymentPlans.length === 0 ? (
                <p className="text-sm text-slate/60">None.</p>
              ) : (
                <Table headers={["Installments", "Per Installment", "Status"]}>
                  {student.paymentPlans.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate/70">{p.installments}</td>
                      <td className="px-4 py-3 text-slate/70">{formatMoney(p.amountPerInstallmentCents)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={PAYMENT_PLAN_STATUS_LABELS[p.status] ?? p.status} />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(q
        ? {
            OR: [
              { registrationNo: { contains: q, mode: "insensitive" as const } },
              { fullName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    take: 200,
    orderBy: { fullName: "asc" },
    include: {
      programme: true,
      feeAccount: true,
      invoices: {
        where: { status: { in: OUTSTANDING_INVOICE_STATUSES } },
        include: { payments: true },
      },
    },
  });

  const rows = students
    .map((s) => {
      const outstanding = s.invoices.reduce((sum, i) => sum + invoiceRemaining(i), 0);
      return { s, outstanding, invoiceCount: s.invoices.length };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Student Accounts"
        description="Search students and review their financial profiles"
      />
      <section>
        <form action="/portal/bursary/accounts" method="get" className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search by registration number, name or email"
              aria-label="Search students"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-brand-strong px-5 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            Search
          </button>
        </form>
        {q ? (
          <p className="mb-4 text-sm text-slate/60">
            {students.length} result(s) for &ldquo;{q}&rdquo; —{" "}
            <a href="/portal/bursary/accounts" className="text-brand-strong hover:underline">
              clear search
            </a>
          </p>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState title="No students found" body={q ? "Try a different search term." : "There are no student accounts yet."} />
        ) : (
          <Table headers={["Registration No.", "Student", "Programme", "Outstanding", "Open Invoices", "Fee Clearance"]}>
            {rows.map(({ s, outstanding, invoiceCount }) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate">{s.registrationNo}</td>
                <td className="px-4 py-3 text-slate">
                  <Link href={`/portal/bursary/accounts?userId=${s.id}`} className="hover:underline">
                    {s.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate/70">{s.programme?.name ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-slate">{outstanding > 0 ? formatMoney(outstanding) : "—"}</td>
                <td className="px-4 py-3 text-slate/70">{invoiceCount}</td>
                <td className="px-4 py-3">
                  {s.feeAccount?.clearanceStatus ? <Badge tone="brand">Cleared</Badge> : <Badge tone="amber">Not cleared</Badge>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-xs text-slate/60">Showing up to 200 students. Outstanding = sum of remaining balances on OPEN / OVERDUE / PARTIAL invoices.</p>
      </section>
    </div>
  );
}
