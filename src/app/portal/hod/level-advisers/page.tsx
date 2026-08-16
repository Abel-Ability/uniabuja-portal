import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, academicSessions, departmentMaxLevel } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { PageHeader } from "@/components/ui";
import { LevelAdvisersForm } from "./level-advisers-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Level Advisers" };

export default async function LevelAdvisersPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department ?? "";
  const maxLevel = departmentMaxLevel(dept);

  const [lecturers, programmes, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LECTURER", department: dept },
      select: { id: true, fullName: true, staffNo: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.programme.findMany({
      where: { users: { some: { department: dept, studentCategory: "UNDERGRADUATE" } } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.levelAdvisorAssignment.findMany({
      where: { department: dept },
      include: {
        adviser: { select: { id: true, fullName: true, staffNo: true } },
        programme: { select: { name: true, code: true } },
      },
      orderBy: [{ academicSession: "desc" }, { level: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Level Advisers"
        description={`Assign a lecturer as the level adviser for each level of the department — 100 to ${maxLevel} level, for a session and (optionally) a single programme. Re-assigning a scope deactivates the previous adviser and keeps the history.`}
      />
      <LevelAdvisersForm
        department={dept}
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
    </div>
  );
}
