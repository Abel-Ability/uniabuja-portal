import type { Metadata } from "next";
import { Card, PageHeader, Table } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic Progress" };

export default async function AcademicProgressPage() {
  const session = await requireSession();
  const { user } = session;
  const sessionKey = CURRENT_SESSION || "2025/2026";

  const [registrations, results] = await Promise.all([
    prisma.courseRegistration.findMany({
      where: { userId: user.id, academicSession: sessionKey, status: "ACTIVE" },
      include: { course: true },
    }),
    prisma.result.findMany({
      where: { userId: user.id, academicSession: sessionKey, gradeStatus: "FINAL" },
      include: { course: true },
    }),
  ]);

  const registeredUnits = registrations.reduce(
    (sum, reg) => sum + reg.course.units,
    0,
  );

  let totalQualityPoints = 0;
  let totalUnits = 0;
  let passedCourses = 0;

  const gradePoints: Record<string, number> = {
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    E: 1,
    F: 0,
    P: 0,
  };
  results.forEach((result) => {
    const gp = result.grade ? gradePoints[result.grade] || 0 : 0;
    totalQualityPoints += gp * result.course.units;
    totalUnits += result.course.units;
    if (result.grade && result.grade !== "F" && result.grade !== "P") {
      passedCourses++;
    }
  });

  const cgpa =
    totalUnits > 0 ? Math.round((totalQualityPoints / totalUnits) * 100) / 100 : 0;

  const completedCourseCodes = new Set(results.map((r) => r.course.code));
  const outstandingCourses = registrations.filter(
    (reg) => !completedCourseCodes.has(reg.course.code),
  ).length;

  const currentLevel = calculateLevel(user.registrationNo ?? "");

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      <PageHeader
        eyebrow="Student Portal"
        title="Academic Progress"
        description="Your programme progress and performance"
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Current Level"
            value={currentLevel >= 400 ? "400+" : `${currentLevel}`}
            hint="Academic level in your programme"
          />
          <StatCard
            title="Registered Units"
            value={String(registeredUnits)}
            hint="Credit units currently registered"
          />
          <StatCard
            title="Completed Units"
            value={String(totalUnits)}
            hint="Credit units successfully completed"
          />
          <StatCard
            title="CGPA"
            value={cgpa.toString()}
            hint="Cumulative Grade Point Average"
          />
        </div>

        <Card className="p-6 mb-8">
          <h3 className="font-medium text-slate-600 mb-3">Course Status</h3>

          <Table headers={["Status", "Courses", "Units"]}>
            <tr>
              <td className="px-4 py-3">Registered</td>
              <td className="px-4 py-3">
                {registrations.length}
              </td>
              <td className="px-4 py-3">
                {registeredUnits}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3">Completed</td>
              <td className="px-4 py-3">
                {passedCourses}
              </td>
              <td className="px-4 py-3">
                {totalUnits}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3">Outstanding</td>
              <td className="px-4 py-3">
                {outstandingCourses}
              </td>
              <td className="px-4 py-3">
                {registeredUnits - totalUnits}
              </td>
            </tr>
          </Table>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-slate-600 mb-3">Performance Summary</h3>

          {cgpa > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Current CGPA: <strong>{cgpa}</strong>
              </p>
              <p className="text-sm text-slate-500">
                Courses Passed: <strong>{passedCourses}</strong>
              </p>
              <p className="text-sm text-slate-500">
                Outstanding Courses: <strong>{outstandingCourses}</strong>
              </p>
            </div>
          )}

          {cgpa === 0 && (
            <p className="text-sm text-slate-500">
              No grade results available yet. Results are published after Senate
              approval.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function calculateLevel(regNo: string): number {
  if (!regNo) return 0;
  try {
    const match = regNo.match(/^(\d{2})/);
    if (!match) return 0;
    const yy = parseInt(match[1], 10);
    const admissionYear = yy <= 50 ? 2000 + yy : 1900 + yy;
    const currentYear = new Date().getFullYear();
    const level = Math.max(100, (currentYear - admissionYear + 1) * 100);
    return level;
  } catch {
    return 100;
  }
}

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">
        {title}
      </p>
      <p className="font-head text-2xl font-bold text-slate">{value}</p>
      {hint ? <p className="text-xs text-slate/75">{hint}</p> : null}
    </div>
  );
}
