import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVC } from "../guard";
import {
  STUDENT_CATEGORIES,
  STUDENT_CATEGORY_LABELS,
} from "@/lib/constants";
import {
  PageHeader,
  StatCard,
  Table,
  EmptyState,
  SectionHeading,
  Badge,
} from "@/components/ui";
import { academicSessions, CURRENT_SESSION, STUDENT_CATEGORIES_LIST } from "@/lib/constants";
import type { StudentCategory } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Students" };

export default async function VcStudentsPage() {
  await requireVC();

  const session = await prisma.session.findFirst({
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const [total, active, byCategory, byStatus, byDepartment, byFaculty, byProgramme] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      prisma.user.groupBy({ by: ["studentCategory"], where: { role: "STUDENT" }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["department"], where: { role: "STUDENT" }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["faculty"], where: { role: "STUDENT" }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["programmeId"], where: { role: "STUDENT" }, _count: { _all: true } }),
    ]);

  const categoryMap = new Map(
    STUDENT_CATEGORIES_LIST.map((c) => [c, 0] as [string, number]),
  );
  for (const c of byCategory) {
    const label = STUDENT_CATEGORY_LABELS[c.studentCategory as keyof typeof STUDENT_CATEGORY_LABELS] ?? c.studentCategory;
    categoryMap.set(label, c._count._all);
  }

  const statusMap = new Map(
    byStatus.map((s) => [s.status, s._count._all]),
  );

  const deptMap = new Map(
    byDepartment.map((d) => [d.department ?? "Unassigned", d._count._all]),
  );

  const facultyMap = new Map(
    byFaculty.map((f) => [f.faculty ?? "Unassigned", f._count._all]),
  );

  const programmeMap = new Map(
    byProgramme.map((p) => {
      if (!p.programmeId) return ["Unassigned", 0] as [string, number];
      return [p.programmeId, Number(p._count._all) || 0] as [string, number];
    }),
  );

  const levelOptions = academicSessions(2025);
  const selectedLevel = levelOptions[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Students"
        description="University-wide student monitoring and population overview"
      />

      <section aria-label="Student statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={total} hint="All enrolled students" />
        <StatCard label="Active Students" value={active} hint="Currently active enrollment" />
        <StatCard label="By Faculty" value={facultyMap.size} hint="Faculties with students" />
        <StatCard label="By Department" value={deptMap.size} hint="Departments with students" />
      </section>

      <section aria-label="Students by category" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STUDENT_CATEGORIES_LIST.map((category) => {
          const count = categoryMap.get(category) ?? 0;
          const label = STUDENT_CATEGORY_LABELS[category];
          return (
            <StatCard key={category} label={label} value={count} hint={category} />
          );
        })}
      </section>

      <section aria-label="Students by status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Status", "Students"]}>
          {byStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s._count._all}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Students by faculty" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Faculty", "Students"]}>
          {byFaculty.map((f) => (
            <tr key={f.faculty ?? "none"}>
              <td className="px-4 py-3 font-medium text-slate">{f.faculty ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{f._count._all}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Students by department" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Department", "Students"]}>
          {byDepartment.map((d) => (
            <tr key={d.department ?? "none"}>
              <td className="px-4 py-3 font-medium text-slate">{d.department ?? "Unassigned"}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{d._count._all}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section aria-label="Students by programme" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Table headers={["Programme", "Students"]}>
          {byProgramme.map((p) => {
            if (!p.programmeId) return null;
            const label = p.programmeId;
            return (
              <tr key={p.programmeId}>
                <td className="px-4 py-3 font-medium text-slate">{label}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-slate">{p._count._all}</td>
              </tr>
            );
          })}
        </Table>
      </section>

      <section aria-label="Students by level" className="grid gap-4">
        <SectionHeading title="Students by Academic Level" subtitle="Select session:" />
        <div className="grid gap-2">
          {levelOptions.map((session) => (
            <Link
              key={session}
              href={`/portal/vc/students?session=${session}`}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                selectedLevel === session ? "bg-brand-strong text-white" : "text-slate/70 hover:bg-slate/5 hover:text-slate"
              }`}
            >
              {session}
            </Link>
          ))}
        </div>

        <div className="alert alert-info">Student level distribution data is available per session.</div>
      </section>
    </div>
  );
}
