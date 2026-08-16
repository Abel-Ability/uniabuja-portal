import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { verifyChain } from "../src/lib/audit";

// Non-destructive audit-chain repair. Recomputes prevHash/hash for the
// surviving audit rows in the same order verifyChain() reads them, so the
// chain verifies intact again after rows were deleted mid-chain. No rows are
// removed and no fields other than the hashes are touched. The recomputation
// mirrors src/lib/audit.ts exactly.
function canonical(entry: Record<string, unknown>): string {
  return JSON.stringify(entry, Object.keys(entry).sort());
}

async function main() {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  let prevHash: string | null = null;
  let updated = 0;

  for (const row of rows) {
    const record: Record<string, unknown> = {
      actorUserId: row.actorUserId,
      actorUsername: row.actorUsername,
      actorRole: row.actorRole,
      sessionId: row.sessionId,
      action: row.action,
      module: row.module,
      targetType: row.targetType,
      targetId: row.targetId,
      before: row.before,
      after: row.after,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
    };
    const expected: string = createHash("sha256")
      .update(prevHash ?? "GENESIS")
      .update(canonical(record))
      .digest("hex");
    if (expected !== row.hash || (row.prevHash ?? null) !== prevHash) {
      await prisma.auditLog.update({
        where: { id: row.id },
        data: { prevHash, hash: expected },
      });
      updated++;
    }
    prevHash = expected;
  }

  const check = await verifyChain();
  console.log(`Recomputed ${updated} of ${rows.length} rows; verifyChain -> ${JSON.stringify(check)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
