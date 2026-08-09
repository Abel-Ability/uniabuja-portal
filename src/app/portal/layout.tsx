import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { visibleModules, PORTAL_MODULES } from "@/lib/constants";
import { PortalShell } from "@/components/portal-shell";
import { IdleTimer } from "@/components/idle-timer";

export const dynamic = "force-dynamic";

const CROSS_CUTTING: Record<string, { href: string; label: string; description: string }> = {
  ADMIN_SYSTEM: { href: "/portal/admin", label: "Admin / System", description: "Users, feature flags, API keys" },
  DPO: { href: "/portal/dpo", label: "Data Protection", description: "DPO dashboard, subject requests" },
  COMMUNICATIONS: { href: "/portal/communications", label: "Communications", description: "Announcements and templates" },
  HELPDESK: { href: "/portal/helpdesk", label: "Helpdesk", description: "Tickets and live chat" },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { user } = session;
  if (user.status === "SUSPENDED" || user.status === "LOCKED") {
    redirect("/login?suspended=1");
  }
  if (user.mfaEnabled && !session.mfaVerifiedAt) {
    redirect("/login/mfa");
  }

  const keys = visibleModules(user.role);
  const modules = [
    ...PORTAL_MODULES.filter((m) => keys.includes(m.key)).map((m) => ({
      href: `/portal/${m.slug}`,
      label: m.title,
      description: m.description,
    })),
    ...Object.keys(CROSS_CUTTING)
      .filter((k) => keys.includes(k as never))
      .map((k) => CROSS_CUTTING[k]),
  ];

  return (
    <PortalShell
      user={{
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        email: user.email,
      }}
      modules={modules}
    >
      <IdleTimer />
      {children}
    </PortalShell>
  );
}
