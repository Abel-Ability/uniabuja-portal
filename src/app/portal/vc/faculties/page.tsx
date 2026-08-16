import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { facultyComparison } from "@/lib/governance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faculties & Departments" };

export default async function VcFacultiesDepartmentsPage() {
  await requireVC();

  const facultyRows = await facultyComparison();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Faculties & Departments"
        description="Institutional organizational view with statistics at each level"
      />

      <section aria-label="Faculties overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facultyRows.length === 0 ? (
          <EmptyState title="No faculty data" />
        ) : (
          <Table headers={["Faculty", "Departments", "Students", "Staff", "Programmes", "Results Pending", "Clearance"]}>
            {facultyRows.map((f) => (
              <tr key={f.faculty}>
                <td className="px-4 py-3 font-medium text-slate">{f.faculty}</td>
                <td className="px-4 py-3 font-semibold text-slate">{f.departments}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.students}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.staff}</td>
                <td className="px-4 py-3 font-semibold text-slate">{f.programmes}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.resultsPending}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.pendingClearance}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Drill-down: Faculty Details" subtitle="Select a faculty to view departments" />
        <p className="mt-2 text-sm text-slate/70">
          The VC can drill down into each faculty to view departments, programmes, courses, and related statistics.
        </p>
      </section>
    </div>
  );
}
