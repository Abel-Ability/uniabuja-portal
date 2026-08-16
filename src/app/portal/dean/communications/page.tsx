import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { facultyDepartments } from "@/lib/faculty";
import { FacultyAnnouncementForm } from "./faculty-announcement-form";
import {
  PageHeader,
  StatCard,
  SectionHeading,
  Table,
  StatusBadge,
  Badge,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faculty Communications" };

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

const CATEGORY_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  NEWS: "brand",
  NOTICE: "slate",
  DEADLINE: "gold",
  ADMISSION: "amber",
  GENERAL: "neutral",
};

const SCOPE_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  PUBLIC: "neutral",
  FACULTY: "brand",
  STUDENT: "brand",
  STAFF: "slate",
  ROLE: "gold",
};

const CHANNEL_TONES: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  IN_APP: "brand",
  EMAIL: "slate",
  SMS: "gold",
};

// Roles that make a ROLE-scoped announcement relevant to this faculty's
// students and staff.
const FACULTY_ROLES = ["DEAN", "HOD", "LECTURER", "STUDENT"];

function announcementIsFacultyRelevant(
  a: {
    scope: string;
    visibleToRoles: unknown;
    faculty: string | null;
  },
  faculty: string,
): boolean {
  const inFaculty = a.faculty == null || a.faculty === faculty;
  if (a.scope === "FACULTY") return a.faculty === faculty;
  if (a.scope === "PUBLIC") return true;
  if (a.scope === "STUDENT" || a.scope === "STAFF") return inFaculty;
  if (a.scope === "ROLE") {
    if (!inFaculty) return false;
    if (a.visibleToRoles == null) return false;
    if (Array.isArray(a.visibleToRoles)) {
      return a.visibleToRoles.some((r) => FACULTY_ROLES.includes(String(r)));
    }
    if (typeof a.visibleToRoles === "object") {
      const roles = Object.values(a.visibleToRoles as Record<string, unknown>);
      return roles.some((r) => FACULTY_ROLES.includes(String(r)));
    }
    return false;
  }
  return false;
}

export default async function DeanCommunicationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DEAN") redirect(landingForRole(session.user.role));

  const faculty = session.user.faculty;
  if (!faculty) redirect("/portal/dean");

  const departments = await facultyDepartments(faculty);

  const [announcements, notifications] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 100 }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: true },
    }),
  ]);

  const relevant = announcements
    .filter((a) => announcementIsFacultyRelevant(a, faculty))
    .slice(0, 50);

  const facultyNotifications = notifications
    .filter((n) => {
      const u = n.user;
      if (u.department && departments.includes(u.department)) return true;
      return u.faculty === faculty;
    })
    .slice(0, 50);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dean Workspace"
        title="Faculty Communications"
        description={`Publish announcements to ${faculty ?? "your faculty"} and review notices relevant to it. Faculty announcements are always scoped to ${faculty ?? "your faculty"} — never university-wide.`}
      />

      <section aria-label="Publish" className="rounded-2xl border border-slate/10 bg-white p-5 shadow-sm dark:border-slate-200/15 dark:bg-slate-900">
        <SectionHeading title="Publish a faculty announcement" subtitle="Create and publish immediately to your faculty. Announcements are attributed to you and recorded in the audit trail." />
        <div className="mt-4 max-w-3xl">
          <FacultyAnnouncementForm faculty={faculty} />
        </div>
      </section>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Announcements" value={nfmt(relevant.length)} hint="Relevant to this faculty" />
        <StatCard label="Notifications" value={nfmt(facultyNotifications.length)} hint="To faculty students & staff" />
        <StatCard label="Departments" value={nfmt(departments.length)} hint="In this faculty" />
        <StatCard label="Sent this window" value={nfmt(facultyNotifications.filter((n) => n.status === "SENT").length)} hint="Delivered on any channel" />
      </section>

      <section>
        <SectionHeading
          title="Announcements"
          subtitle="University-wide notices plus announcements scoped to this faculty."
        />
        {relevant.length === 0 ? (
          <EmptyState title="No announcements" body="Relevant announcements will appear here once published." />
        ) : (
          <Table headers={["Title", "Category", "Scope", "Faculty", "Published"]}>
            {relevant.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate">{a.title}</p>
                  <p className="max-w-md truncate text-xs text-slate/75">{a.body}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={CATEGORY_TONES[a.category] ?? "neutral"}>{a.category}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={SCOPE_TONES[a.scope] ?? "neutral"}>{a.scope}</Badge>
                </td>
                <td className="px-4 py-3 text-slate/70">{a.faculty ?? "University-wide"}</td>
                <td className="px-4 py-3 text-slate/70">
                  {a.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Notification log"
          subtitle="Latest notifications sent to students and staff in this faculty."
        />
        {facultyNotifications.length === 0 ? (
          <EmptyState title="No notifications yet" body="Notifications addressed to the faculty's students and staff will appear here." />
        ) : (
          <Table headers={["Recipient", "Department", "Channel", "Subject", "Status", "Sent"]}>
            {facultyNotifications.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-3 font-medium text-slate">{n.user.fullName}</td>
                <td className="px-4 py-3 text-slate">{n.user.department ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={CHANNEL_TONES[n.channel] ?? "neutral"}>{n.channel}</Badge>
                </td>
                <td className="px-4 py-3 text-slate/70">{n.subject}</td>
                <td className="px-4 py-3"><StatusBadge status={n.status} /></td>
                <td className="px-4 py-3 text-slate/70">
                  {n.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
