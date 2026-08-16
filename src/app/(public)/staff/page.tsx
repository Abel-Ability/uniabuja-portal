import type { Metadata } from "next";
import {
  Users,
  ClipboardCheck,
  CalendarClock,
  Landmark,
  ShieldCheck,
  Headset,
  BadgeCheck,
  UserCog,
} from "lucide-react";
import { PageHeader, Card, PillLink, Badge } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Staff Portal" };

const SERVICES = [
  { title: "Admissions Console", icon: Users, body: "Screen applications, advance the CAPS pipeline and verify applicant documents." },
  { title: "Results Workflow", icon: ClipboardCheck, body: "Submit grades, approve results and manage misconduct and appeal cases." },
  { title: "Timetabling", icon: CalendarClock, body: "Book venues and publish lecture timetables for the session." },
  { title: "Bursary & Fees", icon: Landmark, body: "Invoices, waivers, scholarships, payment plans and TSA reconciliation." },
  { title: "Registry & Records", icon: BadgeCheck, body: "Registration numbers, transcripts, convocation and alumni records." },
  { title: "Helpdesk & Comm", icon: Headset, body: "Resolve tickets, run announcements and manage role-based communications." },
  { title: "Security & Audit", icon: ShieldCheck, body: "Admin console, feature flags, audit trail review and API credentials." },
  { title: "Self-service", icon: UserCog, body: "Update your profile, enable MFA and manage your notification preferences." },
];

const ROLES = [
  "Lecturer",
  "Head of Department",
  "Dean of Faculty",
  "Registry",
  "Bursary",
  "Exams & Records",
  "PG School",
  "SIWES Coordinator",
  "Timetabling",
  "IT Administrator",
  "DVC Oversight",
];

export default function StaffPage() {
  return (
    <div className="bg-white dark:bg-slate-900">
      <PageHeader
        eyebrow="Staff"
        title="Staff Portal"
        description="A single sign-on workspace for lecturers and administrative staff across admissions, results, finance, registry and oversight."
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-8">
        <section aria-labelledby="services-heading">
          <Reveal>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 id="services-heading" className="font-head text-2xl font-bold text-slate">
                Staff services
              </h2>
              <Badge tone="brand">Role-based access</Badge>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <Card className="card-lift group flex h-full flex-col gap-2">
                  <s.icon
                    aria-hidden="true"
                    className="h-7 w-7 text-brand-strong transition-transform duration-300 group-hover:-translate-y-1"
                  />
                  <h3 className="font-head text-lg font-bold text-slate">{s.title}</h3>
                  <p className="text-sm text-slate/70">{s.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        <section aria-labelledby="roles-heading" className="grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-1">
            <Card className="h-full">
              <h2 id="roles-heading" className="font-head text-lg font-bold text-slate">
                Staff roles
              </h2>
              <ul className="mt-3 space-y-2">
                {ROLES.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-slate/80">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-strong" />
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-2">
            <div className="flex h-full flex-col justify-center rounded-3xl bg-brand-strong p-6 text-white sm:p-10">
              <h2 className="font-head text-xl font-bold sm:text-2xl">Sign in to the staff portal</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Sign in with your staff number (e.g. ACA9999) and portal password. Every
                administrative action is recorded in a tamper-evident audit trail, and
                high-risk actions require step-up authentication.
              </p>
              <div className="mt-6">
                <PillLink href="/login" variant="light">
                  Sign in
                </PillLink>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
