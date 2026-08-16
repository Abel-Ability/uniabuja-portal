import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import {
  helpForRole,
  helpSectionForPath,
  helpSectionsForRole,
  helpDashboardForRole,
} from "@/lib/help";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Help & Guide" };

export default async function HelpFaqPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const rawFrom = params.from;
  const from = typeof rawFrom === "string" ? rawFrom : undefined;

  const role = session.user.role;
  const roleLabel = ROLE_LABELS[role] ?? "Portal user";
  const content = helpForRole(role);
  const sections = helpSectionsForRole(role);

  // The `from` query only ever selects a section within this user's own role
  // content. It is derived from the current sidebar link and can never change
  // which role's help is shown.
  const active = from ? helpSectionForPath(role, from) : undefined;
  const dashboard = helpDashboardForRole(role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Support · ${roleLabel}`}
        title="Help & Guide"
        description={content.description}
      />

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Your workspace</h2>
        <Card>
          <p className="text-sm text-slate/80">{content.workspace}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Where to start</h2>
        <Card>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate/80">
            {content.startHere.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Sidebar modules</h2>
        {active ? (
          <Card className="mb-3 border-2 border-brand">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              You were last on this page
            </p>
            <h3 className="mt-1 font-head font-semibold text-slate">{active.label}</h3>
            <p className="mt-1 text-sm text-slate/75">{active.body}</p>
          </Card>
        ) : null}
        <div className="space-y-3">
          {sections.map((s) => (
            <Card key={s.href}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-head font-semibold text-slate">{s.label}</h3>
                <Link
                  href={s.href}
                  className="shrink-0 text-xs font-semibold text-brand hover:underline"
                >
                  Open module
                </Link>
              </div>
              <p className="mt-1 text-sm text-slate/75">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">How the work flows</h2>
        <Card>
          <ol className="space-y-3">
            {content.workflow.map((w) => (
              <li key={w.step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {content.workflow.indexOf(w) + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate">{w.step}</p>
                  <p className="text-sm text-slate/75">{w.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">What you can do</h2>
          <Card>
            <ul className="space-y-2 text-sm text-slate/80">
              {content.canDo.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-brand">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">What you should not expect</h2>
          <Card>
            <ul className="space-y-2 text-sm text-slate/80">
              {content.cannotDo.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-amber-600">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Results & reports</h2>
        <Card>
          <p className="text-sm text-slate/80">{content.results}</p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">After you act</h2>
          <Card>
            <p className="text-sm text-slate/80">{content.after}</p>
          </Card>
        </div>
        <div>
          <h2 className="mb-4 font-head text-xl font-bold text-slate">Your dashboard & history</h2>
          <Card>
            <p className="text-sm text-slate/80">
              <Link href={dashboard.href} className="font-semibold text-brand hover:underline">
                {dashboard.label}
              </Link>{" "}
              returns you to your starting point. {content.dashboard.replace(/\s+$/, "")}
            </p>
            <p className="mt-2 text-sm text-slate/80">{content.history}</p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Frequently asked questions</h2>
        <div className="space-y-3">
          {content.faqs.map((f) => (
            <Card key={f.q}>
              <h3 className="font-head font-semibold text-slate">{f.q}</h3>
              <p className="mt-1 text-sm text-slate/75">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-head text-xl font-bold text-slate">Need more help?</h2>
        <Card>
          <ul className="space-y-2 text-sm text-slate/80">
            <li>
              Email:{" "}
              <a
                href="mailto:support@uniabuja.edu.ng"
                className="font-semibold text-brand hover:underline"
              >
                support@uniabuja.edu.ng
              </a>
            </li>
            <li>
              Raise a ticket from the{" "}
              <Link href="/portal/helpdesk" className="font-semibold text-brand hover:underline">
                Helpdesk
              </Link>{" "}
              — urgent issues are triaged first.
            </li>
            <li>Support is available Mon–Fri, 8:00–17:00.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
