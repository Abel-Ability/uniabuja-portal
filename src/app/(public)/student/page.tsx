import type { Metadata } from "next";
import {
  BarChart3,
  ScrollText,
  ClipboardList,
  CreditCard,
  BedDouble,
  BookOpen,
  GraduationCap,
  HardHat,
  School,
} from "lucide-react";
import { PageHeader, Card, PillLink, Badge } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Student Portal" };

const SERVICES = [
  { title: "Results & GPA", icon: BarChart3, body: "Semester results after Senate approval, with CGPA aligned to NUC CCMAS." },
  { title: "Transcripts", icon: ScrollText, body: "Request digitally-signed transcripts and share public verification links." },
  { title: "Course Registration", icon: ClipboardList, body: "Register and drop courses online once your fees and prerequisites are cleared." },
  { title: "Fees & Payments", icon: CreditCard, body: "Invoices, Remita RRRs, payment history and fee clearance status." },
  { title: "Hostels", icon: BedDouble, body: "Apply for bed spaces, view allocation and pay accommodation fees." },
  { title: "Library & LMS", icon: BookOpen, body: "Digital library loans and Moodle e-learning under a single sign-on." },
  { title: "Clearance & Graduation", icon: GraduationCap, body: "Multi-department clearance, convocation and automatic NYSC handoff." },
  { title: "SIWES & Internships", icon: HardHat, body: "Log industrial training records and get them signed off by coordinators." },
  { title: "Helpdesk", icon: School, body: "Raise tickets for portal, fees and academic issues — with live chat." },
];

export default function StudentPage() {
  return (
    <div className="bg-white">
      <PageHeader
        eyebrow="Students"
        title="Student Portal"
        description="Everything a student needs — results, transcripts, registration, fees, hostels, e-learning and clearance — behind one secure sign-on."
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-8">
        <section aria-labelledby="services-heading">
          <Reveal>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 id="services-heading" className="font-head text-2xl font-bold text-slate">
                Student services
              </h2>
              <Badge tone="brand">Sign in to access</Badge>
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

        <Reveal>
          <div className="rounded-3xl bg-brand-strong p-6 text-white sm:p-10">
            <h2 className="font-head text-xl font-bold sm:text-2xl">Sign in to the student portal</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Use your registration number (e.g. 12/345ABC/678) or the email you applied with, and
              your portal password. Newly admitted students set a password on first sign-in.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <PillLink href="/login" variant="light">
                Sign in
              </PillLink>
              <a
                href="#services-heading"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 px-6 py-3 font-head text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore services
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
