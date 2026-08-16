import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStandardLevies, getProgrammeTuition } from "@/lib/sheets";
import { formatMoney } from "@/lib/utils";
import { PageHeader, Card, PillLink, Table } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fees & Payments" };

const TYPE_LABELS: Record<string, string> = {
  UTME: "UTME (JAMB)",
  DIRECT_ENTRY: "Direct Entry",
  PG: "Postgraduate",
  DISTANCE_LEARNING: "Distance Learning",
};

const FEE_ITEMS = [
  {
    title: "Acceptance Fee",
    amount: 25000,
    note: "One-off payment on offer acceptance, due before registration.",
  },
  {
    title: "Tuition (per semester)",
    amount: 120000,
    note: "Programme-dependent; see the schedule below for published rates.",
  },
  {
    title: "Hostel Accommodation",
    amount: 40000,
    note: "Annual bed space allocation, payable before move-in.",
  },
  {
    title: "Library & ICT Levy",
    amount: 15000,
    note: "Access to the digital library and campus network services.",
  },
  {
    title: "Late Registration",
    amount: 10000,
    note: "Applied when registration is completed after the published deadline.",
  },
];

const CHANNELS = [
  { title: "Remita (RRR)", body: "Generate a Remita Retrieval Reference and pay at any bank, online or via USSD." },
  { title: "Cards", body: "Debit and credit cards (Visa, Verve, Mastercard) are tokenized through the processor." },
  { title: "Bank transfer", body: "NIBSS/NIP instant transfers credited to the TSA in real time." },
  { title: "USSD", body: "Dial the Remita shortcode from any phone and follow the prompts." },
];

export default async function FeesPage() {
  const [programmes, sheetLevies, sheetTuition] = await Promise.all([
    prisma.programme.findMany({
      orderBy: [{ programmeType: "asc" }, { code: "asc" }],
    }),
    getStandardLevies(),
    getProgrammeTuition(),
  ]);

  // Prefer Google Sheets; fall back to the hardcoded list when the tab is
  // absent or empty, so the page never renders without fee items.
  const feeItems =
    sheetLevies.length > 0
      ? sheetLevies.map((l) => ({ title: l.title, amount: l.amountNaira, note: l.note }))
      : FEE_ITEMS;

  // Overlay sheet tuition (per annum, naira) on the DB programmes by code.
  const tuitionByCode = new Map(sheetTuition.map((t) => [t.code, t.tuitionPerAnnumNaira * 100]));

  return (
    <div className="bg-white dark:bg-slate-900">
      <PageHeader
        eyebrow="Fees & Payments"
        title="Fees Schedule 2026/2027"
        description="Published tuition, levies and payment channels. All revenue is remitted to the Treasury Single Account via Remita and reconciles to your fee account."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-8">
        {/* Fee items */}
        <section aria-labelledby="fee-items-heading">
          <Reveal>
            <h2 id="fee-items-heading" className="mb-4 font-head text-2xl font-bold text-slate">
              Standard levies
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feeItems.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <Card className="card-lift flex h-full flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    {f.title}
                  </p>
                  <p className="font-head text-2xl font-bold text-brand-strong">
                    {formatMoney(f.amount * 100)}
                  </p>
                  <p className="mt-1 text-sm text-slate/70">{f.note}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Programme tuition */}
        <section aria-labelledby="tuition-heading">
          <Reveal>
            <h2 id="tuition-heading" className="mb-4 font-head text-2xl font-bold text-slate">
              Programme tuition
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <Table headers={["Programme", "Type", "Duration", "Tuition (per annum)"]}>
              {programmes.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate">{p.code}</span> · {p.name}
                  </td>
                  <td className="px-4 py-3 text-slate/70">
                    {TYPE_LABELS[p.programmeType] ?? p.programmeType.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate/70">{p.durationYears} years</td>
                  <td className="px-4 py-3 font-head font-bold text-slate">
                    {formatMoney(tuitionByCode.get(p.code) ?? p.tuitionCents)}
                  </td>
                </tr>
              ))}
            </Table>
          </Reveal>
        </section>

        {/* Payment channels */}
        <section aria-labelledby="channels-heading">
          <Reveal>
            <h2 id="channels-heading" className="mb-4 font-head text-2xl font-bold text-slate">
              How to pay
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {CHANNELS.map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <Card className="card-lift h-full">
                  <h3 className="font-head font-semibold text-slate">{c.title}</h3>
                  <p className="mt-1 text-sm text-slate/70">{c.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Reveal>
          <div className="rounded-3xl bg-brand-strong p-6 text-white sm:p-10">
            <h2 className="font-head text-xl font-bold sm:text-2xl">Pay and track your fees</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Students sign in to the portal to view their fee account, generate invoices and
              RRRs, pay online and confirm fee clearance for registration and exams.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <PillLink href="/login" variant="light">
                Sign in to pay
              </PillLink>
              <Link
                href="/student"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 px-6 py-3 font-head text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Student services
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
