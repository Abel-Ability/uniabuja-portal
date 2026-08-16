import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, SEMESTER_LABELS } from "@/lib/constants";
import { getCoursesUG } from "@/lib/sheets";
import { isHodRole, courseInDepartmentCatalogue } from "@/lib/hod";
import { PageHeader, Card, SectionHeading, StatusBadge } from "@/components/ui";
import { OfferingStatusButton } from "../../OfferingTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Offering Details" };

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">{label}</dt>
      <dd className="text-right font-medium text-slate">{value}</dd>
    </div>
  );
}

export default async function OfferingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const { id } = await params;

  const offering = await prisma.courseOffering.findUnique({
    where: { id },
    include: { course: true, programme: true },
  });
  if (!offering) notFound();

  // A hand-edited URL can never surface another department's offering: the
  // offering's course must belong to this HoD's faculty/department scope.
  if (!(await courseInDepartmentCatalogue(user.faculty, user.department, offering.course.code))) {
    notFound();
  }

  const catalogue = await getCoursesUG();
  const entry = catalogue.find((c) => c.code === offering.course.code);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title={`${offering.course.code} — Course Offering`}
        description="Details of this course offering and its current availability status."
        breadcrumbs={["HoD Workspace", "Course Offerings", offering.course.code]}
      />

      <div>
        <Link
          href="/portal/hod/course-offerings"
          className="inline-flex items-center gap-2 rounded-full border-2 border-brand-strong px-5 py-2 font-head text-sm font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
        >
          Back to Course Offerings
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Course" subtitle="From the departmental catalogue." />
          <dl className="divide-y divide-slate/10">
            <DetailRow label="Course code" value={offering.course.code} />
            <DetailRow label="Course title" value={offering.course.title} />
            <DetailRow label="Units" value={offering.course.units} />
            <DetailRow label="Faculty" value={entry?.faculty ?? user.faculty ?? "—"} />
            <DetailRow label="Department" value={entry?.hostingDepartment ?? user.department ?? "—"} />
          </dl>
        </Card>

        <Card>
          <SectionHeading
            title="Offering"
            subtitle="Where and when students can take this course."
            action={<OfferingStatusButton id={offering.id} currentStatus={offering.status} />}
          />
          <dl className="divide-y divide-slate/10">
            <DetailRow
              label="Programme"
              value={offering.programme?.name ?? "All programmes (department-wide)"}
            />
            <DetailRow label="Level" value={`${offering.level} Level`} />
            <DetailRow label="Academic session" value={offering.academicSession} />
            <DetailRow label="Semester" value={SEMESTER_LABELS[offering.semester] ?? offering.semester} />
            <DetailRow label="Status" value={<StatusBadge status={offering.status} />} />
            <DetailRow label="Created" value={offering.createdAt.toLocaleDateString()} />
            <DetailRow label="Last updated" value={offering.updatedAt.toLocaleDateString()} />
          </dl>
        </Card>
      </div>

      <p className="max-w-3xl text-sm text-slate/70">
        Only ACTIVE offerings are eligible for student course registration. Deactivating an offering pauses
        it for new registrations while keeping its history. Course Assignment (lecturer allocation) is not
        affected by this offering.
      </p>
    </div>
  );
}
