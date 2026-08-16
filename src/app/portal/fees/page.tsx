import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import { PageHeader, Card, Table, StatCard, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { PayButton } from "@/components/module-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fees & Payments" };

function dueClass(dueOn: Date, status: string) {
  if (status === "OPEN" && dueOn.getTime() < Date.now()) return "text-red-600";
  return "";
}

export default async function FeesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  const isStudent = user.role === "STUDENT";
  const isBursary = user.role === "BURSARY";
  // Applicants hold FEES W and settle their own invoices, so they share the
  // self-service view (own account, invoices and payment buttons).
  const selfService = isStudent || user.role === "APPLICANT";
  const readOnly = can(user.role, "FEES", "R");

  // ---- self-service view (student / applicant) ----
  if (selfService) {
    const [account, invoices, payments, waivers, scholarships, plans] = await Promise.all([
      prisma.feeAccount.findUnique({ where: { userId: user.id } }),
      prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: { dueOn: "asc" },
        include: { payments: true, waiver: true },
      }),
      prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.waiver.findMany({ where: { userId: user.id } }),
      prisma.scholarship.findMany({ where: { userId: user.id } }),
      prisma.paymentPlan.findMany({ where: { userId: user.id } }),
    ]);

    const openTotal = invoices
      .filter((i) => i.status !== "PAID" && i.status !== "WAIVED")
      .reduce((a, i) => a + Math.max(0, i.amountCents - i.payments.reduce((x, p) => x + p.amountCents, 0)), 0);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 2 · Fees"
          title="Fees & Payments"
          description="Your fee account, invoices and payment history. Settle outstanding invoices through Remita."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Account balance"
              value={formatMoney(account?.balanceCents ?? 0)}
              hint={account?.clearanceStatus ? "Fee clearance granted" : "Fee clearance pending"}
            />
            <StatCard label="Open invoices" value={invoices.filter((i) => i.status === "OPEN").length} hint={`${formatMoney(openTotal)} outstanding`} />
            <StatCard
              label="Clearance"
              value={account?.clearanceStatus ? "Granted" : "Blocked"}
              hint="Required for registration & exams"
            />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-head text-xl font-bold text-slate">Invoices</h2>
              <Badge tone="brand">Pay via Remita</Badge>
            </div>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" body="New invoices appear here when fees are due." />
            ) : (
              <Table headers={["Description", "Due", "Amount", "Paid", "Status", "Action"]}>
                {invoices.map((i) => {
                  const paid = i.payments.reduce((a, p) => a + p.amountCents, 0);
                  const remaining = i.amountCents - paid;
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate">{i.description}</p>
                        <p className="text-xs text-slate/70">{i.module.replaceAll("_", " ")}</p>
                      </td>
                      <td className={`px-4 py-3 text-slate/70 ${dueClass(i.dueOn, i.status)}`}>
                        {i.dueOn.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate">{formatMoney(i.amountCents)}</td>
                      <td className="px-4 py-3 text-slate/70">{formatMoney(paid)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={i.waiver ? "WAIVED" : i.status} />
                      </td>
                      <td className="px-4 py-3">
                        {i.status === "OPEN" && remaining > 0 ? (
                          <PayButton invoiceId={i.id} label={`Pay ${formatMoney(remaining)}`} />
                        ) : (
                          <span className="text-xs text-slate/70">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Payment history</h2>
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <Table headers={["Reference", "Module", "Amount", "Channel", "Status", "Date"]}>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate">{p.reference}</td>
                    <td className="px-4 py-3 text-slate/70">{p.module.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountCents)}</td>
                    <td className="px-4 py-3 text-slate/70">{p.channel.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {p.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          {(waivers.length > 0 || scholarships.length > 0) ? (
            <section>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Waivers & scholarships</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {scholarships.map((s) => (
                  <Card key={s.id}>
                    <p className="font-head font-semibold text-slate">{s.title}</p>
                    <p className="text-sm text-slate/70">{formatMoney(s.amountCents)}</p>
                    <div className="mt-2">
                      <StatusBadge status={s.status} />
                    </div>
                  </Card>
                ))}
                {waivers.map((w) => (
                  <Card key={w.id}>
                    <p className="font-head font-semibold text-slate">{w.title}</p>
                    <p className="text-sm text-slate/70">{w.percent}% waiver</p>
                    <div className="mt-2">
                      <StatusBadge status={w.status} />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {plans.length > 0 ? (
            <section>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Payment plans</h2>
              <Table headers={["Installments", "Interval", "Per installment", "Status"]}>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-slate">{p.installments}</td>
                    <td className="px-4 py-3 text-slate/70">{p.intervalDays} days</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountPerInstallmentCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  // ---- bursary view ----
  if (isBursary) {
    const [open, waivers, scholarships] = await Promise.all([
      prisma.invoice.findMany({ where: { status: "OPEN" }, orderBy: { dueOn: "asc" }, take: 20, include: { user: true } }),
      prisma.waiver.findMany({ where: { status: "PENDING" }, include: { user: true } }),
      prisma.scholarship.findMany({ where: { status: "PENDING" }, include: { user: true } }),
    ]);
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 2 · Bursary" title="Fees & Payments" description="Outstanding invoices, waivers and scholarship applications awaiting action." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Open invoices</h2>
            {open.length === 0 ? (
              <EmptyState title="Nothing outstanding" />
            ) : (
              <Table headers={["Student", "Description", "Due", "Amount", "Status"]}>
                {open.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium text-slate">{i.user.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{i.description}</td>
                    <td className="px-4 py-3 text-slate/70">{i.dueOn.toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 font-medium text-slate">{formatMoney(i.amountCents)}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Pending waivers & scholarships</h2>
            {waivers.length + scholarships.length === 0 ? (
              <EmptyState title="Nothing to review" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {scholarships.map((s) => (
                  <Card key={s.id}>
                    <p className="font-head font-semibold text-slate">{s.title}</p>
                    <p className="text-sm text-slate/70">{s.user.fullName} · {formatMoney(s.amountCents)}</p>
                    <div className="mt-2"><StatusBadge status={s.status} /></div>
                  </Card>
                ))}
                {waivers.map((w) => (
                  <Card key={w.id}>
                    <p className="font-head font-semibold text-slate">{w.title}</p>
                    <p className="text-sm text-slate/70">{w.user.fullName} · {w.percent}%</p>
                    <div className="mt-2"><StatusBadge status={w.status} /></div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ---- read-only view for other roles ----
  if (readOnly) {
    const [openCount, recent] = await Promise.all([
      prisma.invoice.count({ where: { status: "OPEN" } }),
      prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: true } }),
    ]);
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 2 · Read-only" title="Fees & Payments" description="Read-only overview of the fee ledger." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <StatCard label="Open invoices" value={openCount} />
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Recent payments</h2>
            <Table headers={["Reference", "Student", "Amount", "Status", "Date"]}>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate">{p.reference}</td>
                  <td className="px-4 py-3 text-slate">{p.user.fullName}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(p.amountCents)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-slate/70">{p.createdAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
