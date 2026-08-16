import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSbcChairman } from "../guard";
import { PageHeader, SectionHeading, Table, Badge, EmptyState } from "@/components/ui";
import { SenateAnnouncementForm } from "./senate-announcement-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Senate Communications" };

const SCOPE_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  STAFF: "slate",
  ROLE: "gold",
};

export default async function SbcCommunicationsPage() {
  const session = await requireSbcChairman();

  const announcements = await prisma.announcement.findMany({
    where: { scope: { in: ["STAFF", "ROLE"] } },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });

  const publishedByChairman = announcements.filter((a) => a.authorId === session.userId).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Senate Business Committee"
        title="Senate Communications"
        description="Publish announcements to staff or Senate roles and review Senate-scoped notices. Announcements are attributed to you and recorded in the audit trail."
      />

      <section aria-label="Publish" className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
        <SectionHeading
          title="Publish a Senate announcement"
          subtitle="Create and publish immediately. Senate announcements are never PUBLIC — they stay inside the institution."
        />
        <div className="mt-4 max-w-3xl">
          <SenateAnnouncementForm />
        </div>
      </section>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Announcements</p>
          <p className="font-head text-2xl font-bold text-slate">{announcements.length}</p>
          <p className="text-xs text-slate/75">Institution-scoped Senate notices</p>
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Published by you</p>
          <p className="font-head text-2xl font-bold text-slate">{publishedByChairman}</p>
          <p className="text-xs text-slate/75">Attributed to your account</p>
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Audience</p>
          <p className="font-head text-2xl font-bold text-slate">STAFF · ROLE</p>
          <p className="text-xs text-slate/75">Never public homepage</p>
        </div>
      </section>

      <section>
        <SectionHeading
          title="Senate announcements"
          subtitle="Announcements published to staff or Senate roles."
        />
        {announcements.length === 0 ? (
          <EmptyState title="No Senate announcements" body="Published announcements will appear here." />
        ) : (
          <Table headers={["Title", "Scope", "Roles", "Published"]}>
            {announcements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{a.title}</p>
                  <p className="max-w-md truncate text-xs text-slate/75">{a.body}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={SCOPE_TONES[a.scope] ?? "neutral"}>{a.scope}</Badge>
                </td>
                <td className="px-4 py-3 text-slate/70">
                  {a.scope === "ROLE" && Array.isArray(a.visibleToRoles)
                    ? (a.visibleToRoles as unknown[]).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate/70">
                  {a.publishedAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
