import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, PageHeader, StatCard, Badge } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION, CURRENT_SEMESTER, SEMESTER_LABELS, departmentMaxLevel, studentLevel } from "@/lib/constants";
import { getRegistrationForView, isRegistrationFinalised } from "@/lib/student-finalisation";
import { getSheetAnnouncements } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Student Dashboard" };

export default async function StudentDashboard() {
  const session = await requireSession();
  const { user } = session;

  const sessionKey = CURRENT_SESSION;
  const level = studentLevel(
    user.registrationNo,
    departmentMaxLevel(user.department),
  );

  const [existingRegistrations, completedCourses, announcements, currentRegistration] =
    await Promise.all([
      prisma.courseRegistration.findMany({
        where: { userId: user.id, academicSession: sessionKey },
        include: { course: true },
      }),
      prisma.result.count({
        where: {
          userId: user.id,
          gradeStatus: "FINAL",
          grade: { notIn: ["F", "P"] },
        },
      }),
      getSheetAnnouncements(),
      getRegistrationForView(user),
    ]);

  const locked = isRegistrationFinalised(currentRegistration);

  const totalRegisteredUnits = locked && currentRegistration
    ? currentRegistration.totalUnits
    : existingRegistrations.reduce(
        (sum, reg) => sum + reg.course.units,
        0,
      );

  const minimumUnits = 15;
  const hasMetMinimum = totalRegisteredUnits >= minimumUnits;
  const remainingUnits = Math.max(0, minimumUnits - totalRegisteredUnits);
  const registrationOpen = isRegistrationOpen();
  const semesterLabel = SEMESTER_LABELS[CURRENT_SEMESTER] ?? "this semester";

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      <PageHeader
        eyebrow="Student Portal"
        title="Welcome"
        description="Your personal student dashboard"
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-slate-400" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-600">{user.fullName}</p>
                  <p className="text-sm text-slate-500">
                    Registration No: {user.registrationNo || user.username}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-500">Programme</p>
                  <p className="font-medium text-slate-600">{user.programmeId || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Faculty</p>
                  <p className="font-medium text-slate-600">{user.faculty || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium text-slate-600">{user.department || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Level</p>
                  <p className="font-medium text-slate-600">{level || "—"}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-500">Category</p>
                  <p className="font-medium text-slate-600">{user.studentCategory || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Session</p>
                  <p className="font-medium text-slate-600">{sessionKey || "2025/2026"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Semester</p>
                  <p className="font-medium text-slate-600">{semesterLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50">
              <h3 className="font-semibold text-slate-600 mb-3">Current Status</h3>
              <div className="space-y-2">
                <div className="w-full">
                  {locked ? (
                    <Badge tone="red">FINAL / LOCKED</Badge>
                  ) : (
                    <Badge tone={registrationOpen ? "brand" : "neutral"}>
                      {registrationOpen ? "Registration Open" : "Registration Closed"}
                    </Badge>
                  )}
                </div>
                <div className="w-full">
                  <Badge tone="brand">{level ? `${level} Level` : "Level — —"}</Badge>
                </div>
                <div className="w-full">
                  <Badge tone="brand">{totalRegisteredUnits} Credit Units Registered</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Registered Credit Units"
            value={totalRegisteredUnits.toString()}
            hint={locked ? "Finalised and locked" : hasMetMinimum ? "Minimum requirement met" : `${remainingUnits} more units needed`}
          />
          <StatCard
            label="Current Level"
            value={level ? `${level}00` : "—"}
            hint="Academic level in programme"
          />
          <StatCard
            label="Minimum Required"
            value={minimumUnits}
            hint="Credit units required for registration"
          />
          <StatCard
            label="Registration Status"
            value={locked ? "FINAL" : registrationOpen ? "OPEN" : "CLOSED"}
            hint={locked ? "Finalised and locked" : "Course registration window"}
          />
        </div>

        {locked && currentRegistration ? (
          <Card className="p-6 sm:p-8">
            <div className="mb-4">
              <Badge tone="red">FINAL / LOCKED</Badge>
            </div>
            <h3 className="font-medium text-slate-600 mb-3">
              Registration Completed
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Your course registration for {sessionKey} {semesterLabel} has been
              finalised and locked with {currentRegistration.totalUnits} credit
              units. It can no longer be modified through the student interface.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-xs text-slate-400">Registration Reference</p>
                <p className="font-medium text-slate-700">
                  {currentRegistration.registrationReference}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="font-medium text-slate-700">FINAL / LOCKED</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/portal/student/view-registration"
                className="inline-flex items-center justify-center w-full gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
              >
                View Registration
              </Link>
              <Link
                href="/portal/student/view-registration?print=1"
                className="inline-flex items-center justify-center w-full gap-2 rounded-full border-2 border-brand-strong px-6 py-3 font-head text-sm font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
              >
                Print Registration
              </Link>
            </div>
          </Card>
        ) : (
          registrationOpen && (
          <Card className="p-6 sm:p-8">
            <h3 className="font-medium text-slate-600 mb-3">Course Registration</h3>
            <p className="text-sm text-slate-500 mb-4">
              Select eligible courses for {semesterLabel}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-slate-400">Session</p>
                <p className="font-medium text-slate-700">{sessionKey}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Semester</p>
                <p className="font-medium text-slate-700">{semesterLabel}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-400">Registered Units</p>
              <p className="font-medium text-slate-700">
                {totalRegisteredUnits}/{minimumUnits}
              </p>
              {totalRegisteredUnits < minimumUnits && (
                <p className="text-xs text-red-600 mt-1">
                  At least {minimumUnits} credit units are required
                </p>
              )}
            </div>

            {totalRegisteredUnits < minimumUnits && (
              <p className="text-sm text-red-500 mt-3">
                You must select at least {minimumUnits} credit units before submitting.
              </p>
            )}

            <Link
              href="/portal/student/course-registration"
              className="inline-flex items-center justify-center w-full gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
            >
              {totalRegisteredUnits < minimumUnits
                ? `Register (${totalRegisteredUnits}/${minimumUnits} units)`
                : "Continue Registration"}
            </Link>
          </Card>
          )
        )}

        {!registrationOpen && totalRegisteredUnits > 0 && (
          <Card className="p-6 sm:p-8">
            <h3 className="font-medium text-slate-600 mb-3">
              Registration Completed
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Course registration for this session is currently closed. Your
              registration was previously completed with {totalRegisteredUnits}
              credit units.
            </p>
            <Link
              href="/portal/student/course-registration"
              className="inline-flex items-center justify-center w-full gap-2 rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
            >
              View Registration
            </Link>
          </Card>
        )}

        <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/50">
          <h3 className="font-semibold text-slate-600 mb-4">Academic Progress</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Current Level</p>
              <p className="font-medium text-slate-600">{level || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Registered Courses</p>
              <p className="font-medium text-slate-600">
                {existingRegistrations.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Completed Courses</p>
              <p className="font-medium text-slate-600">{completedCourses}</p>
            </div>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-slate-600 mb-3">Announcements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900 border border-amber-200/50"
                >
                  <p className="font-medium text-slate-600">{ann.title}</p>
                  <p className="text-sm text-slate-500">
                    {(ann.body ?? "").substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isRegistrationOpen() {
  const now = new Date();
  return now.getMonth() >= 8 && now.getMonth() <= 11; // Sept - Dec
}
