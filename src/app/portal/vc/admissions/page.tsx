import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVC } from "../guard";
import { admissionsMonitor } from "@/lib/governance";
import {
  STUDENT_CATEGORIES,
  STUDENT_CATEGORY_LABELS,
  STUDENT_CATEGORIES_LIST,
} from "@/lib/constants";
import {
  PageHeader,
  StatCard,
  Table,
  EmptyState,
  SectionHeading,
  Badge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admissions" };

export default async function VcAdmissionsPage() {
  await requireVC();

  const monitor = await admissionsMonitor(50);

  // Determine student categories from applications
  const [ugAppCount, pgAppCount, distanceAppCount, remedialAppCount, ieAppCount] =
    await Promise.all([
      prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] }, user: { studentCategory: "UNDERGRADUATE" } } }),
      prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] }, user: { studentCategory: "POSTGRADUATE" } } }),
      prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] }, user: { studentCategory: "DISTANCE_LEARNING" } } }),
      prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] }, user: { studentCategory: "REMEDIAL" } } }),
      prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] }, user: { studentCategory: "INSTITUTE_OF_EDUCATION" } } }),
    ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Admissions"
        description="Executive admissions dashboard monitoring applications and pipeline"
      />

      <section aria-label="Admissions statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Applications" value={monitor.total} hint="All application records" />
        <StatCard label="Admitted" value={monitor.admitted} hint="Successful admissions" />
        <StatCard label="Offers Made" value={monitor.offers} hint="Conditional offers" />
        <StatCard label="Document Mismatches" value={monitor.documentMismatches} hint="Verification issues" />
      </section>

      <section aria-label="Applications by category" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STUDENT_CATEGORIES_LIST.map((category) => {
          const count = category === "UNDERGRADUATE" ? ugAppCount : category === "POSTGRADUATE" ? pgAppCount : category === "DISTANCE_LEARNING" ? distanceAppCount : category === "REMEDIAL" ? remedialAppCount : ieAppCount;
          const label = STUDENT_CATEGORY_LABELS[category];
          return (
            <StatCard key={category} label={label} value={count} hint={label} />
          );
        })}
      </section>

      <section aria-label="Applications by status" className="grid gap-4">
        <Table headers={["Status", "Count"]}>
          {monitor.byStatus.map((s) => (
            <tr key={s.status}>
              <td className="px-4 py-3"><Badge tone="neutral">{s.status}</Badge></td>
              <td className="px-4 py-3 font-semibold tabular-nums text-slate">{s.count}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-sm text-slate/70">
          PG by status: {monitor.pgByStatus.map((s) => `${STUDENT_CATEGORY_LABELS[s.status as keyof typeof STUDENT_CATEGORY_LABELS] ?? s.status}: ${s.count}`).join(" · ")}
        </p>
      </section>

      <section aria-label="Recent applications" className="grid gap-4">
        <SectionHeading title="Recent Applications" subtitle="Most recent submissions" />
        <Table headers={["Applicant", "Programme", "Status", "Submitted At"]}>
          {monitor.recent.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-slate">{r.name}</td>
              <td className="px-4 py-3">{r.programme}</td>
              <td className="px-4 py-3"><Badge tone="neutral">{r.status}</Badge></td>
              <td className="px-4 py-3">{r.submittedAt?.toLocaleDateString("en-NG") ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
