import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { landingForRole } from "@/lib/constants";
import {
  GOVERNANCE_COMMITTEE,
  getActiveCommitteeMembership,
  isGovernanceRole,
} from "@/lib/governance";

// Every Governance & Oversight page is hard-gated on an ACTIVE committee
// membership row. The authorization boundary is the membership — not the DVC
// job title. The Chairman is a designation on the same membership row; there
// is no separate chairman permission set. A user with a governance role but
// no valid membership is sent to the dashboard (NOT landingForRole, which
// would bounce a DVC straight back onto /portal/dvc in a redirect loop).
export async function requireGovernanceOversight() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isGovernanceRole(session.user.role)) {
    redirect(landingForRole(session.user.role));
  }
  const membership = await getActiveCommitteeMembership(
    session.user.id,
    GOVERNANCE_COMMITTEE,
  );
  if (!membership) {
    redirect("/portal/dashboard");
  }
  return { session, membership };
}
