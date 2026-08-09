import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, PillLink } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Information & Policies" };

const POLICIES = [
  {
    title: "Privacy Notice (NDPA 2023)",
    body: "How the University of Abuja collects, uses and protects personal data in line with the Nigeria Data Protection Act 2023, including lawful bases, retention and data-subject rights.",
  },
  {
    title: "Acceptable Use Policy",
    body: "Rules for the responsible use of university networks, the student portal and e-learning systems, including conduct on discussion forums.",
  },
  {
    title: "Fees & Refund Policy",
    body: "Tuition and accommodation fee schedules, payment channels (Remita), deadlines and the refund rules for withdrawn applications.",
  },
  {
    title: "Examination Misconduct Policy",
    body: "Procedures for suspected examination misconduct, the investigation and hearing process, and appeal rights.",
  },
  {
    title: "Results & Transcript Policy",
    body: "Senate approval of results, GPA/CGPA computation aligned to NUC CCMAS, and the official transcript request process.",
  },
  {
    title: "Data Breach Notification Policy",
    body: "Internal escalation and notification commitments for personal-data breaches under the NDPA, including the 72-hour internal reporting target.",
  },
];

const SERVICES: { name: string; status: string; note: string }[] = [
  { name: "Portal & SSO", status: "OPERATIONAL", note: "Login, dashboard and module pages" },
  { name: "Fee Payments (Remita)", status: "OPERATIONAL", note: "Invoice and payment status sync" },
  { name: "E-Learning (Moodle SSO)", status: "OPERATIONAL", note: "SSO launch and enrolment sync" },
  { name: "Transcript Verification", status: "OPERATIONAL", note: "Public reference checks" },
  { name: "Admissions (CAPS/NIPEDS)", status: "OPERATIONAL", note: "Eligibility and verification" },
  { name: "Helpdesk", status: "OPERATIONAL", note: "Tickets and live chat" },
  { name: "SMS / Email Notifications", status: "OPERATIONAL", note: "Transactional delivery" },
];

const TOOLS = [
  { href: "/faculties", label: "Faculties & Departments" },
  { href: "/institutes", label: "Institutes & Centres" },
  { href: "/verify", label: "Verify a Result / Transcript" },
];

export default function InfoPage() {
  return (
    <div className="bg-white">
      <PageHeader
        eyebrow="Governance & Operations"
        title="Information, Policies & Service Status"
        description="The regulations that govern portal use, academic records and personal data, together with live status of the portal systems."
      />

      <div className="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:px-8">
        <section aria-labelledby="policies-heading">
          <Reveal>
            <h2 id="policies-heading" className="mb-6 font-head text-2xl font-bold text-slate">
              University policies
            </h2>
          </Reveal>
          <ul className="grid gap-4 md:grid-cols-2">
            {POLICIES.map((p, i) => (
              <li key={p.title}>
                <Reveal delay={Math.min(i, 5) * 80}>
                  <div className="card-lift h-full rounded-2xl border border-slate/10 bg-white p-6 shadow-sm">
                    <h3 className="font-head font-bold text-slate">{p.title}</h3>
                    <p className="mt-2 text-sm text-slate/70">{p.body}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-strong">
                      Review on request
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="status-heading">
          <Reveal>
            <h2 id="status-heading" className="mb-6 font-head text-2xl font-bold text-slate">
              Service status
            </h2>
          </Reveal>
          <ul className="space-y-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.name} as="li" delay={Math.min(i, 5) * 70}>
                <Card className="card-lift flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-head font-semibold text-slate">{s.name}</p>
                    <p className="text-xs text-slate/75">{s.note}</p>
                  </div>
                  <Badge tone="brand">{s.status.replaceAll("_", " ")}</Badge>
                </Card>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={120}>
            <p className="mt-4 text-xs text-slate/70">
              Status reflects the demo environment. A dedicated status page would aggregate
              uptime probes and incident history in production.
            </p>
          </Reveal>
        </section>

        <section aria-labelledby="tools-heading">
          <Reveal>
            <h2 id="tools-heading" className="mb-6 font-head text-2xl font-bold text-slate">
              Public tools
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.href} delay={i * 80}>
                <Link
                  href={t.href}
                  className="card-lift flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate/10 bg-white p-6 shadow-sm"
                >
                  <span className="font-head font-semibold text-slate">{t.label}</span>
                  <span className="text-sm font-semibold text-brand-strong">Open →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal>
          <div className="rounded-3xl bg-brand-strong p-6 text-white sm:p-10">
            <h2 className="font-head text-xl font-bold sm:text-2xl">Questions about a policy?</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Contact the Registrar&apos;s Office for academic regulations or the Data Protection
              Officer for privacy matters.
            </p>
            <div className="mt-6">
              <PillLink href="/login" variant="light">
                Contact helpdesk
              </PillLink>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Security strip */}
      <section className="relative overflow-hidden bg-brand-strong px-4 py-5 text-white sm:px-6 sm:py-6">
        <div aria-hidden="true" className="orb left-[-5%] top-[-30%] h-64 w-64 bg-gold/30 md:h-80 md:w-80" />
        <div aria-hidden="true" className="orb bottom-[-40%] right-[-5%] h-64 w-64 bg-slate-dark/50 md:h-80 md:w-80" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center md:flex-row md:gap-6 md:text-left">
          <Reveal>
            <div>
              <Badge tone="gold">Security by design</Badge>
              <h2 className="mt-1 font-head text-xl font-bold">
                MFA · step-up auth · audit trails · NDPA 2023 · WCAG 2.1 AA · PCI DSS v4.0
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-white/90">
                Data stays sovereign and in-house. Every action is audited in a tamper-evident,
                append-only log. Transcript signing keys live in a dedicated KMS/HSM — never in app code.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150} className="shrink-0">
            <PillLink href="/login" variant="light" className="shrink-0">
              Sign in to the portal
            </PillLink>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
