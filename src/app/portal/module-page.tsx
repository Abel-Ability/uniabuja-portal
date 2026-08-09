import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { permissionsFor } from "@/lib/constants";
import { PageHeader, Card, Badge } from "@/components/ui";

const PERM_LABEL: Record<string, string> = {
  R: "Read",
  W: "Write",
  S: "Submit",
  A: "Approve",
  V: "Verify",
};

export async function ScaffoldModulePage({
  moduleKey,
  eyebrow,
  title,
  description,
  planned,
}: {
  moduleKey: string;
  eyebrow: string;
  title: string;
  description: string;
  planned: string[];
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return (
    <ModulePage
      role={session.user.role}
      moduleKey={moduleKey}
      eyebrow={eyebrow}
      title={title}
      description={description}
      planned={planned}
    />
  );
}

export async function ModulePage({
  role,
  moduleKey,
  title,
  eyebrow,
  description,
  planned,
}: {
  role: string;
  moduleKey: string;
  title: string;
  eyebrow: string;
  description: string;
  planned: string[];
}) {
  const perms = permissionsFor(role, moduleKey as never);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">
            Your access ({moduleKey})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {perms.length === 0 ? (
              <Badge tone="neutral">No direct access</Badge>
            ) : (
              perms.map((p) => (
                <Badge key={p} tone="brand">
                  {p} · {PERM_LABEL[p]}
                </Badge>
              ))
            )}
          </div>
        </Card>
        <section>
          <h2 className="font-head text-xl font-bold text-slate">Screens in this module</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {planned.map((s) => (
              <li
                key={s}
                className="rounded-xl border border-slate/10 bg-white p-4 text-sm font-medium text-slate shadow-sm"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>
        <p className="text-xs text-slate/70">
          Module pages are progressively built from the demo seed data. This page
          is a placeholder scaffold in this iteration.
        </p>
      </div>
    </div>
  );
}
