import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import {
  PageHeader,
  Card,
  Badge,
  SectionHeading,
  Table,
  EmptyState,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admission Reports" };

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "R")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Your role does not have access to this page." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have permission to view admission reports.</p>
          </Card>
        </div>
      </div>
    );
  }

  const applications = await prisma.application.findMany({
    where: { status: { notIn: ["DRAFT"] } },
    include: { programme: true },
  });

  const totalApplications = applications.length;
  const eligibleCount = applications.filter((a) => a.eligible === true).length;
  const ineligibleCount = applications.filter((a) => a.eligible === false).length;
  const cutoffMetCount = applications.filter((a) => a.cutoffMet === true).length;
  const admittedCount = applications.filter((a) => a.status === "ADMITTED").length;
  const notAdmittedCount = applications.filter((a) => a.status === "NOT_ADMITTED").length;

  // Category breakdown
  const categoryBreakdown = applications.reduce((acc, app) => {
    const cat = app.committeeCategory ?? "UNCATEGORIZED";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Faculty breakdown
  const facultyBreakdown = applications.reduce((acc, app) => {
    const fac = app.faculty ?? "Unknown";
    acc[fac] = (acc[fac] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Status breakdown
  const statusBreakdown = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Admission Reports"
        description="Admission statistics and reports"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Summary */}
        <section aria-label="Summary statistics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Applications" value={totalApplications} />
            <StatCard label="Eligible" value={eligibleCount} hint={`${ineligibleCount} ineligible`} />
            <StatCard label="Cut-off Met" value={cutoffMetCount} />
            <StatCard label="Admitted" value={admittedCount} hint={`${notAdmittedCount} not admitted`} />
          </div>
        </section>

        {/* Status Breakdown */}
        <section aria-label="Status breakdown">
          <SectionHeading title="Status Breakdown" />
          {Object.keys(statusBreakdown).length > 0 ? (
            <Table headers={["Status", "Count", "Percentage"]}>
              {Object.entries(statusBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <tr key={status} className="hover:bg-slate/5">
                    <td className="px-4 py-3">
                      <Badge tone={status === "ADMITTED" ? "brand" : status === "NOT_ADMITTED" ? "red" : "neutral"}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{count}</td>
                    <td className="px-4 py-3 text-sm">
                      {totalApplications > 0 ? `${((count / totalApplications) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
            </Table>
          ) : (
            <EmptyState title="No data available" body="Reports will appear once applications are synced." />
          )}
        </section>

        {/* Category Breakdown */}
        <section aria-label="Category breakdown">
          <SectionHeading title="Admission Categories" />
          {Object.keys(categoryBreakdown).length > 0 ? (
            <Table headers={["Category", "Count"]}>
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <tr key={category} className="hover:bg-slate/5">
                    <td className="px-4 py-3 text-sm">{category}</td>
                    <td className="px-4 py-3 text-sm font-medium">{count}</td>
                  </tr>
                ))}
            </Table>
          ) : (
            <EmptyState title="No category data" body="Category breakdown will appear once applications are processed." />
          )}
        </section>

        {/* Faculty Breakdown */}
        <section aria-label="Faculty breakdown">
          <SectionHeading title="Applications by Faculty" />
          {Object.keys(facultyBreakdown).length > 0 ? (
            <Table headers={["Faculty", "Count", "Percentage"]}>
              {Object.entries(facultyBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([faculty, count]) => (
                  <tr key={faculty} className="hover:bg-slate/5">
                    <td className="px-4 py-3 text-sm">{faculty}</td>
                    <td className="px-4 py-3 text-sm font-medium">{count}</td>
                    <td className="px-4 py-3 text-sm">
                      {totalApplications > 0 ? `${((count / totalApplications) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
            </Table>
          ) : (
            <EmptyState title="No faculty data" body="Faculty breakdown will appear once applications are synced." />
          )}
        </section>
      </div>
    </div>
  );
}
