import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";

export async function requireVC() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "VC") {
    redirect(landingForRole(session.user.role));
  }
  return session;
}