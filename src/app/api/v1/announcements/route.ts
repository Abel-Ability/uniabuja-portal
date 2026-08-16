import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSheetAnnouncements } from "@/lib/sheets";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lim = rateLimit(`announcements:${ip}`, 60, 60_000);
  if (!lim.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const [sheetItems, dbItems] = await Promise.all([
    getSheetAnnouncements(),
    prisma.announcement.findMany({
      where: {
        scope: "PUBLIC",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        publishedAt: true,
      },
    }),
  ]);

  const allItems = [...sheetItems, ...dbItems];
  const seen = new Set();
  const uniqueItems = allItems.filter((a) => {
    const key = a.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ count: uniqueItems.length, items: uniqueItems });
}
