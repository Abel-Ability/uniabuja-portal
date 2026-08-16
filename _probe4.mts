import { prisma } from "./src/lib/prisma";
async function main() {
  const cs = await prisma.user.findMany({
    where: { role: "STUDENT", department: "Physics" },
    select: { firstName: true, lastName: true, fullName: true, sex: true, dateOfBirth: true },
    take: 6,
  });
  console.log(JSON.stringify(cs, null, 1));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
