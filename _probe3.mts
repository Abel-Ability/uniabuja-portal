import { prisma } from "./src/lib/prisma";
import { verifyChain } from "./src/lib/audit";

async function main() {
  const res = await verifyChain();
  console.log("chain", JSON.stringify(res));
  const total = await prisma.auditLog.count();
  console.log("audit rows", total);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
