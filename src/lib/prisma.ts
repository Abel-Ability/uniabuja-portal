import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and set DATABASE_URL.",
    );
  }
  const adapter = new PrismaPg({ connectionString: url });
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
