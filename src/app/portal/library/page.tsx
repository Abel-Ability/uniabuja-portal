import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  PageHeader,
  Table,
  StatCard,
  StatusBadge,
  Badge,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import { BorrowHoldingButton, ReturnLoanButton } from "./loan-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Library" };

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resourceBadge(resourceType: string) {
  if (resourceType === "E_RESOURCE") return <Badge tone="slate">E-resource</Badge>;
  return <Badge tone="brand">Physical</Badge>;
}

export default async function LibraryPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const [holdings, loans] = await Promise.all([
      prisma.libraryHolding.findMany({
        orderBy: { title: "asc" },
      }),
      prisma.libraryLoan.findMany({
        where: { userId: user.id },
        orderBy: { borrowedAt: "desc" },
        include: { holding: true },
      }),
    ]);
    const activeLoans = loans.filter((l) => l.status !== "RETURNED");

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 11 · Student"
          title="Library"
          description="Browse the catalogue, borrow physical holdings and track your current loans."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Catalogue"
              value={holdings.length}
              hint="Physical & e-resources"
            />
            <StatCard
              label="On loan to you"
              value={activeLoans.length}
              hint="Due back soon"
            />
            <StatCard
              label="Copies available"
              value={holdings.reduce((a, h) => a + h.availableCopies, 0)}
              hint="Across all holdings"
            />
          </section>

          <section aria-label="Catalogue">
            <SectionHeading
              title="Catalogue"
              subtitle="Borrow physical holdings with copies in stock. E-resources are streamed online."
            />
            {holdings.length === 0 ? (
              <EmptyState title="Catalogue is empty" />
            ) : (
              <Table headers={["Title", "Author", "Category", "Call number", "Availability", "Type", "Action"]}>
                {holdings.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{h.title}</p>
                      {h.isbn ? <p className="text-xs text-slate/70">ISBN {h.isbn}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate/70">{h.author ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">{h.category ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{h.callNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {h.availableCopies}/{h.totalCopies} available
                    </td>
                    <td className="px-4 py-3">{resourceBadge(h.resourceType)}</td>
                    <td className="px-4 py-3">
                      {h.resourceType === "E_RESOURCE" ? (
                        <Badge tone="slate">Stream online</Badge>
                      ) : h.availableCopies > 0 ? (
                        <BorrowHoldingButton holdingId={h.id} />
                      ) : (
                        <span className="text-xs text-slate/70">On loan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="My loans">
            <SectionHeading
              title="My loans"
              subtitle="Physical holdings you currently have checked out."
            />
            {loans.length === 0 ? (
              <EmptyState title="No loans yet" body="Borrow a physical holding from the catalogue above." />
            ) : (
              <Table headers={["Holding", "Borrowed", "Due", "Status", "Action"]}>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-slate">{l.holding.title}</td>
                    <td className="px-4 py-3 text-slate/70">{formatDate(l.borrowedAt)}</td>
                    <td className="px-4 py-3 text-slate/70">{formatDate(l.dueAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3">
                      {l.status === "OUT" || l.status === "OVERDUE" ? (
                        <ReturnLoanButton id={l.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (["LECTURER", "HOD", "REGISTRY", "BURSARY", "EXAMS_RECORDS", "DVC_OVERSIGHT", "VC"].includes(user.role)) {
    const holdings = await prisma.libraryHolding.findMany({
      orderBy: { title: "asc" },
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 11 · Read-only"
          title="Library"
          description="Read-only view of the library catalogue."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Catalogue">
            <SectionHeading
              title="Catalogue"
              subtitle="Physical and electronic holdings across the library."
            />
            {holdings.length === 0 ? (
              <EmptyState title="Catalogue is empty" />
            ) : (
              <Table headers={["Title", "Author", "Category", "Call number", "Availability", "Type"]}>
                {holdings.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{h.title}</p>
                      {h.isbn ? <p className="text-xs text-slate/70">ISBN {h.isbn}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate/70">{h.author ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">{h.category ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{h.callNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {h.availableCopies}/{h.totalCopies} available
                    </td>
                    <td className="px-4 py-3">{resourceBadge(h.resourceType)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
