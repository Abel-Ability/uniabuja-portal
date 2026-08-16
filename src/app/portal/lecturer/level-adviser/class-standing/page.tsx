import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import { Card, SectionHeading, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Class / Goodstanding Definition" };

const CLASS_BANDS: { class: string; cgpa: string; tone: "brand" | "slate" | "amber" | "neutral" }[] = [
  { class: "First Class", cgpa: "4.50 – 5.00", tone: "brand" },
  { class: "Second Class Upper", cgpa: "3.50 – 4.49", tone: "brand" },
  { class: "Second Class Lower", cgpa: "2.40 – 3.49", tone: "slate" },
  { class: "Third Class", cgpa: "1.50 – 2.39", tone: "amber" },
  { class: "Pass", cgpa: "1.00 – 1.49", tone: "neutral" },
];

const GOOD_STANDING_RULES = [
  "A student in good standing has no outstanding F grade in any registered course.",
  "A cumulative GPA (CGPA) below 1.50 places the student on probation.",
  "Repeating students must retake failed courses and clear them before progression.",
  "Good standing is assessed at the end of each semester by the level adviser.",
  "Students on probation may not enrol in the next level until the CGPA recovers.",
];

export default async function ClassStandingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LECTURER") redirect(landingForRole(session.user.role));

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-brand">Level Adviser</p>
        <h1 className="font-head text-3xl font-bold text-slate">Class / Goodstanding Definition</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate/70">
          The official bands used to award classes of degree and the rules that
          define good standing for a student.
        </p>
      </section>

      <section>
        <SectionHeading
          title="Classes of degree"
          subtitle="Awarded from the student's cumulative GPA on the 5.00 scale."
        />
        <div className="overflow-x-auto rounded-xl border border-slate/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                <th scope="col" className="px-4 py-3">Class</th>
                <th scope="col" className="px-4 py-3">CGPA range</th>
                <th scope="col" className="px-4 py-3">Grade points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate/10">
              {CLASS_BANDS.map((c) => (
                <tr key={c.class}>
                  <td className="px-4 py-3">
                    <Badge tone={c.tone}>{c.class}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate">{c.cgpa}</td>
                  <td className="px-4 py-3 text-slate/70">
                    A=5 · B=4 · C=3 · D=2 · E=1 · F=0
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading title="Good standing" subtitle="What keeps a student in good standing." />
        <div className="grid gap-3 md:grid-cols-2">
          {GOOD_STANDING_RULES.map((rule) => (
            <Card key={rule} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-strong" aria-hidden="true" />
              <p className="text-sm text-slate/80">{rule}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
