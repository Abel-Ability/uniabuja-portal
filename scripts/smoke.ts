import { prisma } from "../src/lib/prisma";

async function m() {
  const u = await prisma.user.count();
  const r = await prisma.result.count();
  const s = await prisma.application.count();
  console.log({ users: u, results: r, applications: s });
  await prisma.$disconnect();
}
m();
