import type { Metadata } from "next";
import { PageHeader, Table, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { requireVC } from "../guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Communications" };

export default async function VcCommunicationsPage() {
  await requireVC();

  const announcements = await prisma.announcement.findMany({
    where: { scope: { in: ["PUBLIC", "STAFF", "ROLE"] } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Executive Management"
        title="Communications"
        description="University-wide announcements and notices"
      />

      <section>
        <SectionHeading title="Recent Announcements" subtitle="Latest notices scoped to your role" />
        {announcements.length === 0 ? (
          <EmptyState title="No announcements" body="No announcements for you right now." />
        ) : (
          <Table headers={["Category", "Title", "Body", "Published At"]}>
            {announcements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3"><Badge tone="neutral">{a.category.replaceAll("_", " ")}</Badge></td>
                <td className="px-4 py-3 font-medium text-slate">{a.title}</td>
                <td className="px-4 py-3">{a.body}</td>
                <td className="px-4 py-3">{a.publishedAt.toLocaleDateString("en-NG")}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
