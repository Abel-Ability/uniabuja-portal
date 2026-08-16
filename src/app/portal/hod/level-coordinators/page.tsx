import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole, academicSessions, departmentMaxLevel } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { PageHeader } from "@/components/ui";
import { LevelCoordinatorsForm } from "./level-coordinators-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Level Coordinators" };

export default async function LevelCoordinatorsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department ?? "";
  const maxLevel = departmentMaxLevel(dept);

  const [lecturers, coordinators] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LECTURER", department: dept },
      select: { id: true, fullName: true, staffNo: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.levelCoordinator.findMany({
      where: { department: dept },
      include: { coordinator: { select: { id: true, fullName: true, staffNo: true } } },
      orderBy: [{ academicSession: "desc" }, { level: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Level Coordinators"
        description={`Assign a lecturer to coordinate each level of the department — 100 to ${maxLevel} level. Re-assigning a level replaces its current coordinator.`}
      />
      <LevelCoordinatorsForm
        department={dept}
        maxLevel={maxLevel}
        sessions={academicSessions()}
        lecturers={lecturers}
        coordinators={coordinators.map((c) => ({
          id: c.id,
          level: c.level,
          academicSession: c.academicSession,
          coordinatorId: c.coordinator?.id ?? "",
          coordinatorName: c.coordinator?.fullName ?? "—",
          staffNo: c.coordinator?.staffNo ?? null,
        }))}
      />
    </div>
  );
}
