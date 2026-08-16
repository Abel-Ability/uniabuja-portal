import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSheetDeadlines } from "@/lib/sheets";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lim = rateLimit(`deadline:${ip}`, 60, 60_000);
  if (!lim.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Same source-of-truth as the homepage previously used: prefer the Google
  // Sheets Academic_Calendar tab and fall back to the database.
  const now = new Date();
  const sheetDeadlines = await getSheetDeadlines();
  let deadline = sheetDeadlines.find((d) => new Date(d.endsOn) >= now) ?? null;

  if (!deadline) {
    const db = await prisma.academicCalendarEntry.findFirst({
      where: { published: true, scope: "PUBLIC", endsOn: { gte: now } },
      orderBy: { startsOn: "asc" },
      select: { title: true, endsOn: true },
    });
    if (db) deadline = { title: db.title, endsOn: db.endsOn.toISOString() };
  }

  return NextResponse.json({ deadline });
}
