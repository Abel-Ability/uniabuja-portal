import type { Metadata } from "next";
import Link from "next/link";
import { generateCaptcha } from "@/lib/captcha";
import { getAcademicUnits } from "@/lib/sheets";
import { PageHeader, Card } from "@/components/ui";
import { ApplyForm, type DepartmentOption } from "./apply-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Apply · Admissions" };

const NEXT_STEPS = [
  { title: "Screening", body: "Registry checks your details, JAMB number and programme choice." },
  { title: "Eligibility review", body: "The admissions rules engine scores your UTME/O'level profile." },
  { title: "CAPS & NIPEDS verification", body: "JAMB CAPS status and O'level records are verified." },
  { title: "Offer & acceptance", body: "If admitted, you accept your offer and pay acceptance fees." },
];

export default async function ApplyPage() {
  const academicUnits = await getAcademicUnits().catch(() => null);
  const departments: DepartmentOption[] = (academicUnits?.faculties ?? []).flatMap(
    (faculty) =>
      faculty.departments.map((name) => ({
        id: name,
        name,
        faculty: faculty.college ? `${faculty.name} · ${faculty.college}` : faculty.name,
      })),
  );

  const challenge = generateCaptcha();

  return (
    <div className="bg-white dark:bg-slate-900">
      <PageHeader
        eyebrow="Admissions"
        title="Apply to the University of Abuja"
        description="Start your 2026/2027 application in minutes — no prior sign-up or login required. Fill in your details, pick a programme and submit."
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ApplyForm departments={departments} challenge={challenge} />
          </div>

          <aside className="space-y-4" aria-label="What happens next">
            <h2 className="font-head text-lg font-bold text-slate">What happens next</h2>
            {NEXT_STEPS.map((s, i) => (
              <Card key={s.title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light font-head text-sm font-bold text-brand-dark">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-head text-sm font-semibold text-slate">{s.title}</h3>
                  <p className="mt-0.5 text-xs text-slate/70">{s.body}</p>
                </div>
              </Card>
            ))}

            <div className="rounded-2xl bg-brand-strong p-5 text-white">
              <h3 className="font-head text-sm font-semibold">Already applied?</h3>
              <p className="mt-1 text-xs text-white/80">
                Track your application, upload documents and check CAPS status by signing in to the
                portal.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 font-head text-xs font-semibold text-slate transition-colors hover:bg-white dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Sign in →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
