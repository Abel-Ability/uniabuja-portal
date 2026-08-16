import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader, Card, Table, Badge, StatusBadge, SectionHeading, EmptyState, PillButton } from "@/components/ui";
import { ProposeAppointmentForm, AppointmentActionButtons } from "./appointment-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Appointments & Governance" };

const searchInputClass =
  "w-full max-w-sm rounded-xl border border-slate/25 px-4 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

const ROLE_TONE: Record<string, "brand" | "slate" | "gold"> = {
  HOD: "brand",
  DEAN: "slate",
  DIRECTOR_ACADEMIC_PLANNING: "gold",
};

const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;
  const role = user.role;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const searching = q.length >= 2;

  const canProposeHod = role === "DEAN";
  const canProposeDean = role === "DVC_OVERSIGHT";
  const canApproveHod = role === "DVC_OVERSIGHT";
  const canApproveDean = role === "VC";
  const canRecord = role === "REGISTRY";
  const isAppointee = ["HOD", "DEAN", "DIRECTOR_ACADEMIC_PLANNING"].includes(role);

  const [proposals, staff] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        appointee: true,
        proposer: true,
        approver: true,
        recorder: true,
      },
    }),
    searching
      ? prisma.user.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { fullName: "asc" },
          take: 50,
        })
      : [],
  ]);

  const staffOptions = staff.map((s) => ({ id: s.id, label: `${s.fullName} · ${ROLE_LABELS[s.role] ?? s.role}${s.department ? ` · ${s.department}` : ""}` }));
  const myAppointments = isAppointee
    ? proposals.filter((a) => a.appointeeId === user.id)
    : proposals.filter((a) => a.proposerId === user.id || a.recorderId === user.id || a.approverId === user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Governance"
        title="Appointments & Governance"
        description="HoDs are proposed by their Dean and approved by the DVC. Deans and Directors are proposed by the DVC and approved by the VC. The Registry records every appointment."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        <section aria-label="Propose">
          <SectionHeading
            title="Propose an appointment"
            subtitle={
              canProposeHod
                ? "As Dean you propose Heads of Department for your faculty."
                : canProposeDean
                  ? "As DVC you propose Deans and Directors for approval by the VC."
                  : "Only Deans (HoDs) and the DVC (Deans / Directors) can propose appointments."
            }
          />
          {canProposeHod || canProposeDean ? (
            <Card>
              <form
                action="/portal/appointments"
                method="get"
                className="mb-4 flex flex-wrap items-center gap-3"
              >
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  minLength={2}
                  placeholder="Search staff by name or username (min 2 characters)…"
                  className={searchInputClass}
                />
                <PillButton type="submit">Search</PillButton>
              </form>
              <p className="mb-2 text-sm text-slate/70">
                {searching
                  ? staffOptions.length > 0
                    ? `Showing up to ${staffOptions.length} matching staff.`
                    : "No staff match that search."
                  : "Search for a staff member to narrow the appointee list."}
              </p>
              <ProposeAppointmentForm
                canProposeHod={canProposeHod}
                canProposeDean={canProposeDean}
                staff={staffOptions}
                searching={searching}
              />
            </Card>
          ) : null}
        </section>

        <section aria-label="Approvals">
          <SectionHeading
            title="Approval queue"
            subtitle={
              canApproveHod
                ? "Approve or reject HoD proposals from your Deans."
                : canApproveDean
                  ? "Approve or reject Dean / Director proposals from the DVC."
                  : "Approved appointments are recorded by the Registry."
            }
          />
          <Card>
            {proposals.length === 0 ? (
              <EmptyState title="No appointments on record" />
            ) : (
              <Table headers={["Appointee", "Role", "Unit", "Session", "Proposed by", "Status", "Action"]}>
                {proposals.map((a) => {
                  const awaitingMe =
                    (canApproveHod && a.role === "HOD" && a.status === "PROPOSED") ||
                    (canApproveDean && a.role !== "HOD" && a.status === "PROPOSED");
                  const canRecordThis = canRecord && a.status === "APPROVED";
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-slate">{a.appointee.fullName}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONE[a.role] ?? "neutral"}>{a.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate/70">{a.unit ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{a.academicSession ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{a.proposer?.fullName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3">
                        {awaitingMe || canRecordThis ? (
                          <AppointmentActionButtons id={a.id} mode={canRecordThis ? "record" : "approve"} />
                        ) : (
                          <span className="text-xs text-slate/60">{fmt(a.issuedAt)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </section>

        {isAppointee ? (
          <section aria-label="My appointments">
            <SectionHeading title="My appointments" subtitle="Records where you are the appointee." />
            <Card>
              {myAppointments.length === 0 ? (
                <EmptyState title="No appointments for you" />
              ) : (
                <Table headers={["Role", "Unit", "Session", "Proposed by", "Status"]}>
                  {myAppointments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONE[a.role] ?? "neutral"}>{a.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate/70">{a.unit ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{a.academicSession ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{a.proposer?.fullName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
