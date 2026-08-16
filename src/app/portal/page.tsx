import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(landingForRole(session.user.role));
}
