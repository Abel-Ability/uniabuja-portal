import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { HBars } from "@/components/hbar";
import { StudentFilters } from "@/components/student-filters";
import { requireGovernanceOversight } from "../guard";
import {
  fetchUniversityStudents,
  buildFilterOptions,
  parseStudentFilters,
  applyStudentFilters,
  computeStudentStats,
  paginate,
  categoryLabel,
  displayName,
  type StudentRow,
} from "@/lib/student-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Students" };

export default async function DvcStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireGovernanceOversight();
  const params = await searchParams;

  const rows = await fetchUniversityStudents();
  const departments = [...new Set(rows.map((r) => r.department).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b),
  );
  const requestedDept = typeof params.department === "string" ? params.department : undefined;
  const activeDepartment = requestedDept && departments.includes(requestedDept) ? requestedDept : undefined;
  const scopedRows = activeDepartment ? rows.filter((r) => r.department === activeDepartment) : rows;

  const options = buildFilterOptions(scopedRows);
  const { filters, active, page } = parseStudentFilters(params, options);
  const filtered = applyStudentFilters(scopedRows, filters);
  const stats = computeStudentStats(filtered);
  const { items, total, totalPages } = paginate(filtered, page);

  const exportUrl = new URLSearchParams(active as Record<string, string>);
  if (activeDepartment) exportUrl.set("department", activeDepartment);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance & Oversight"
        title="Students"
        description="The university-wide student register with analytics. Read-only — this committee never edits student records."
      />

      <section aria-label="Register filters">
        <StudentFilters
          options={options}
          active={active}
          basePath="/portal/dvc/students"
          department={activeDepartment}
          departments={departments}
          showDepartment
        />
      </section>

      <section aria-label="Student analytics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={filtered.length} hint={activeDepartment ? `${activeDepartment} department` : "University-wide"} />
        <StatCard label="Active" value={stats.active} hint={stats.activePct != null ? `${stats.activePct}% of view` : undefined} />
        <StatCard label="Undergraduate" value={stats.undergraduate} hint={stats.undergraduatePct != null ? `${stats.undergraduatePct}%` : undefined} />
        <StatCard label="Postgraduate" value={stats.postgraduate} hint={stats.postgraduatePct != null ? `${stats.postgraduatePct}%` : undefined} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="By category" />
          <HBars items={stats.byCategory.buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct }))} unknown={stats.byCategory.unknown} />
        </div>
        <div>
          <SectionHeading title="By status" />
          <HBars items={stats.byStatus.buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct }))} unknown={stats.byStatus.unknown} />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Student register"
          subtitle={`Showing ${items.length} of ${total} students.`}
          action={
            <a
              href={`/portal/dvc/students/export?${exportUrl.toString()}`}
              className="rounded-full bg-brand-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Export CSV
            </a>
          }
        />
        {items.length === 0 ? (
          <EmptyState title="No students match these filters" body="Adjust the filters to widen the register." />
        ) : (
          <Table headers={["Student", "Reg No", "Category", "Department", "Level", "Status"]}>
            {items.map((r: StudentRow) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate">{displayName(r)}</td>
                <td className="px-4 py-3 text-slate/70">{r.registrationNo ?? r.username}</td>
                <td className="px-4 py-3 text-slate/70">{categoryLabel(r.studentCategory)}</td>
                <td className="px-4 py-3 text-slate/70">{r.department ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{r.level ?? "—"}</td>
                <td className="px-4 py-3 text-slate/70">{r.status.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </Table>
        )}
        {totalPages > 1 ? (
          <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const link = new URLSearchParams(exportUrl);
              link.set("page", String(p));
              return (
                <a
                  key={p}
                  href={`/portal/dvc/students?${link.toString()}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${
                    p === page ? "bg-brand-strong text-white" : "bg-slate/10 text-slate hover:bg-slate/20"
                  }`}
                >
                  {p}
                </a>
              );
            })}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
