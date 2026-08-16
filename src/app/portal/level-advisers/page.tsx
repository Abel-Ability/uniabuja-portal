import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, academicSessions, departmentMaxLevel } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { PageHeader } from "@/components/ui";
import { LevelAdvisersForm } from "../hod/level-advisers/level-advisers-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Level Advisers" };

export default async function LevelAdvisersPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role) && session.user.role !== "DIRECTOR_ACADEMIC_PLANNING") {
    redirect(landingForRole(session.user.role));
  }

  const params = await searchParams;
  const dept =
    isHodRole(session.user.role)
      ? (session.user.department ?? "")
      : String(params.dept ?? "").trim();
  const isDirector = session.user.role === "DIRECTOR_ACADEMIC_PLANNING";

  const departments = isDirector
    ? (
        await prisma.user.findMany({
          where: { role: { in: ["LECTURER", "HOD"] }, department: { not: null } },
          distinct: ["department"],
          select: { department: true },
        })
      )
        .map((d) => d.department as string)
        .sort()
    : [];

  const activeDept = isDirector && !dept && departments.length ? departments[0] : dept;
  const maxLevel = activeDept ? departmentMaxLevel(activeDept) : 0;

  const [lecturers, programmes, assignments] = activeDept
    ? await Promise.all([
        prisma.user.findMany({
          where: { role: "LECTURER", department: activeDept },
          select: { id: true, fullName: true, staffNo: true },
          orderBy: { lastName: "asc" },
        }),
        prisma.programme.findMany({
          where: { users: { some: { department: activeDept, studentCategory: "UNDERGRADUATE" } } },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        }),
        prisma.levelAdvisorAssignment.findMany({
          where: { department: activeDept },
          include: {
            adviser: { select: { id: true, fullName: true, staffNo: true } },
            programme: { select: { name: true, code: true } },
          },
          orderBy: [{ academicSession: "desc" }, { level: "asc" }],
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isDirector ? "University Administration" : "HoD Workspace"}
        title="Level Advisers"
        description={
          activeDept
            ? `Assign a lecturer as the level adviser for each level of ${activeDept} — 100 to ${maxLevel} level. Re-assigning a scope deactivates the previous adviser and keeps the history.`
            : "Select a department to manage its level advisers."
        }
      />

      {isDirector ? (
        <form method="GET" className="flex max-w-md items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm font-semibold text-slate">
            Department
            <select
              name="dept"
              onChange={(e) => e.target.form?.requestSubmit()}
              className="rounded-xl border border-slate/25 px-4 py-2.5 text-sm"
            >
              {departments.map((d) => (
                <option key={d} value={d} selected={d === activeDept}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </form>
      ) : null}

      {activeDept ? (
        <LevelAdvisersForm
          department={activeDept}
          maxLevel={maxLevel}
          sessions={academicSessions()}
          lecturers={lecturers}
          programmes={programmes}
          assignments={assignments.map((a) => ({
            id: a.id,
            level: a.level,
            academicSession: a.academicSession,
            status: a.status,
            programmeId: a.programmeId,
            programmeName: a.programme ? `${a.programme.name} (${a.programme.code})` : null,
            adviserId: a.adviser?.id ?? "",
            adviserName: a.adviser?.fullName ?? "—",
            staffNo: a.adviser?.staffNo ?? null,
            notes: a.notes,
          }))}
        />
      ) : (
        <p className="text-sm text-slate/70">No departments available.</p>
      )}
    </div>
  );
}
