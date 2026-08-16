import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION, CURRENT_SEMESTER, SEMESTER_LABELS } from "@/lib/constants";
import { getEligibleStudentCourseOfferings, MIN_REGISTRATION_UNITS } from "@/lib/student-registration";
import { getRegistrationForView, isRegistrationFinalised } from "@/lib/student-finalisation";
import { CourseRegistrationForm } from "./CourseRegistrationForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Course Registration" };

export default async function CourseRegistrationPage() {
  const session = await requireSession();
  const { user } = session;

  const [eligible, existingRegistrations, currentRegistration] = await Promise.all([
    getEligibleStudentCourseOfferings(user),
    prisma.courseRegistration.findMany({
      where: { userId: user.id, academicSession: CURRENT_SESSION },
      include: { course: true },
    }),
    getRegistrationForView(user),
  ]);

  const locked = isRegistrationFinalised(currentRegistration);
  const alreadyRegistered = new Set(
    existingRegistrations
      .filter((r) => r.status === "ACTIVE")
      .map((r) => r.course.code),
  );

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      <PageHeader
        eyebrow="Student Portal"
        title="Course Registration"
        description={
          locked
            ? "Your registration is finalised and locked"
            : `Select your courses for ${CURRENT_SESSION} ${SEMESTER_LABELS[CURRENT_SEMESTER]}`
        }
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {locked && currentRegistration ? (
          <Card className="p-6 sm:p-8">
            <div className="mb-4">
              <Badge tone="red">FINAL / LOCKED</Badge>
            </div>
            <h3 className="font-medium text-slate-600 mb-3">
              Your course registration for {CURRENT_SESSION}{" "}
              {SEMESTER_LABELS[CURRENT_SEMESTER]} has been finalised and locked.
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Your registered courses can no longer be modified through the
              student interface. If you need to change your registration, contact
              your department.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-400">Registration Reference</p>
                <p className="font-medium text-slate-700">
                  {currentRegistration.registrationReference}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Credit Units</p>
                <p className="font-medium text-slate-700">
                  {currentRegistration.totalUnits}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Academic Session</p>
                <p className="font-medium text-slate-700">
                  {currentRegistration.academicSession} ·{" "}
                  {SEMESTER_LABELS[currentRegistration.semester]}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/portal/student/view-registration"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
              >
                View Registration
              </Link>
              <Link
                href="/portal/student/view-registration?print=1"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-strong px-6 py-3 font-head text-sm font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
              >
                Print Registration
              </Link>
            </div>
          </Card>
        ) : (
          <CourseRegistrationForm
            courses={eligible.map((o) => ({
              id: o.course.id,
              code: o.course.code,
              title: o.course.title,
              units: o.course.units,
              semester: o.semester,
              level: o.level,
            }))}
            alreadyRegistered={alreadyRegistered}
            sessionKey={CURRENT_SESSION}
            currentSemester={CURRENT_SEMESTER}
            minimumUnits={MIN_REGISTRATION_UNITS}
          />
        )}
      </div>
    </div>
  );
}
