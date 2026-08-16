import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, academicSessions } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { getCoursesUG } from "@/lib/sheets";
import { PageHeader } from "@/components/ui";
import { CourseAllocationForm } from "./course-allocation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Course Allocation" };

export default async function CourseAllocationPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;

  const catalogue = await getCoursesUG();
  const deptCourses = catalogue
    .filter((c) => c.faculty === user.faculty && c.hostingDepartment === user.department)
    .map((c) => ({ code: c.code, title: c.title, semester: c.semester, units: c.unit }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const [lecturers, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LECTURER", department: dept },
      select: { id: true, fullName: true, staffNo: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.courseAssignment.findMany({
      where: { department: dept ?? undefined },
      include: {
        lecturer: { select: { id: true, fullName: true } },
        teamMembers: { include: { lecturer: { select: { id: true, fullName: true } } } },
      },
      orderBy: [{ academicSession: "desc" }, { semester: "asc" }, { courseCode: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Course Allocation"
        description="Assign courses to lecturers for a session and semester. Courses come from the departmental course list (Courses_UG) filtered by faculty, department and semester. Each course has a main lecturer, with optional co-lecturers."
      />
      <CourseAllocationForm
        faculty={user.faculty ?? ""}
        department={dept ?? ""}
        sessions={academicSessions()}
        courses={deptCourses}
        lecturers={lecturers}
        assignments={assignments.map((a) => ({
          id: a.id,
          courseCode: a.courseCode,
          courseTitle: a.courseTitle,
          academicSession: a.academicSession,
          semester: a.semester,
          lecturerId: a.lecturer?.id ?? "",
          lecturerName: a.lecturer?.fullName ?? "—",
          teamMembers: a.teamMembers.map((m) => ({
            id: m.id,
            lecturerId: m.lecturer?.id ?? "",
            lecturerName: m.lecturer?.fullName ?? "—",
          })),
        }))}
      />
    </div>
  );
}
