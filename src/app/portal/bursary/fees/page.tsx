import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, StatusBadge, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fees & Charges" };

export default async function FeesChargesPage() {
  const session = await getCurrentSession();
  if (!session) return null;
  const { user } = session;

  if (user.role !== "BURSARY") return null;

  const [
    feeSchedules,
    studentCharges,
    waivers,
    exemptions,
    outstandingBalances,
  ] = await Promise.all([
    prisma.invoice.findMany({ where: { module: "TUITION" }, take: 10, include: { user: true } }),
    prisma.invoice.findMany({
      where: { module: "ACCEPTANCE" },
      take: 10,
      include: { user: true },
    }),
    prisma.waiver.findMany({ take: 10, include: { user: true } }),
    prisma.$queryRaw`SELECT * FROM waivers WHERE status = 'EXEMPT' LIMIT 10`,
    prisma.invoice.findMany({
      where: { status: "OPEN" },
      take: 10,
      include: { user: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Fees & Charges"
        description="Fee schedules, student charges, programme-based fees, waivers, exemptions and outstanding balances"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Fee Schedules</h2>
          {feeSchedules.length === 0 ? (
            <EmptyState title="No fee schedules" body="Fee schedules will appear here when tuition fees are due." />
          ) : (
            <Table headers={["Student", "Module", "Description", "Due", "Amount", "Status"]}>
              {feeSchedules.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate">{i.user?.fullName}</td>
                  <td className="px-4 py-3 text-slate/70">{i.module.replaceAll("_", " ")}</td>
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
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Student Charges</h2>
          {studentCharges.length === 0 ? (
            <EmptyState title="No student charges" body="Student charges appear here when acceptance or other fees are due." />
          ) : (
            <Table headers={["Student", "Module", "Description", "Due", "Amount", "Status"]}>
              {studentCharges.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate">{i.user?.fullName}</td>
                  <td className="px-4 py-3 text-slate/70">{i.module.replaceAll("_", " ")}</td>
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
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Waivers & Exemptions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {waivers.length > 0 ? (
              <div>
                <h3 className="font-head text-sm font-bold text-slate">Pending Waivers</h3>
                <Table headers={["Student", "Waiver", "%", "Status"]}>
                  {waivers.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-3 font-medium text-slate">{w.user?.fullName}</td>
                      <td className="px-4 py-3 text-slate/70">{w.title}</td>
                      <td className="px-4 py-3 text-slate/70">{w.percent}%</td>
                      <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                    </tr>
                  ))}
                </Table>
              </div>
            ) : null}
            {exemptions ? (
              <div>
                <p className="text-slate/70">Exemptions data is available in the database.</p>
              </div>
            ) : null}
          </div>
        </section>
        <section>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Outstanding Balances</h2>
          {outstandingBalances.length === 0 ? (
            <EmptyState title="No outstanding balances" body="Outstanding balances appear here when invoices are unpaid." />
          ) : (
            <Table headers={["Student", "Amount", "Due", "Status"]}>
              {outstandingBalances.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate">{i.user?.fullName}</td>
                  <td className="px-4 py-3 font-medium text-slate">{formatMoney(i.amountCents)}</td>
                  <td className="px-4 py-3 text-slate/70">{i.dueOn.toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}