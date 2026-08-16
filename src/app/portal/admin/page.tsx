import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can, ROLE_LABELS } from "@/lib/constants";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  StatCard,
  SectionHeading,
  Table,
  EmptyState,
} from "@/components/ui";
import { NotificationPreferenceForm } from "../communications/notification-preference-form";
import { SetUserStatus } from "./set-user-status";
import { FeatureFlagToggle } from "./feature-flag-toggle";
import { IssueCredentialForm } from "./issue-credential-form";
import { RevokeCredentialButton } from "./revoke-credential-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin / System" };

const fmt = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

function credentialStatus(c: { revokedAt: Date | null; expiresAt: Date | null }) {
  return c.revokedAt
    ? "REVOKED"
    : c.expiresAt && c.expiresAt.getTime() < Date.now()
      ? "EXPIRED"
      : "ACTIVE";
}

const USERS_PER_PAGE = 50;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const isAdmin = can(session.user.role, "ADMIN_SYSTEM", "W");
  const canView = can(session.user.role, "ADMIN_SYSTEM", "R");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const totalUsers = await prisma.user.count();
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const [users, featureFlags, credentials, auditLogs, activeUsers, flagsOn, preference] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        skip: (safePage - 1) * USERS_PER_PAGE,
        take: USERS_PER_PAGE,
      }),
      prisma.featureFlag.findMany({ orderBy: { key: "asc" } }),
      prisma.apiCredential.findMany({ orderBy: { issuedAt: "desc" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.featureFlag.count({ where: { enabled: true } }),
      prisma.notificationPreference.findUnique({ where: { userId: session.userId } }),
    ]);

  const prefs = {
    allowEmail: preference?.allowEmail ?? true,
    allowSms: preference?.allowSms ?? true,
    allowInApp: preference?.allowInApp ?? true,
    allowPromotional: preference?.allowPromotional ?? false,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cross-cutting"
        title="Admin / System"
        description="User administration, feature flags, API credentials and the portal audit trail."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {!canView ? (
          <Card>
            <EmptyState title="No access" body="Your role cannot view the admin console." />
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total users" value={totalUsers} />
              <StatCard label="Active users" value={activeUsers} />
              <StatCard label="Feature flags on" value={flagsOn} />
            </section>

            <section>
              <SectionHeading
                title="Users"
                subtitle={
                  isAdmin
                    ? "Manage account status. Your own row is protected."
                    : "Read-only account overview."
                }
              />
              <Table
                headers={[
                  "Username",
                  "Full name",
                  "Role",
                  "Status",
                  "Last login",
                  "MFA",
                  ...(isAdmin ? ["Action"] : []),
                ]}
              >
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{u.username}</td>
                    <td className="px-4 py-3 font-medium text-slate">{u.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-slate/70">{fmt(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.mfaEnabled ? "brand" : "neutral"}>
                        {u.mfaEnabled ? "MFA on" : "MFA off"}
                      </Badge>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        {u.id === session.userId ? (
                          <span className="text-xs text-slate/70">You</span>
                        ) : (
                          <SetUserStatus userId={u.id} current={u.status} />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </Table>
              <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate/70">
                <span>
                  Showing {Math.min(totalUsers, (safePage - 1) * USERS_PER_PAGE + 1)}–
                  {Math.min(totalUsers, safePage * USERS_PER_PAGE)} of {totalUsers.toLocaleString()}{" "}
                  users
                </span>
                <div className="flex items-center gap-3">
                  {safePage > 1 ? (
                    <Link
                      href={`/portal/admin?page=${safePage - 1}`}
                      className="font-medium text-brand hover:underline"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed text-slate/40">Previous</span>
                  )}
                  <span>
                    Page {safePage} of {totalPages.toLocaleString()}
                  </span>
                  {safePage < totalPages ? (
                    <Link
                      href={`/portal/admin?page=${safePage + 1}`}
                      className="font-medium text-brand hover:underline"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed text-slate/40">Next</span>
                  )}
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                title="Feature flags"
                subtitle={isAdmin ? "Toggle module availability portal-wide." : "Read-only flag overview."}
              />
              <Table headers={["Key", "Note", "Enabled", ...(isAdmin ? ["Action"] : [])]}>
                {featureFlags.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{f.key}</td>
                    <td className="px-4 py-3 text-slate/70">{f.note ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.enabled ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <FeatureFlagToggle id={f.id} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </Table>
            </section>

            <section>
              <SectionHeading
                title="API credentials"
                subtitle={
                  isAdmin
                    ? "Issue integration keys for partner providers. Secrets are stored hashed."
                    : "Read-only credential overview."
                }
              />
              <div className="space-y-6">
                {isAdmin ? (
                  <Card>
                    <h3 className="mb-4 font-head text-lg font-bold text-slate">Issue credential</h3>
                    <IssueCredentialForm />
                  </Card>
                ) : null}
                {credentials.length === 0 ? (
                  <Card>
                    <EmptyState title="No credentials issued" />
                  </Card>
                ) : (
                  <Table headers={["Provider", "Label", "Issued", "Expires", "Status", ...(isAdmin ? ["Action"] : [])]}>
                    {credentials.map((c) => {
                      const status = credentialStatus(c);
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-3">
                            <Badge tone={status === "ACTIVE" ? "brand" : "neutral"}>{c.provider}</Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate">{c.label}</td>
                          <td className="px-4 py-3 text-slate/70">{fmt(c.issuedAt)}</td>
                          <td className="px-4 py-3 text-slate/70">{fmt(c.expiresAt)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={status} />
                          </td>
                          {isAdmin ? (
                            <td className="px-4 py-3">
                              {status === "ACTIVE" ? (
                                <RevokeCredentialButton id={c.id} />
                              ) : (
                                <span className="text-xs text-slate/70">—</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </Table>
                )}
              </div>
            </section>

            <section>
              <SectionHeading
                title="Audit trail"
                subtitle="Recent system events, hash-chained for tamper evidence."
              />
              {auditLogs.length === 0 ? (
                <Card>
                  <EmptyState title="No audit events" />
                </Card>
              ) : (
                <Table headers={["Actor", "Action", "Module", "Target", "When"]}>
                  {auditLogs.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-slate">{a.actorUsername ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.action} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate/70">{a.module}</td>
                      <td className="px-4 py-3 text-slate/70">{a.targetType ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{fmt(a.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>

            <section>
              <SectionHeading
                title="Notification preference centre"
                subtitle="Choose which channels the portal may use to reach you."
              />
              <Card>
                <NotificationPreferenceForm initial={prefs} />
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
