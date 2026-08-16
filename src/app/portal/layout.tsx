import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import {
  visibleModules,
  PORTAL_MODULES,
  CROSS_CUTTING_MODULES,
  getMenuForRole,
  dashboardForRole,
} from "@/lib/constants";
import { PortalShell } from "@/components/portal-shell";
import { IdleTimer } from "@/components/idle-timer";

export const dynamic = "force-dynamic";

const CROSS_CUTTING = CROSS_CUTTING_MODULES;

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

  // Determine the sidebar menu from the role-specific workspace definition.
  // Roles with dedicated workspaces use their own menus; all other roles fall
  // back to PORTAL_MODULES filtered by the access control matrix.
  let modules: { href: string; label: string; description: string }[];

  const roleMenu = getMenuForRole(user.role);
  if (roleMenu && roleMenu.length > 0) {
    modules = roleMenu;
  } else {
    const keys = visibleModules(user.role);
    modules = [
      ...PORTAL_MODULES.filter((m) => keys.includes(m.key)).map((m) => ({
        href: `/portal/${m.slug}`,
        label: m.title,
        description: m.description,
      })),
      ...Object.keys(CROSS_CUTTING)
        .filter((k) => keys.includes(k as never))
        .map((k) => CROSS_CUTTING[k as keyof typeof CROSS_CUTTING_MODULES]!),
    ];
  }

  // Roles with a dedicated workspace start the sidebar on that workspace.
  const dashboard = dashboardForRole(user.role);

  return (
    <PortalShell
      user={{
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        email: user.email,
      }}
      modules={modules}
      dashboard={dashboard}
    >
      <IdleTimer />
      {children}
    </PortalShell>
  );
}
