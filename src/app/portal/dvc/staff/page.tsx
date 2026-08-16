import type { Metadata } from "next";
import { PageHeader, StatCard, Table, EmptyState, SectionHeading } from "@/components/ui";
import { requireGovernanceOversight } from "../guard";
import { staffOverview } from "@/lib/governance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff" };

export default async function DvcStaffPage() {
  await requireGovernanceOversight();

  const [overview, staff] = await Promise.all([
    staffOverview(),
    prisma.user.findMany({
      where: { staffNo: { not: null } },
      select: {
        staffNo: true,
        fullName: true,
        faculty: true,
        department: true,
        role: true,
        status: true,
        staffProfile: { select: { designation: true } },
      },
      orderBy: [{ faculty: "asc" }, { department: "asc" }, { fullName: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Staff"
        description="Academic and non-teaching staff across the university, with faculty and department distribution."
      />

      <section aria-label="Staff summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total staff" value={overview.total} hint={`${overview.active} active`} />
        <StatCard label="Academic staff" value={overview.academic} hint="Outside the non-teaching directorate" />
        <StatCard label="Non-teaching" value={overview.nonTeaching} hint="Administrative / support staff" />
        <StatCard label="Faculties" value={overview.byFaculty.length} hint="Distinct faculties on record" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Staff by faculty" />
          {overview.byFaculty.length === 0 ? (
            <EmptyState title="No staff" />
          ) : (
            <Table headers={["Faculty", "Staff"]}>
              {overview.byFaculty.map((f) => (
                <tr key={f.faculty ?? "none"}>
                  <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div>
          <SectionHeading title="Staff by department" subtitle="Top departments by headcount." />
          {overview.byDepartment.length === 0 ? (
            <EmptyState title="No departments" />
          ) : (
            <Table headers={["Department", "Staff"]}>
              {overview.byDepartment.slice(0, 15).map((d) => (
                <tr key={d.department ?? "none"}>
                  <td className="px-4 py-3 font-medium text-slate">{d.department ?? "Unassigned"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title="Staff register" subtitle="Full roster with role and designation." />
        {staff.length === 0 ? (
          <EmptyState title="No staff on record" />
        ) : (
          <Table headers={["Staff No", "Name", "Faculty", "Department", "Role", "Rank", "Status"]}>
            {staff.map((s) => (
              <tr key={s.staffNo}>
                <td className="px-4 py-3 font-medium text-slate">{s.staffNo}</td>
                <td className="px-4 py-3 text-slate/70">{s.fullName}</td>
                <td className="px-4 py-3 text-slate/70">{s.faculty ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{s.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{s.role.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate/70">{s.staffProfile?.designation ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{s.status.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
