import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "uniabuja-portal-api",
    version: "v1",
    time: new Date().toISOString(),
    checks: { database: await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false) },
  });
}
