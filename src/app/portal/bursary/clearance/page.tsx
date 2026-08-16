import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, Table, EmptyState, Badge } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { landingForRole } from "@/lib/constants";
import { ClearanceSignOffButton } from "@/app/portal/bursary/clearance-sign-off-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Financial Clearance" };

const OUTSTANDING_INVOICE_STATUSES = ["OPEN", "OVERDUE", "PARTIAL"];
const FEE_MODULES = ["TUITION", "ACCEPTANCE"];

export default async function FinancialClearancePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [clearanceItems, pendingGroups, obligationSummary, clearedCount, totalStudents] = await Promise.all([
    prisma.clearanceItem.findMany({
      where: { department: "BURSARY" },
      orderBy: { signedOffAt: "desc" },
      take: 100,
      include: {
        clearanceRequest: { include: { user: true } },
        signedOffBy: true,
      },
    }),
    prisma.invoice.groupBy({
      by: ["userId"],
      where: { status: { in: OUTSTANDING_INVOICE_STATUSES }, module: { in: FEE_MODULES } },
      _count: { _all: true },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: "desc" } },
    }),
    prisma.invoice.groupBy({
      by: ["module"],
      where: { status: { in: OUTSTANDING_INVOICE_STATUSES } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    prisma.feeAccount.count({ where: { clearanceStatus: true } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
  ]);

  const studentsWithObligations = pendingGroups.length > 0 ? await prisma.user.findMany({
    where: { id: { in: pendingGroups.map((g) => g.userId) } },
    select: { id: true, fullName: true, registrationNo: true },
  }) : [];
  const studentById = new Map(studentsWithObligations.map((s) => [s.id, s]));

  const pendingItems = clearanceItems.filter((i) => i.status === "PENDING");
  const signedOffItems = clearanceItems.filter((i) => i.status === "SIGNED_OFF");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Financial Clearance"
        description="Sign off Bursary clearance items and review student financial obligations"
      />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Fee-Cleared Students</h3>
          <p className="font-head text-2xl font-bold text-green-600">{clearedCount}</p>
          <p className="mt-1 text-xs text-slate/60">of {totalStudents} students</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Awaiting Financial Clearance</h3>
          <p className="font-head text-2xl font-bold text-red-600">{pendingGroups.length}</p>
          <p className="mt-1 text-xs text-slate/60">Students with open tuition/acceptance obligations</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Pending Sign-offs</h3>
          <p className="font-head text-2xl font-bold text-amber-600">{pendingItems.length}</p>
          <p className="mt-1 text-xs text-slate/60">Bursary clearance items awaiting sign-off</p>
        </Card>
        <Card className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
          <h3 className="font-head text-sm font-bold text-slate uppercase tracking-wider mb-2">Signed Off</h3>
          <p className="font-head text-2xl font-bold text-slate">{signedOffItems.length}</p>
          <p className="mt-1 text-xs text-slate/60">Bursary clearance items completed</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Bursary Clearance Sign-offs</h2>
        {clearanceItems.length === 0 ? (
          <EmptyState title="No clearance requests" body="Clearance items appear here when students start the clearance workflow." />
        ) : (
          <Table headers={["Student", "Clearance Type", "Status", "Signed by", "Signed at", "Action"]}>
            {clearanceItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate">{item.clearanceRequest.user.fullName}</td>
                <td className="px-4 py-3 text-slate/70">{item.clearanceRequest.clearanceType.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">
                  {item.status === "SIGNED_OFF" ? <Badge tone="brand">Signed off</Badge> : <Badge tone="amber">Pending</Badge>}
                </td>
                <td className="px-4 py-3 text-slate/70">{item.signedOffBy?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{item.signedOffAt ? formatDate(item.signedOffAt) : "—"}</td>
                <td className="px-4 py-3">
                  {item.status === "PENDING" ? <ClearanceSignOffButton itemId={item.id} /> : "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-3 text-sm text-slate/60">
          Signing off is restricted to the Bursary (GRAD_CLEARANCE approve right) and is recorded in the hash-chained
          audit trail plus the clearance approval log.
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Students Awaiting Financial Clearance</h2>
        {pendingGroups.length === 0 ? (
          <EmptyState title="All students financially cleared" />
        ) : (
          <Table headers={["Registration No.", "Student", "Outstanding", "Open Invoices"]}>
            {pendingGroups.map((row) => (
              <tr key={row.userId}>
                <td className="px-4 py-3 font-medium text-slate">{studentById.get(row.userId)?.registrationNo ?? "—"}</td>
                <td className="px-4 py-3 text-slate">
                  <Link href={`/portal/bursary/accounts?userId=${row.userId}`} className="hover:underline">
                    {studentById.get(row.userId)?.fullName ?? row.userId}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-slate">{formatMoney(Number(row._sum.amountCents ?? 0))}</td>
                <td className="px-4 py-3 text-slate/70">{row._count._all}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Financial Obligation Summary</h2>
        {obligationSummary.length === 0 ? (
          <EmptyState title="No outstanding obligations" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {obligationSummary.map((row) => (
              <Card key={row.module} className="p-4 rounded-xl border border-slate/10 bg-white dark:border-slate-200/15 dark:bg-slate-900">
                <h3 className="font-head text-sm font-bold text-slate">{row.module.replaceAll("_", " ")}</h3>
                <p className="font-head text-xl font-bold text-brand-strong">{formatMoney(Number(row._sum.amountCents ?? 0))}</p>
                <p className="text-slate/60">{row._count._all} open invoice(s)</p>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-slate/60">
          Financial clearance status feeds the registration and examination workflows: a student with an open
          tuition/acceptance invoice is not fee-cleared and cannot complete course registration.
        </p>
      </section>
    </div>
  );
}
