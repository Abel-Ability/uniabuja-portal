import { prisma } from "./src/lib/prisma";

async function main() {
  const withProg = await prisma.user.count({ where: { role: "STUDENT", programmeId: { not: null } } });
  console.log("students with programmeId:", withProg);
  const progStudents = await prisma.user.findMany({
    where: { role: "STUDENT", programmeId: { not: null } },
    select: { department: true, programmeId: true, programme: { select: { name: true } } },
    distinct: ["department"],
    take: 20,
  });
  console.log("depts with programme-linked students:", JSON.stringify(progStudents.map((p) => p.department)));

  const deptCounts = await prisma.user.groupBy({
    by: ["department"],
    where: { role: "STUDENT" },
    _count: { _all: true },
    orderBy: { _count: { department: "desc" } },
    take: 6,
  });
  console.log("largest depts:", JSON.stringify(deptCounts.map((d) => [d.department, d._count._all])));

  const phys = await prisma.user.findMany({
    where: { role: "STUDENT", department: "Physics" },
    select: { registrationNo: true, status: true, studentCategory: true },
    take: 10,
  });
  console.log("Physics sample:", JSON.stringify(phys));

  const byCat = await prisma.user.groupBy({ by: ["studentCategory"], where: { role: "STUDENT" }, _count: { _all: true } });
  console.log("categories:", JSON.stringify(byCat));
  const byStatus = await prisma.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: { _all: true } });
  console.log("statuses:", JSON.stringify(byStatus));

  const programmes = await prisma.programme.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 10 });
  console.log("programmes sample:", JSON.stringify(programmes.map((p) => p.name)));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
