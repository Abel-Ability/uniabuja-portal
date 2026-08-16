import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, departmentMaxLevel, CURRENT_SESSION } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import {
  fetchDepartmentStudentById,
  fetchDepartmentCoordinators,
  fetchDepartmentLevelAdvisers,
  resolveStudentAdviser,
  displayName,
  categoryLabel,
} from "@/lib/student-stats";
import { PageHeader, Card, SectionHeading, StatusBadge, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Student Details" };

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">{label}</dt>
      <dd className="text-right font-medium text-slate">{value}</dd>
    </div>
  );
}

export default async function HodStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;
  const maxLevel = departmentMaxLevel(dept ?? "");
  const { id } = await params;

  // The department is part of the WHERE clause: a hand-edited URL can never
  // surface a student from another department.
  const student = dept ? await fetchDepartmentStudentById(dept, id, maxLevel) : null;
  if (!student) notFound();

  const [coordinators, advisers] = dept
    ? await Promise.all([
        fetchDepartmentCoordinators(dept, CURRENT_SESSION),
        fetchDepartmentLevelAdvisers(dept, CURRENT_SESSION),
      ])
    : [[], []];
  const coordinator =
    student.level != null ? coordinators.find((c) => c.level === student.level) : undefined;
  const adviserName = resolveStudentAdviser(student, advisers);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Student Details"
        description={`Departmental student record in ${dept ?? "your department"}. Read-only view — no editing privileges are available here.`}
      />

      <Link
        href="/portal/hod/students"
        className="inline-flex items-center gap-2 rounded-full border border-slate/25 px-4 py-1.5 font-head text-xs font-semibold text-slate transition-colors hover:border-brand/40 hover:text-brand-strong"
      >
        ← Back to students
      </Link>

      <section aria-label="Identity">
        <SectionHeading title="Identity" />
        <Card>
          <dl className="divide-y divide-slate/10">
            <DetailRow label="Registration number" value={student.registrationNo ?? student.username} />
            <DetailRow label="Name" value={displayName(student)} />
            <DetailRow
              label="Student category"
              value={categoryLabel(student.studentCategory)}
            />
            <DetailRow label="Status" value={<StatusBadge status={student.status} />} />
          </dl>
        </Card>
      </section>

      <section aria-label="Academic">
        <SectionHeading title="Academic" />
        <Card>
          <dl className="divide-y divide-slate/10">
            <DetailRow label="Faculty" value={student.faculty ?? "—"} />
            <DetailRow label="Department" value={student.department ?? "—"} />
            <DetailRow label="Programme" value={student.programmeName ?? "—"} />
            <DetailRow
              label="Level"
              value={
                student.level != null ? (
                  <Badge tone={student.level > maxLevel ? "gold" : "brand"}>
                    {student.level} Level
                  </Badge>
                ) : (
                  <span className="text-slate/50">—</span>
                )
              }
            />
            <DetailRow label="Admission session" value={student.admissionSession ?? "—"} />
            <DetailRow label="Sex" value={student.sex ?? "—"} />
            <DetailRow
              label="Date of birth"
              value={student.dateOfBirth ? student.dateOfBirth.toLocaleDateString("en-GB") : "—"}
            />
          </dl>
        </Card>
      </section>

      <section aria-label="Advising">
        <SectionHeading
          title="Advising"
          subtitle={`Assignments for the ${CURRENT_SESSION} session.`}
        />
        <Card>
          <dl className="divide-y divide-slate/10">
            <DetailRow
              label="Level Coordinator"
              value={
                coordinator ? (
                  coordinator.coordinatorName
                ) : (
                  <span className="text-slate/50">No Level Coordinator Assigned</span>
                )
              }
            />
            <DetailRow
              label="Level Adviser"
              value={
                adviserName ? (
                  adviserName
                ) : (
                  <span className="text-slate/50">No Level Adviser Assigned</span>
                )
              }
            />
          </dl>
        </Card>
      </section>

      {coordinator == null && adviserName == null ? (
        <EmptyState
          title="No coordination assignments yet"
          body="Assign a level coordinator and level adviser from the HoD workspace so students have a named point of contact."
        />
      ) : null}
    </div>
  );
}
