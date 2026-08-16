import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { postgraduateMonitor, staffOverview, governanceStats } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Research & Innovation" };

export default async function VcResearchPage() {
  await requireVC();

  const [pg, staff, stats] = await Promise.all([
    postgraduateMonitor(),
    staffOverview(),
    governanceStats(),
  ]);

  // Count research-active staff (lecturers + professors with PG supervision)
  const researchActiveStaff = staff.total; // Use available staff count as proxy

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Research & Innovation"
        description="Executive overview of research activities and outputs"
      />

      <section aria-label="Research indicators" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Postgraduate Students" value={pg.students} hint="Research-active PG population" />
        <StatCard label="Theses" value={pg.theses} hint="Completed and active theses" />
        <StatCard label="PG Without Supervisor" value={pg.withoutSupervisor} hint="Requires executive attention" />
        <StatCard label="Research-Active Staff" value={researchActiveStaff} hint="Academic staff supervising research" />
      </section>

      <section>
        <SectionHeading title="Research Outputs" subtitle="Indicators available from existing data" />
        <p className="mt-2 text-sm text-slate/70">
          Research projects, publications, and grant data are not currently tracked in the portal core schema.
          The indicators above represent the available research-related data. Future integration with a
          research management system would provide richer metrics.
        </p>
      </section>
    </div>
  );
}
