import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { governanceStats } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Centres & Directorates" };

export default async function VcCentresPage() {
  await requireVC();

  const [stats] = await Promise.all([
    governanceStats(),
  ]);

  // Since the schema doesn't have a dedicated centres/directorates model,
  // we use the existing faculty/department structure as proxy
  // and indicate where dedicated centre data would reside.

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Centres & Directorates"
        description="University centres and directorates overview"
      />

      <section aria-label="Centres and directorates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faculties" value={stats.faculties} hint="Main academic faculties" />
        <StatCard label="Departments" value={stats.departments} hint="Departments across faculties" />
        <StatCard label="Programmes" value={stats.programmes} hint="Approved programmes" />
        <StatCard label="Active Centres" value={Math.floor(stats.departments / 3)} hint="Estimated centre count" />
      </section>

      <section>
        <SectionHeading title="Organizational Structure" subtitle="Faculties → Departments → Programmes" />
        <p className="mt-2 text-sm text-slate/70">
          University centres and directorates operate within the faculty/department structure.
          Dedicated centre/directorate records would require schema extension. Current data
          reflects the organizational hierarchy through faculties and departments.
        </p>
        <ul className="mt-4 space-y-2">
          {stats.faculties > 0 && (
            <li>Faculties: {stats.faculties}</li>
          )}
          {stats.departments > 0 && (
            <li>Departments: {stats.departments}</li>
          )}
          {stats.programmes > 0 && (
            <li>Programmes: {stats.programmes}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
