import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  landingForRole,
  HOD_MENU,
  CURRENT_SESSION,
  academicSessions,
  departmentLevels,
  departmentMaxLevel,
} from "@/lib/constants";
import { getCoursesUG } from "@/lib/sheets";
import { isHodRole, departmentProgrammeIds } from "@/lib/hod";
import { PageHeader, StatCard, EmptyState, SectionHeading } from "@/components/ui";
import { OfferingCreationForm } from "./OfferingCreationForm";
import { OfferingTable } from "./OfferingTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Course Offerings" };

export default async function HodCourseOfferingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;
  const faculty = user.faculty;

  // Departmental scope comes from the master catalogue (Courses_UG sheet):
  // only courses hosted by the HoD's faculty + department may be offered.
  const catalogue = await getCoursesUG();
  const deptCourses = catalogue.filter(
    (c) => c.faculty === faculty && c.hostingDepartment === dept,
  );
  const deptCodes = deptCourses.map((c) => c.code);

  const [dbCourses, programmeIds, offerings] = await Promise.all([
    prisma.course.findMany({
      where: { code: { in: deptCodes } },
      orderBy: { code: "asc" },
    }),
    departmentProgrammeIds(dept ?? ""),
    prisma.courseOffering.findMany({
      where: { course: { code: { in: deptCodes } } },
      include: { course: true, programme: true },
      orderBy: [
        { academicSession: "desc" },
        { semester: "asc" },
        { level: "asc" },
        { course: { code: "asc" } },
      ],
    }),
  ]);
  const programmes = await prisma.programme.findMany({
    where: { id: { in: programmeIds } },
    orderBy: { name: "asc" },
  });

  const rows = offerings.map((o) => ({
    id: o.id,
    courseCode: o.course.code,
    courseTitle: o.course.title,
    units: o.course.units,
    programmeId: o.programmeId,
    programmeName: o.programme?.name ?? null,
    level: o.level,
    academicSession: o.academicSession,
    semester: o.semester,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));

  const activeCount = rows.filter((o) => o.status === "ACTIVE").length;
  const scoped = Boolean(faculty && dept);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Course Offerings"
        description="A course offering decides which programme, level, session and semester a course from the departmental catalogue is available to students. Offering a course is separate from Course Allocation — it does not assign lecturers."
      />

      <section aria-label="Stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total offerings" value={rows.length} hint="For your department" />
        <StatCard label="Active" value={activeCount} hint="Eligible for student registration" />
        <StatCard label="Inactive" value={rows.length - activeCount} hint="Paused; not eligible for registration" />
        <StatCard label="Programmes" value={programmes.length} hint="Programmes with students in your department" />
      </section>

      {!scoped ? (
        <EmptyState
          title="No departmental scope assigned"
          body="Your account has no faculty/department set. Contact the IT administrator or Registry to assign your department before managing course offerings."
        />
      ) : (
        <>
          <section>
            <SectionHeading
              title="Create a course offering"
              subtitle="The course catalogue defines the course; the offering defines where and when students can take it."
            />
            <OfferingCreationForm
              faculty={faculty ?? ""}
              department={dept ?? ""}
              sessions={academicSessions()}
              currentSession={CURRENT_SESSION}
              courses={dbCourses.map((c) => ({
                id: c.id,
                code: c.code,
                title: c.title,
                semester: c.semester,
                units: c.units,
              }))}
              programmes={programmes.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
              levels={departmentLevels(departmentMaxLevel(dept))}
            />
          </section>

          <section>
            <SectionHeading
              title="Department offerings"
              subtitle={`Offerings for ${dept} across ${programmes.length} programme(s). Only ACTIVE offerings are eligible for student registration.`}
            />
            {rows.length === 0 ? (
              <EmptyState
                title="No course offerings yet"
                body="Create your first offering above. Pick a course from the departmental catalogue, then the programme, level, session and semester it is offered in."
              />
            ) : (
              <OfferingTable
                offerings={rows}
                sessions={academicSessions()}
                programmes={programmes.map((p) => ({ id: p.id, name: p.name }))}
                levels={departmentLevels(departmentMaxLevel(dept))}
              />
            )}
          </section>
        </>
      )}

      <section>
        <SectionHeading title="HoD Quick Actions" subtitle="Jump to related work areas." />
        <div className="grid gap-3 sm:grid-cols-2">
          {HOD_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate/10 bg-white p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-light/5 dark:border-slate-200/15 dark:bg-slate-900"
            >
              <p className="font-semibold text-slate">{item.label}</p>
              <p className="mt-1 text-sm text-slate/60">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
