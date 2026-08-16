import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";

// Every SBC page is hard-gated to the SBC Chairman role. Any other signed-in
// user (including HOD / Dean / DVC / VC) is sent to their own landing page.
export async function requireSbcChairman() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "SBC_CHAIRMAN") {
    redirect(landingForRole(session.user.role));
  }
  return session;
}
