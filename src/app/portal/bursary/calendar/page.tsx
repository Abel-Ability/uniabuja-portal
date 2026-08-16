import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Table, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { landingForRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Financial Calendar" };

export default async function FinancialCalendarPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "BURSARY") redirect(landingForRole(session.user.role));

  const [registrationWindows, feeDeadlines] = await Promise.all([
    prisma.academicCalendarEntry.findMany({
      where: { entryType: "REGISTRATION", published: true },
      take: 20,
      orderBy: { startsOn: "asc" },
    }),
    prisma.academicCalendarEntry.findMany({
      where: { entryType: "FEE_DEADLINE", published: true },
      take: 20,
      orderBy: { startsOn: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Bursary"
        title="Financial Calendar"
        description="Registration windows and fee-payment deadlines from the published academic calendar"
      />
      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Registration Payment Windows</h2>
        {registrationWindows.length === 0 ? (
          <EmptyState title="No registration windows" body="No published registration calendar entries yet." />
        ) : (
          <Table headers={["Window", "Start", "End"]}>
            {registrationWindows.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-3 text-slate/70">{w.title}</td>
                <td className="px-4 py-3 text-slate/70">{formatDate(w.startsOn)}</td>
                <td className="px-4 py-3 text-slate/70">{formatDate(w.endsOn)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Fee-Payment Deadlines</h2>
        {feeDeadlines.length === 0 ? (
          <EmptyState title="No fee deadlines" body="No published fee-deadline calendar entries yet." />
        ) : (
          <Table headers={["Deadline", "Start", "End"]}>
            {feeDeadlines.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-3 text-slate/70">{w.title}</td>
                <td className="px-4 py-3 text-slate/70">{formatDate(w.startsOn)}</td>
                <td className="px-4 py-3 text-slate/70">{formatDate(w.endsOn)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <p className="text-sm text-slate/60">
        Dates shown are read from the published academic calendar and are read-only here.
      </p>
    </div>
  );
}
