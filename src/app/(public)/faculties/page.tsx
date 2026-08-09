import type { Metadata } from "next";
import { getAcademicUnits } from "@/lib/sheets";
import { PageHeader, SectionHeading, Badge } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Faculties & Departments" };

export const dynamic = "force-dynamic";

export default async function FacultiesPage() {
  const { faculties, facultyCount, departmentCount } = await getAcademicUnits();

  return (
    <div className="bg-white">
      <PageHeader
        eyebrow="Academics"
        title="Faculties & Departments"
        description={`${facultyCount} academic units with ${departmentCount} departments. Select a unit to see its departments.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <SectionHeading
          title="All academic units"
          subtitle="Sourced live from the university registry sheet — updated as the sheet changes."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faculties.map((f, i) => (
            <Reveal key={f.name} delay={Math.min(i, 5) * 70}>
              <details className="group rounded-xl border border-slate/15 bg-white p-4 shadow-sm transition-shadow open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-head text-base font-bold text-slate marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong [&::-webkit-details-marker]:hidden">
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-brand-strong transition-transform duration-200 group-open:rotate-90">▸</span>
                      {f.name}
                    </span>
                    {f.college ? (
                      <span className="pl-5 text-xs font-medium uppercase tracking-wide text-slate/50">
                        {f.college}
                      </span>
                    ) : null}
                  </span>
                  <Badge tone="brand">
                    {f.departments.length} {f.departments.length === 1 ? "department" : "departments"}
                  </Badge>
                </summary>
                <ul className="mt-3 grid gap-1 border-t border-slate/10 pt-3 text-sm text-slate/70">
                  {f.departments.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
