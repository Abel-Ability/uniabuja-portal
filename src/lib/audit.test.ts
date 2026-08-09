import { describe, it, expect } from "vitest";
import { prisma } from "./prisma";
import { writeAudit, verifyChain } from "./audit";

// Integration test against the local SQLite demo database.
describe("audit chain", () => {
  it("appends hash-linked records that verify intact", async () => {
    const before = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 2 });

    await writeAudit({
      action: "CONFIG",
      module: "AUTH",
      targetType: "TEST",
      targetId: "audit-chain-test",
      actorUsername: "test-runner",
    });

    const after = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 2 });
    expect(after[0].prevHash).toBe(before[0]?.hash ?? null);
    expect(after[0].hash).toMatch(/^[0-9a-f]{64}$/);

    const result = await verifyChain();
    expect(result.intact).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it("detects tampering of a logged record", async () => {
    // append a sacrificial record and tamper with it, then restore
    await writeAudit({
      action: "READ",
      module: "AUTH",
      targetType: "TEST",
      targetId: "tamper-test",
      actorUsername: "test-runner",
    });

    const target = await prisma.auditLog.findFirst({
      where: { targetId: "tamper-test" },
      orderBy: { createdAt: "desc" },
    });
    expect(target).toBeTruthy();
    const original = target!.module;

    try {
      await prisma.auditLog.update({
        where: { id: target!.id },
        data: { module: "TAMPERED" },
      });
      const result = await verifyChain();
      expect(result.intact).toBe(false);
    } finally {
      await prisma.auditLog.update({
        where: { id: target!.id },
        data: { module: original },
      });
    }

    const restored = await verifyChain();
    expect(restored.intact).toBe(true);
  });
});
