"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Card, Table, PillButton } from "@/components/ui";
import { submitCourseRegistration } from "@/lib/module-actions";

export type EligibleCourse = {
  id: string;
  code: string;
  title: string;
  units: number;
  semester: number;
  level: number;
};

type Props = {
  courses: EligibleCourse[];
  alreadyRegistered: Set<string>;
  sessionKey: string;
  currentSemester: number;
  minimumUnits: number;
};

export function CourseRegistrationForm({
  courses,
  alreadyRegistered,
  sessionKey,
  currentSemester,
  minimumUnits,
}: Props) {
  const [state, action, pending] = useActionState(submitCourseRegistration, null);
  const [selected, setSelected] = useState<Map<string, EligibleCourse>>(new Map());

  const totalUnits = Array.from(selected.values()).reduce(
    (sum, c) => sum + c.units,
    0,
  );
  const canSubmit = totalUnits >= minimumUnits;
  const success = state?.ok === true;

  function toggle(course: EligibleCourse) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(course.code)) next.delete(course.code);
      else next.set(course.code, course);
      return next;
    });
  }

  if (success) {
    return (
      <Card className="p-6">
        <h3 className="font-medium text-slate-600 mb-2">
          Registration finalised and locked
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Your course registration for {sessionKey} has been submitted,
          finalised and locked. {state.reference ? `Your registration reference is ${state.reference}.` : ""}{" "}
          All selected courses were registered together as one atomic batch.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/portal/student/view-registration"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-2 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
          >
            View Registration
          </Link>
          <Link
            href="/portal/student/view-registration?print=1"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-strong px-6 py-2 font-head text-sm font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
          >
            Print Registration
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400">Selected Courses</p>
            <p className="font-medium text-slate-600">{selected.size}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Units</p>
            <p className="font-medium text-slate-600">{totalUnits}</p>
          </div>
        </div>
        {totalUnits < minimumUnits && (
          <p className="text-xs text-red-500 mt-1">
            At least {minimumUnits} credit units required
          </p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-medium text-slate-600 mb-4">Eligible Courses</h3>
        <p className="text-sm text-slate-500 mb-4">
          Only courses with an ACTIVE Course Offering for your programme, level,
          session ({sessionKey}) and semester (Semester {currentSemester}) are
          shown. Your level is derived from your registration number.
        </p>

        {courses.length === 0 && (
          <p className="text-sm text-slate-500">
            No courses are currently offered to you. Please contact your
            department — your Head of Department publishes offerings for your
            programme, level, session and semester.
          </p>
        )}

        {courses.length > 0 && (
          <Table headers={["Select", "Code", "Course Title", "Level", "Semester", "Units"]}>
            {courses.map((course) => {
              const isTaken = alreadyRegistered.has(course.code);
              const isSelected = selected.has(course.code);
              return (
                <tr
                  key={course.code}
                  className="border-b transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="courseId"
                      value={course.id}
                      checked={isSelected}
                      disabled={isTaken}
                      onChange={() => toggle(course)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate">{course.code}</td>
                  <td className="px-4 py-3 truncate">{course.title}</td>
                  <td className="px-4 py-3 text-center">{course.level}</td>
                  <td className="px-4 py-3 text-center">
                    {course.semester === 1 ? "1st" : "2nd"}
                  </td>
                  <td className="px-4 py-3 text-center">{course.units}</td>
                </tr>
              );
            })}
          </Table>
        )}

        <div className="mt-4 p-3 bg-slate-50 rounded-lg dark:bg-slate-800/70">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <strong>Minimum Required:</strong> {minimumUnits} credit units
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            <strong>Selected:</strong> {totalUnits} credit units
          </p>
          {totalUnits < minimumUnits && (
            <p className="text-xs text-red-500 mt-1">
              You need {minimumUnits - totalUnits} more credit unit(s)
            </p>
          )}
          {totalUnits >= minimumUnits && (
            <p className="text-xs text-green-600 mt-1">
              Minimum requirement met ✓
            </p>
          )}
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="p-6">
          <h3 className="font-medium text-slate-600 mb-4">Confirm Registration</h3>
          <p className="text-sm text-slate-500 mb-4">
            All selected courses are submitted together as one atomic batch. If
            any course is not eligible, none of them are registered.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-xs text-slate-400">Session</p>
              <p className="font-medium text-slate-700">{sessionKey}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Courses Selected</p>
              <p className="font-medium text-slate-600">
                {selected.size} courses, {totalUnits} credit units
              </p>
            </div>
          </div>

          <PillButton
            type="submit"
            className="w-full"
            disabled={pending || !canSubmit}
          >
            {pending
              ? "Submitting…"
              : `Submit Registration (${totalUnits}/${minimumUnits}+ units)`}
          </PillButton>

          {state?.error && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200/50 dark:bg-red-950/40 dark:border-red-800/50">
              <p className="font-medium text-red-600">{state.error}</p>
            </div>
          )}
        </Card>
      )}
    </form>
  );
}
