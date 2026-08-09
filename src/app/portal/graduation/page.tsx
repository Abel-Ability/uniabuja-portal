import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, Table, StatusBadge, EmptyState } from "@/components/ui";
import { SignOffButton, StartClearanceButton } from "@/components/module-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Graduation & Clearance" };

const APPROVER_DEPTS: Record<string, string> = {
  HOD_DEAN: "EXAMS",
  STUDENT_AFFAIRS: "HOSTEL",
  SIWES: "SIWES",
  PG_SCHOOL: "SPORTS",
};

export default async function GraduationPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  // ---- student view ----
  if (user.role === "STUDENT") {
    const [clearance, gradRecord, convocation] = await Promise.all([
      prisma.clearanceRequest.findFirst({
        where: { userId: user.id },
        orderBy: { submittedAt: "desc" },
        include: { items: true },
      }),
      prisma.graduationRecord.findUnique({ where: { userId: user.id } }),
      prisma.convocation.findFirst({ where: { userId: user.id } }),
    ]);

    const signed = clearance?.items.filter((i) => i.status === "SIGNED_OFF").length ?? 0;
    const total = clearance?.items.length ?? 0;

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 8 · Clearance"
          title="Graduation & Clearance"
          description="Track your multi-department clearance, convocation registration and graduation record."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Clearance</p>
              <p className="font-head text-2xl font-bold text-slate">{clearance ? `${signed}/${total} departments` : "Not started"}</p>
              <p className="text-xs text-slate/75">{clearance ? `${clearance.status.replaceAll("_", " ")}` : "Start your clearance below"}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Award class</p>
              <p className="font-head text-2xl font-bold text-slate">{gradRecord?.awardClass ?? "—"}</p>
              <p className="text-xs text-slate/75">{gradRecord?.cgpa != null ? `CGPA ${gradRecord.cgpa.toFixed(2)}` : "Not published"}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Convocation</p>
              <p className="font-head text-2xl font-bold text-slate">{convocation ? `Seat ${convocation.seatNo ?? "—"}` : "Not registered"}</p>
              <p className="text-xs text-slate/75">{convocation ? `${convocation.session} · ${convocation.guestSlots} guests` : "—"}</p>
            </Card>
          </section>

          {!clearance ? (
            <section>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">Start clearance</h2>
              <Card>
                <p className="mb-4 text-sm text-slate/70">
                  Begin graduation clearance. Six departments must sign off before
                  you are cleared for convocation.
                </p>
                <StartClearanceButton />
              </Card>
            </section>
          ) : (
            <section>
              <h2 className="mb-4 font-head text-xl font-bold text-slate">
                Clearance checklist
                <span className="ml-3">
                  <StatusBadge status={clearance.status} />
                </span>
              </h2>
              <Table headers={["Department", "Status", "Signed off", "Comment"]}>
                {clearance.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium text-slate">{i.department.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-slate/70">{formatDate(i.signedOffAt)}</td>
                    <td className="px-4 py-3 text-slate/70">{i.comment ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ---- approver view (roles with GRAD_CLEARANCE A) ----
  if (can(user.role, "GRAD_CLEARANCE", "A") && APPROVER_DEPTS[user.role]) {
    const dept = APPROVER_DEPTS[user.role];
    const items = await prisma.clearanceItem.findMany({
      where: { department: dept, status: { not: "SIGNED_OFF" } },
      orderBy: { clearanceRequest: { submittedAt: "asc" } },
      include: { clearanceRequest: { include: { user: true } } },
    });
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={`Module 8 · ${dept}`}
          title="Clearance Sign-off"
          description={`Items pending your department's sign-off.`}
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {items.length === 0 ? (
            <EmptyState title="Nothing pending" body={`No ${dept} clearance items await your sign-off.`} />
          ) : (
            <Table headers={["Student", "Request type", "Submitted", "Action"]}>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate">{i.clearanceRequest.user.fullName}</td>
                  <td className="px-4 py-3 text-slate/70">{i.clearanceRequest.clearanceType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate/70">{formatDate(i.clearanceRequest.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <SignOffButton itemId={i.id} department={dept} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <p className="text-xs text-slate/70">
            Approvals are logged to the tamper-evident audit trail. When every
            department signs off, the clearance is completed automatically.
          </p>
        </div>
      </div>
    );
  }

  // ---- read-only view for other roles ----
  if (can(user.role, "GRAD_CLEARANCE", "R")) {
    const requests = await prisma.clearanceRequest.findMany({
      orderBy: { submittedAt: "desc" },
      take: 30,
      include: { user: true, items: true },
    });
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 8 · Read-only" title="Clearance Requests" description="Overview of clearance across the university." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {requests.length === 0 ? (
            <EmptyState title="No clearance requests" />
          ) : (
            <Table headers={["Student", "Type", "Progress", "Status", "Submitted"]}>
              {requests.map((r) => {
                const signed = r.items.filter((i) => i.status === "SIGNED_OFF").length;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate/70">{r.clearanceType.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate/70">{signed}/{r.items.length}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate/70">{formatDate(r.submittedAt)}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
