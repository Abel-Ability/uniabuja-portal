import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { can, ROLE_LABELS } from "@/lib/constants";
import { PageHeader, Card, StatCard, SectionHeading, EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Health / Clinic Services" };

const REPORTING = [
  { label: "Clinic capacity", hint: "Beds, consultation slots" },
  { label: "Active health cases", hint: "Open clinic records" },
  { label: "Health & safety incidents", hint: "Reported and open" },
  { label: "Vaccination coverage", hint: "Campus campaigns" },
];

export default async function HealthPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "HEALTH", "R")) redirect("/portal/dashboard");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 17 · Institutional Oversight"
        title="Health / Clinic Services"
        description="Read-only institutional oversight of campus health and clinic services, held by the Vice-Chancellor. No clinical transactions are performed from this module."
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-8">
        <section aria-label="Oversight access">
          <SectionHeading
            title="Access tier"
            subtitle="Module 17 is deliberately tighter than DVC oversight."
          />
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-head font-semibold text-slate">Vice-Chancellor only</p>
              <p className="mt-1 max-w-2xl text-sm text-slate/70">
                This module is restricted to the {ROLE_LABELS.VC} role — read-only visibility with
                drill-down. It is excluded from DVC oversight by default, and no day-to-day clinic
                transactions (appointments, records, prescriptions) are available here.
              </p>
            </div>
            <Badge tone="gold">Read-only · Restricted</Badge>
          </Card>
        </section>

        <section aria-label="Institutional reporting">
          <SectionHeading
            title="Institutional reporting"
            subtitle="Health and safety indicators for highest-level oversight."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {REPORTING.map((r) => (
              <StatCard key={r.label} label={r.label} value="—" hint={r.hint} />
            ))}
          </div>
        </section>

        <section aria-label="Module 17 build-out">
          <SectionHeading
            title="Clinic services"
            subtitle="Service areas under consideration for Module 17."
          />
          <div className="space-y-4">
            <EmptyState
              title="Student clinic & appointments"
              body="Booking, triage and consultation tracking are provisioned as a tighter access tier, pending committee approval."
            />
            <EmptyState
              title="Health & safety reporting"
              body="Incident reporting, first-aid coverage and wellness campaigns will surface here for VC oversight."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
