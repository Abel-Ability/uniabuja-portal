import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import type { RequestMeta } from "./session";

// Mandatory audit trail — append-only, hash-chained, user-attributable.
// There is no route/action in the application that updates or deletes rows
// in this table, and the DB role used by the app has no UPDATE/DELETE grant.

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "SUBMIT"
  | "PAY"
  | "EXPORT"
  | "VERIFY"
  | "CONFIG"
  | "REVOKE"
  | "STEP_UP"
  | "AUTH_FAIL"
  | "MFA_FAIL";

type AuditInput = {
  action: AuditAction;
  module: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta | null;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorRole?: string | null;
  sessionId?: string | null;
};

function canonical(entry: Record<string, unknown>): string {
  return JSON.stringify(entry, Object.keys(entry).sort());
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const last = await prisma.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const record: Record<string, unknown> = {
    actorUserId: input.actorUserId ?? null,
    actorUsername: input.actorUsername ?? null,
    actorRole: input.actorRole ?? null,
    sessionId: input.sessionId ?? null,
    action: input.action,
    module: input.module,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.meta?.ip ?? null,
    userAgent: input.meta?.userAgent ?? null,
    createdAt: new Date().toISOString(),
  };

  const prevHash = last?.hash ?? null;
  const hash = createHash("sha256")
    .update(prevHash ? prevHash : "GENESIS")
    .update(canonical(record))
    .digest("hex");

  await prisma.auditLog.create({
    data: {
      actorUserId: record.actorUserId as string | null,
      actorUsername: record.actorUsername as string | null,
      actorRole: record.actorRole as string | null,
      sessionId: record.sessionId as string | null,
      action: record.action as string,
      module: record.module as string,
      targetType: record.targetType as string | null,
      targetId: record.targetId as string | null,
      before: (record.before as object) ?? undefined,
      after: (record.after as object) ?? undefined,
      ip: record.ip as string | null,
      userAgent: record.userAgent as string | null,
      prevHash,
      hash,
      // Store the exact timestamp that was hashed so the chain can be
      // recomputed from the row without drift from the DB default.
      createdAt: new Date(record.createdAt as string),
    },
  });
}

// Verify the chain integrity (used by the DPO/audit review view).
export async function verifyChain(): Promise<{
  count: number;
  intact: boolean;
}> {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  let prevHash: string | null = null;
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
    if (expected !== row.hash) return { count: rows.length, intact: false };
    prevHash = row.hash;
  }
  return { count: rows.length, intact: true };
}
