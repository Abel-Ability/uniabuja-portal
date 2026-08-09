import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { verifyChain } from "@/lib/audit";
import { PageHeader, Card, Table, StatusBadge, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { DsrForm } from "./dsr-form";
import { NotificationPreferencesForm } from "./preferences-form";
import { AdvanceDsrForm } from "./advance-dsr-button";
import { RespondFoiForm } from "./respond-foi-button";
import { ResolveBreachButton } from "./resolve-breach-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Data Protection" };

const REQUEST_TYPE_LABEL: Record<string, string> = {
  ACCESS: "Access",
  RECTIFY: "Rectify",
  ERASE: "Erase",
  PORTABILITY: "Portability",
};

const BREACH_TONE: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  LOW: "neutral",
  MODERATE: "gold",
  HIGH: "amber",
  CRITICAL: "red",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DpoPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  const isConsole = user.role === "IT_ADMIN" || user.role === "DVC_OVERSIGHT";

  const [myRequests, notificationPreference] = await Promise.all([
    prisma.dataSubjectRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
  ]);

  const consoleData = isConsole
    ? await Promise.all([
        prisma.dataSubjectRequest.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
        prisma.fOIRequest.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.consent.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
        prisma.breachLog.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
        verifyChain(),
      ])
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cross-cutting · Compliance"
        title="Data Protection"
        description="Exercise your rights under the NDPA 2023, manage your communication consents, and follow data-subject, FOI and breach workflows."
      />
      <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-8">
        <section aria-label="Data subject requests">
          <SectionHeading
            title="Your data rights"
            subtitle="Submit a request to access, rectify, erase or port your personal data. Your requests are tracked here."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">New request</h3>
              <DsrForm />
            </Card>
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">My requests</h3>
              {myRequests.length === 0 ? (
                <EmptyState title="No requests yet" body="Your data-subject requests will appear here." />
              ) : (
                <ul className="space-y-3">
                  {myRequests.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate/10 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate">
                          {REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}
                          <span className="ml-2 text-xs font-normal text-slate/70">
                            {formatDate(r.createdAt)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate/75">{r.detail ?? "—"}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>

        <section aria-label="Notification preferences">
          <SectionHeading
            title="Notification preferences"
            subtitle="Choose how the university may contact you. Opting out of SMS or email is honoured across modules."
          />
          <Card>
            <NotificationPreferencesForm
              prefs={{
                allowEmail: notificationPreference?.allowEmail ?? true,
                allowSms: notificationPreference?.allowSms ?? true,
                allowInApp: notificationPreference?.allowInApp ?? true,
                allowPromotional: notificationPreference?.allowPromotional ?? false,
              }}
            />
          </Card>
        </section>

        <section aria-label="NDPA notice">
          <Card>
            <h3 className="mb-2 font-head text-lg font-bold text-slate">Your rights under NDPA 2023</h3>
            <p className="text-sm leading-relaxed text-slate/70">
              The Nigeria Data Protection Act 2023 gives data subjects rights to access, rectify, erase and
              port their personal data, alongside the right to withdraw consent at any time. The university
              processes personal data only for lawful academic and administrative purposes, and maintains a
              tamper-evident audit trail of every processing activity. Requests are usually actioned within
              30 days; where this is not possible you will be notified.
            </p>
          </Card>
        </section>

        {consoleData ? (
          <section aria-label="DPO console">
            <SectionHeading
              title="DPO console"
              subtitle="Data-subject request, FOI, consent and breach registers for the Data Protection Officer."
            />
            <div className="space-y-10">
              <div>
                <h3 className="mb-3 font-head text-lg font-bold text-slate">Data-subject request queue</h3>
                {consoleData[0].length === 0 ? (
                  <EmptyState title="Queue clear" />
                ) : (
                  <Table headers={["Requester", "Type", "Detail", "Status", "Action"]}>
                    {consoleData[0].map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                        <td className="px-4 py-3 text-slate">{REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}</td>
                        <td className="px-4 py-3 text-slate/70">{r.detail ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          {r.status === "SUBMITTED" || r.status === "PROCESSING" ? (
                            <AdvanceDsrForm id={r.id} />
                          ) : (
                            <span className="text-xs text-slate/70">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-head text-lg font-bold text-slate">Freedom of Information queue</h3>
                {consoleData[1].length === 0 ? (
                  <EmptyState title="Queue clear" />
                ) : (
                  <Table headers={["Requester", "Email", "Subject", "Due", "Status", "Action"]}>
                    {consoleData[1].map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-3 font-medium text-slate">{f.requesterName}</td>
                        <td className="px-4 py-3 text-slate/70">{f.requesterEmail}</td>
                        <td className="px-4 py-3 text-slate">{f.subject}</td>
                        <td className="px-4 py-3 text-slate/70">{formatDate(f.dueOn)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={f.status} />
                        </td>
                        <td className="px-4 py-3">
                          {f.status === "SUBMITTED" || f.status === "PROCESSING" ? (
                            <RespondFoiForm id={f.id} />
                          ) : (
                            <span className="text-xs text-slate/70">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-head text-lg font-bold text-slate">Consent register</h3>
                {consoleData[2].length === 0 ? (
                  <EmptyState title="No consents on record" />
                ) : (
                  <Table headers={["User", "Purpose", "Status", "Granted", "Withdrawn"]}>
                    {consoleData[2].map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-slate">{c.user.fullName}</td>
                        <td className="px-4 py-3 text-slate">{c.purpose.replaceAll("_", " ")}</td>
                        <td className="px-4 py-3">
                          {c.granted ? (
                            <Badge tone="brand">Granted</Badge>
                          ) : (
                            <Badge tone="neutral">Withdrawn</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate/70">{formatDate(c.grantedAt)}</td>
                        <td className="px-4 py-3 text-slate/70">{formatDate(c.withdrawnAt)}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-head text-lg font-bold text-slate">Breach log</h3>
                {consoleData[3].length === 0 ? (
                  <EmptyState title="No breaches logged" />
                ) : (
                  <Table headers={["User", "Category", "Description", "NDPC", "Status", "Action"]}>
                    {consoleData[3].map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-medium text-slate">{b.user?.fullName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={BREACH_TONE[b.category] ?? "neutral"}>{b.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate/70">{b.description}</td>
                        <td className="px-4 py-3">
                          {b.notifiedNdpc ? (
                            <Badge tone="brand">Notified</Badge>
                          ) : (
                            <Badge tone="neutral">Not notified</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3">
                          {b.status === "RESOLVED" ? (
                            <span className="text-xs text-slate/70">Resolved</span>
                          ) : (
                            <ResolveBreachButton id={b.id} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-head text-lg font-bold text-slate">Audit chain integrity</h3>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-head font-bold text-slate">Hash-chained audit log</p>
                      <p className="mt-1 text-sm text-slate/70">
                        {consoleData[4].count} entries verified end to end; each record is chained to the
                        previous hash so tampering is detectable.
                      </p>
                    </div>
                    {consoleData[4].intact ? (
                      <Badge tone="brand">Intact</Badge>
                    ) : (
                      <Badge tone="red">Compromised</Badge>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
