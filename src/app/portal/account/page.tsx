import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader, Card, StatusBadge, Table } from "@/components/ui";
import { ChangePasswordForm } from "@/components/change-password-form";
import { MfaPanel } from "@/components/mfa-panel";
import { revokeSessionAction, revokeAllSessionsAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account & Security" };

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const user = session.user;

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Security"
        title="Account & Security"
        description="Manage your password, sessions and privacy preferences."
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-8">
        <Card>
          <h2 className="font-head text-lg font-bold text-slate">Profile</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate/75">Full name</dt>
              <dd className="font-medium text-slate">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-slate/75">Role</dt>
              <dd className="font-medium text-slate">{ROLE_LABELS[user.role] ?? user.role}</dd>
            </div>
            <div>
              <dt className="text-slate/75">Username</dt>
              <dd className="font-medium text-slate">{user.username}</dd>
            </div>
            <div>
              <dt className="text-slate/75">Email</dt>
              <dd className="font-medium text-slate">{user.email}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-slate/5 p-3 text-xs text-slate/75">
            Need to correct your personal data? Submit a subject access request
            through the Data Protection module.
          </p>
        </Card>

        <Card>
          <h2 className="font-head text-lg font-bold text-slate">Change password</h2>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-head text-lg font-bold text-slate">Two-step verification</h2>
              <p className="mt-1 text-sm text-slate/75">
                Add an authenticator code to sign-in and unlock step-up prompts
                for sensitive actions.
              </p>
            </div>
            {user.mfaEnabled ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Enabled
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            <MfaPanel
              initialEnabled={user.mfaEnabled}
              sessionMfaVerified={Boolean(session.mfaVerifiedAt)}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-head text-lg font-bold text-slate">Active sessions</h2>
              <p className="mt-1 text-sm text-slate/75">
                {sessions.filter((s) => !s.revokedAt).length} active · devices you
                signed in from. Revoke anything you don&apos;t recognise.
              </p>
            </div>
            {sessions.some((s) => !s.revokedAt && s.id !== session.id) ? (
              <form action={revokeAllSessionsAction}>
                <button
                  type="submit"
                  className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Sign out other devices
                </button>
              </form>
            ) : null}
          </div>
          <div className="mt-4">
            <Table headers={["Status", "IP", "Browser", "Signed in"]}>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.revokedAt ? "EXPIRED" : "ACTIVE"} />
                    {s.id === session.id ? (
                      <span className="ml-2 text-xs font-semibold text-brand">current</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate/70">{s.ip ?? "—"}</td>
                  <td className="px-4 py-3 text-slate/70">
                    {(s.userAgent ?? "—").slice(0, 48)}
                  </td>
                  <td className="px-4 py-3 text-slate/70">
                    {s.createdAt.toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {!s.revokedAt && s.id !== session.id ? (
                      <form action={revokeSessionAction}>
                        <input type="hidden" name="revokeId" value={s.id} />
                        <button
                          type="submit"
                          className="text-sm font-semibold text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
