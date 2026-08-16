import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, Table } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My Courses" };

export default async function MyCoursesPage() {
  const session = await requireSession();
  const { user } = session;
  const sessionKey = CURRENT_SESSION || "2025/2026";

  const [registrations, results] = await Promise.all([
    prisma.courseRegistration.findMany({
      where: {
        userId: user.id,
        academicSession: sessionKey,
        status: "ACTIVE",
      },
      include: { course: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.result.findMany({
      where: {
        userId: user.id,
        academicSession: sessionKey,
        gradeStatus: "FINAL",
      },
      include: { course: true },
    }),
  ]);

  const registeredCourses = registrations.map((reg) => ({
    code: reg.course.code,
    title: reg.course.title,
    units: reg.course.units,
    semester: reg.semester,
  }));

  const completedCourses = results
    .filter((r) => r.grade && r.grade !== "F" && r.grade !== "P")
    .map((r) => ({
      code: r.course.code,
      title: r.course.title,
      units: r.course.units,
      semester: r.semester,
      grade: r.grade ?? "—",
    }));

  const totalRegisteredUnits = registeredCourses.reduce(
    (sum, course) => sum + course.units,
    0,
  );

  const totalCompletedUnits = completedCourses.reduce(
    (sum, course) => sum + course.units,
    0,
  );

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      <PageHeader
        eyebrow="Student Portal"
        title="My Courses"
        description={`Registered and completed courses for ${sessionKey}`}
      />
      <Card className="p-6 mb-8">
        <h3 className="font-medium text-slate-600 mb-3">Currently Registered</h3>

        {registeredCourses.length === 0 ? (
          <p className="text-sm text-slate-500">
            No courses currently registered for {sessionKey}.
          </p>
        ) : (
          <Table headers={["Code", "Course Title", "Units", "Semester"]}>
            {registeredCourses.map((course) => (
              <tr key={course.code} className="border-b">
                <td className="px-4 py-3 font-medium text-slate">{course.code}</td>
                <td className="px-4 py-3">{course.title}</td>
                <td className="px-4 py-3 text-center">{course.units}</td>
                <td className="px-4 py-3 text-center">{course.semester === 1 ? "1st" : "2nd"}</td>
              </tr>
            ))}
          </Table>
        )}

        <div className="mt-4">
          <p className="text-sm text-slate-500">
            Total Registered Credit Units: {totalRegisteredUnits}
          </p>
        </div>

        {registeredCourses.length > 0 && (
          <Link
            href="/portal/student/course-registration"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
          >
            Add/Modify Courses
          </Link>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-medium text-slate-600 mb-3">Completed Courses</h3>

        {completedCourses.length === 0 ? (
          <p className="text-sm text-slate-500">
            No completed courses recorded yet.
          </p>
        ) : (
          <Table headers={["Code", "Course Title", "Units", "Semester", "Grade"]}>
            {completedCourses.map((course) => (
              <tr key={course.code} className="border-b">
                <td className="px-4 py-3 font-medium text-slate">{course.code}</td>
                <td className="px-4 py-3">{course.title}</td>
                <td className="px-4 py-3 text-center">{course.units}</td>
                <td className="px-4 py-3 text-center">{course.semester === 1 ? "1st" : "2nd"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={getGradeBadgeClass(course.grade)}>
                    {course.grade}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}

        <div className="mt-4">
          <p className="text-sm text-slate-500">
            Total Completed Credit Units: {totalCompletedUnits}
          </p>
        </div>

        {completedCourses.length > 0 && (
          <Link
            href="/portal/student/academic-progress"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
          >
            View Academic Progress
          </Link>
        )}
      </Card>
    </div>
  );

  function getGradeBadgeClass(grade: string | undefined) {
    const classes: Record<string, string> = {
      A: "bg-green-100 text-green-800",
      B: "bg-green-100 text-green-800",
      C: "bg-yellow-100 text-yellow-800",
      D: "bg-yellow-100 text-yellow-800",
      E: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      F: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      P: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };
    return classes[grade ?? ""] || "bg-slate-100 text-slate-700";
  }
}
