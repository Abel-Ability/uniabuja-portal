import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSheetAnnouncements } from "@/lib/sheets";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage() {
  const [sheetAnnouncements, dbAnnouncements] = await Promise.all([
    getSheetAnnouncements(),
    prisma.announcement.findMany({
      where: { scope: "PUBLIC", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
  ]);

  const announcements = sheetAnnouncements.length > 0 ? sheetAnnouncements : dbAnnouncements;

  return (
    <div className="bg-white dark:bg-slate-900">
      <PageHeader
        eyebrow="Public notices"
        title="Notices & Announcements"
        description="Official announcements from the University of Abuja. Role-specific notices are visible after signing in to the portal."
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
        {announcements.length === 0 ? (
          <Reveal>
            <Card>
              <p className="text-sm text-slate/75">No public notices right now.</p>
            </Card>
          </Reveal>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {announcements.map((a, i) => (
              <Reveal key={a.id} delay={Math.min(i, 5) * 90}>
                <Card className="card-lift flex h-full flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={a.category === "DEADLINE" ? "amber" : "neutral"}>
                      {a.category.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-xs text-slate/70">
                      {a.publishedAt.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <h2 className="font-head font-semibold text-slate">{a.title}</h2>
                  <p className="text-sm text-slate/70">{a.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
