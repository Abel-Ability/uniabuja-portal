import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// SQLite via driver adapter (Prisma 7). In production, swap the adapter for
// @prisma/adapter-pg pointing at PostgreSQL — schema and queries are unchanged.
//
// The Prisma CLI and the runtime adapter both resolve "file:" URLs against
// process.cwd(), so the same DATABASE_URL works for migrations and the app.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = createClient());

export type {
  User,
  Session,
  AuditLog,
  Application,
  Payment,
  CourseRegistration,
  Result,
} from "@/generated/prisma/client";
