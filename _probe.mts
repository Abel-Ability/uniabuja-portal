import { prisma } from "@/lib/prisma";

async function main() {
  const counts = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", department: "Computer Science" } }),
    prisma.user.count({ where: { role: "HOD" } }),
  ]);
  console.log("students total", counts[0], "| CS dept", counts[1], "| HODs", counts[2]);
  const depts = await prisma.user.findMany({ where: { role: "STUDENT" }, distinct: ["department"], select: { department: true } });
  console.log("student depts", depts.map((d) => d.department).join(" | "));
  const hod = await prisma.user.findFirst({
    where: { role: "HOD", department: "Computer Science" },
    select: { username: true, fullName: true, department: true, faculty: true },
  });
  console.log("HOD demo", JSON.stringify(hod));
  const cs = await prisma.user.findMany({
    where: { role: "STUDENT", department: "Computer Science" },
    select: { registrationNo: true, status: true, studentCategory: true, programmeId: true, programme: { select: { name: true } } },
    take: 5,
  });
  console.log("CS sample", JSON.stringify(cs, null, 1));
  const lc = await prisma.levelCoordinator.findMany({ where: { department: "Computer Science" }, select: { level: true, academicSession: true, coordinator: { select: { fullName: true } } } });
  console.log("coordinators", JSON.stringify(lc));
  const la = await prisma.levelAdvisorAssignment.findMany({ where: { department: "Computer Science" }, select: { level: true, academicSession: true, programmeId: true, status: true, adviser: { select: { fullName: true } } } });
  console.log("advisers", JSON.stringify(la));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
