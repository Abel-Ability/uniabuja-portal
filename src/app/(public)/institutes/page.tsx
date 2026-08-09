import type { Metadata } from "next";
import { getCentres } from "@/lib/sheets";
import { PageHeader, Badge } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Institutes, Directorates & Centres" };

export const dynamic = "force-dynamic";

const GROUP_PATTERNS: { label: string; test: (name: string) => boolean }[] = [
  { label: "Centres", test: (n) => /^centre/i.test(n) },
  { label: "Directorates", test: (n) => /^directorate/i.test(n) },
  { label: "Institutes", test: (n) => /^institute/i.test(n) },
  { label: "Schools", test: (n) => /^school/i.test(n) },
  { label: "Units & Offices", test: (n) => /(unit|office)$/i.test(n) || /^unit/i.test(n) },
];

export default async function InstitutesPage() {
  const centres = await getCentres();

  const groups = new Map<string, string[]>();
  for (const name of centres) {
    const match = GROUP_PATTERNS.find((g) => g.test(name));
    const label = match?.label ?? "Other";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(name);
  }

  return (
    <div className="bg-white">
      <PageHeader
        eyebrow="Academics"
        title="Institutes, Directorates & Centres"
        description={`${centres.length} research institutes, directorates, centres, units and schools. Sourced live from the registry sheet.`}
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-8">
        {[...groups.entries()].map(([label, items]) => (
          <section key={label} aria-label={label}>
            <Reveal>
              <h2 className="mb-4 flex items-center gap-2 font-head text-xl font-bold text-slate">
                {label}
                <Badge tone="slate">{items.length}</Badge>
              </h2>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((name, i) => (
                <Reveal key={name} delay={Math.min(i, 5) * 60}>
                  <div className="card-lift flex h-full items-center rounded-xl border border-slate/10 bg-white p-4 text-sm font-medium text-slate shadow-sm">
                    {name}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
