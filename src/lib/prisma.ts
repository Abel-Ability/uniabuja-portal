import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// PostgreSQL via driver adapter (Prisma 7). Local development can point
// DATABASE_URL at a local/remote Postgres; see docs/MIGRATION.md.
//
// The Prisma CLI and the runtime adapter both resolve connection strings
// from DATABASE_URL, so the same value works for migrations and the app.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
