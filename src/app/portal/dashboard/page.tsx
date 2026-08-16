import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  ROLE_LABELS,
  can,
  MODULE_LABELS,
} from "@/lib/constants";
import {
  Card,
  StatCard,
  Badge,
  SectionHeading,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

async function statsFor(role: string, userId: string) {
  const s: Record<string, { label: string; value: number | string; hint?: string }> = {};
  const [openTickets] = await Promise.all([
    prisma.helpTicket.count({ where: { userId, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);
  s.tickets = { label: "Open tickets", value: openTickets };

  switch (role) {
    case "APPLICANT": {
      const app = await prisma.application.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { offers: true },
      });
      s.appStatus = {
        label: "Application status",
        value: app?.status.replaceAll("_", " ") ?? "None yet",
      };
      s.offers = { label: "Offers received", value: app?.offers.length ?? 0 };
      break;
    }
    case "STUDENT": {
      const [unpaid, regs, transcripts, lastResult] = await Promise.all([
        prisma.invoice.count({ where: { userId, status: "OUTSTANDING" } }),
        prisma.courseRegistration.count({ where: { userId } }),
        prisma.transcriptRequest.count({ where: { userId, status: "PROCESSING" } }),
        prisma.result.findFirst({ where: { userId }, orderBy: { semester: "desc" } }),
      ]);
      s.unpaid = { label: "Outstanding fees", value: unpaid, hint: "Unpaid invoices" };
      s.regs = { label: "Courses registered", value: regs };
      s.transcripts = { label: "Transcripts in progress", value: transcripts };
      s.cgpa = {
        label: "Latest result",
        value: lastResult ? `${lastResult.grade ?? "—"} (${lastResult.total ?? "—"})` : "None",
      };
      break;
    }
    case "LECTURER": {
      const [pending, approved] = await Promise.all([
        prisma.result.count({ where: { submittedById: userId, gradeStatus: "SUBMITTED" } }),
        prisma.result.count({ where: { submittedById: userId, gradeStatus: "FINAL" } }),
      ]);
      s.pending = { label: "Results awaiting approval", value: pending };
      s.approved = { label: "Results finalised", value: approved };
      break;
    }
    case "HOD": {
      const [pending] = await Promise.all([
        prisma.result.count({ where: { gradeStatus: "SUBMITTED" } }),
      ]);
      s.pending = { label: "Results awaiting HOD approval", value: pending };
      break;
    }
    case "REGISTRY": {
      const [screening, admitted] = await Promise.all([
        prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS"] } } }),
        prisma.application.count({ where: { status: "ADMITTED" } }),
      ]);
      s.screening = { label: "Applications to screen", value: screening };
      s.admitted = { label: "Admitted", value: admitted };
      break;
    }
    case "BURSARY": {
      const [openInv, pendingWaivers] = await Promise.all([
        prisma.invoice.count({ where: { status: "OUTSTANDING" } }),
        prisma.waiver.count({ where: { status: "PENDING" } }),
      ]);
      s.openInv = { label: "Open invoices", value: openInv };
      s.waivers = { label: "Waivers pending", value: pendingWaivers };
      break;
    }
    case "STUDENT_AFFAIRS": {
      const [hostels, maintenance] = await Promise.all([
        prisma.hostelApplication.count({ where: { status: "PENDING" } }),
        prisma.maintenanceRequest.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      ]);
      s.hostels = { label: "Hostel apps pending", value: hostels };
      s.maintenance = { label: "Maintenance open", value: maintenance };
      break;
    }
    case "EXAMS_RECORDS": {
      const [toApprove, transcripts] = await Promise.all([
        prisma.result.count({ where: { gradeStatus: "HOD_APPROVED" } }),
        prisma.transcriptRequest.count({ where: { status: "PROCESSING" } }),
      ]);
      s.toApprove = { label: "Results to finalise", value: toApprove };
      s.transcripts = { label: "Transcripts processing", value: transcripts };
      break;
    }
    case "PG_SCHOOL": {
      const [apps, theses] = await Promise.all([
        prisma.pGApplication.count({ where: { screeningStatus: { in: ["SUBMITTED", "SCREENING"] } } }),
        prisma.thesis.count({ where: { status: "VIVA" } }),
      ]);
      s.apps = { label: "PG applications", value: apps };
      s.theses = { label: "Theses at viva", value: theses };
      break;
    }
    case "SIWES": {
      const [records] = await Promise.all([
        prisma.sIWESRecord.count({ where: { status: "PENDING" } }),
      ]);
      s.records = { label: "SIWES records pending", value: records };
      break;
    }
    case "TIMETABLE": {
      const [bookings] = await Promise.all([
        prisma.venueBooking.count({ where: { status: "PENDING" } }),
      ]);
      s.bookings = { label: "Venue bookings pending", value: bookings };
      break;
    }
    case "IT_ADMIN": {
      const [sessions, api] = await Promise.all([
        prisma.session.count({ where: { revokedAt: null } }),
        prisma.apiCredential.count({ where: { revokedAt: null } }),
      ]);
      s.sessions = { label: "Active sessions", value: sessions };
      s.api = { label: "Active API credentials", value: api };      break;
    }
    case "DVC_OVERSIGHT": {
      const [students, openTicketsAll] = await Promise.all([
        prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
        prisma.helpTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      ]);
      s.students = { label: "Active students", value: students };
      s.allTickets = { label: "Open helpdesk tickets", value: openTicketsAll };
      break;
    }
    case "VC": {
      const [students, staff, applications, openTicketsAll, pendingClearance] = await Promise.all([
        prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
        prisma.user.count({ where: { role: { in: ["LECTURER", "HOD", "DEAN", "REGISTRY", "BURSARY", "STUDENT_AFFAIRS", "EXAMS_RECORDS", "PG_SCHOOL", "SIWES", "TIMETABLE", "IT_ADMIN", "DVC_OVERSIGHT", "SBC_CHAIRMAN", "GOVERNANCE_OVERSIGHT_MEMBER"] }, status: "ACTIVE" } }),
        prisma.application.count({ where: { status: { in: ["SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"] } } }),
        prisma.helpTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
        prisma.clearanceRequest.count({ where: { status: { notIn: ["COMPLETED"] } } }),
      ]);
      s.students = { label: "Active students", value: students };
      s.staff = { label: "Active staff", value: staff };
      s.applications = { label: "Applications in progress", value: applications };
      s.allTickets = { label: "Open helpdesk tickets", value: openTicketsAll };
      s.clearance = { label: "Clearances pending", value: pendingClearance };
      break;
    }
    case "VERIFIER": {
      const [transcripts] = await Promise.all([
        prisma.transcriptRequest.count({ where: { status: "PROCESSING" } }),
      ]);
      s.transcripts = { label: "Transcript verifications", value: transcripts };
      break;
    }
  }
  return Object.entries(s);
}

async function recentAnnouncements(role: string) {
  const all = await prisma.announcement.findMany({
    orderBy: { publishedAt: "desc" },
    take: 20,
  });
  return all.filter((a) => {
    if (a.scope === "PUBLIC") return true;
    if (a.scope === "STUDENT") return role === "STUDENT" || role === "APPLICANT";
    if (a.scope === "STAFF")
      return !["STUDENT", "APPLICANT", "VERIFIER"].includes(role);
    if (a.scope === "ROLE" && Array.isArray(a.visibleToRoles)) {
      return (a.visibleToRoles as string[]).includes(role);
    }
    return false;
  }).slice(0, 5);
}

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const user = session.user;

  const [stats, announcements] = await Promise.all([
    statsFor(user.role, user.id),
    recentAnnouncements(user.role),
  ]);

  // Quick actions derived from permissions
  const actions: { href: string; label: string; perm?: boolean }[] = [];
  const add = (href: string, label: string, perm?: boolean) => {
    if (perm !== false) actions.push({ href, label, perm });
  };
  add("/portal/applications", "Admissions", can(user.role, "ADMISSIONS", "R"));
  add("/portal/fees", "Fees & Payments", can(user.role, "FEES", "R"));
  add("/portal/results", "Results", can(user.role, "EXAMS_RECORDS", "R"));
  add("/portal/hostels", "Accommodation", can(user.role, "ACCOMMODATION", "R"));
  add("/portal/transcripts", "Transcripts", can(user.role, "TRANSCRIPT", "R"));
  add("/portal/lms", "LMS", can(user.role, "LMS", "R"));
  add("/portal/helpdesk", "Helpdesk");
  add("/portal/account", "Account & Security");

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-brand">
          {ROLE_LABELS[user.role] ?? user.role}
        </p>
        <h1 className="font-head text-3xl font-bold text-slate">
          Welcome back, {user.firstName || user.fullName.split(" ")[0]}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          Your role grants access to the modules below. Requests and approvals
          are routed by the portal&apos;s access control matrix and every action
          is recorded in the tamper-evident audit log.
        </p>
      </section>

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(([key, stat]) => (
          <StatCard key={key} label={stat.label} value={stat.value} hint={stat.hint} />
        ))}
      </section>

      <section>
        <SectionHeading
          title="Quick actions"
          subtitle="Shortcuts to the services you can use."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center justify-between rounded-xl border border-slate/10 bg-white p-4 shadow-sm transition-all hover:border-brand hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/80"
            >
              <span className="text-sm font-semibold text-slate group-hover:text-brand">
                {a.label}
              </span>
              <span aria-hidden="true" className="text-slate/70 group-hover:text-brand">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Announcements"
          subtitle="Latest notices scoped to your role."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {announcements.length === 0 ? (
            <Card>
              <p className="text-sm text-slate/75">No announcements for you right now.</p>
            </Card>
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className="flex flex-col gap-2">
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
                <h3 className="font-head font-semibold text-slate">{a.title}</h3>
                <p className="text-sm text-slate/70 line-clamp-2">{a.body}</p>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-brand-light p-6">
        <h2 className="font-head text-lg font-bold text-slate">
          Module access ({MODULE_LABELS && "per Access Control Matrix"})
        </h2>
        <p className="mt-1 text-sm text-slate/70">
          Roles map to the access control matrix: <strong>R</strong> read,{" "}
          <strong>W</strong> write, <strong>S</strong> submit,{" "}
          <strong>A</strong> approve, <strong>V</strong> verify.
        </p>
      </section>
    </div>
  );
}
