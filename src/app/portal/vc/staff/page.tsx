import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { staffOverview } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff" };

export default async function VcStaffPage() {
  await requireVC();

  const overview = await staffOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Staff & Human Resources"
        description="University-wide staff oversight and human resources monitoring"
      />

      <section aria-label="Staff statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Staff" value={overview.total} hint="All staff on record" />
        <StatCard label="Academic Staff" value={overview.academic} hint="Faculty staff" />
        <StatCard label="Non-Academic Staff" value={overview.nonTeaching} hint="Administrative support" />
        <StatCard label="Active Staff" value={overview.active} hint="Currently active staff" />
      </section>

      <section aria-label="Staff by faculty" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Faculty", "Staff"]}>
          {overview.byFaculty.map((f) => (
            <tr key={f.faculty ?? "none"}>
              <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Staff by department" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Department", "Staff"]}>
          {overview.byDepartment.map((d) => (
            <tr key={d.department ?? "none"}>
              <td className="px-4 py-3 font-medium text-slate">{d.department ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.count}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <SectionHeading title="Staff Directory" subtitle="Searchable staff listing" />
        <p className="text-sm text-slate/70">
          Total records: {overview.total}. Use the portal search to find specific staff by name, staff number, or faculty.
        </p>
      </section>
    </div>
  );
}
