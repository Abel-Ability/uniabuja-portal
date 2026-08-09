import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import { PageHeader, Card, Table, StatCard, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { PayButton } from "@/components/module-buttons";
import {
  HostelApplyForm,
  AllocateBedButton,
  GenerateHostelInvoiceButton,
  ResolveMaintenanceButton,
} from "@/components/module-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accommodation" };

export default async function HostelsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  const canApply = can(user.role, "ACCOMMODATION", "W");
  const canAllocate = can(user.role, "ACCOMMODATION", "A");
  const readOnly = can(user.role, "ACCOMMODATION", "R");

  // ---- student / applicant view ----
  if (canApply && !canAllocate) {
    const [application, invoices, maintenance, hostels] = await Promise.all([
      prisma.hostelApplication.findFirst({
        where: { userId: user.id },
        include: { hostel: true, allocatedBed: true },
      }),
      prisma.invoice.findMany({
        where: { userId: user.id, module: "HOSTEL" },
        orderBy: { createdAt: "desc" },
        include: { payments: true },
      }),
      prisma.maintenanceRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hostel.findMany({ orderBy: { name: "asc" } }),
    ]);

    const hostelInvoice = invoices[0] ?? null;
    const paidOnHostelInvoice = (hostelInvoice?.payments ?? []).reduce(
      (a, p) => a + p.amountCents,
      0,
    );

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 4 · Accommodation"
          title="Accommodation"
          description="Apply for a hostel bed, track your allocation and settle your accommodation fee."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Application status">
            {!application ? (
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-head text-lg font-bold text-slate">
                      Apply for accommodation
                    </h2>
                    <p className="mt-1 text-sm text-slate/75">
                      Pick a hostel and room type. Student Affairs will allocate a
                      bed and raise your accommodation invoice.
                    </p>
                  </div>
                  <Badge tone="brand">Open</Badge>
                </div>
                <div className="mt-4">
                  <HostelApplyForm
                    hostels={hostels.map((h) => ({ id: h.id, name: h.name }))}
                  />
                </div>
              </Card>
            ) : (
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-head text-lg font-bold text-slate">
                      My application
                    </h2>
                    <p className="mt-1 text-sm text-slate/75">
                      {application.academicSession} session ·{" "}
                      {application.hostel?.name ?? "No hostel"}
                    </p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-slate/75">Room</dt>
                    <dd className="font-medium text-slate">
                      {application.allocatedBed
                        ? `${application.allocatedBed.room} · ${application.allocatedBed.bed}`
                        : "Awaiting allocation"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate/75">Preference</dt>
                    <dd className="font-medium text-slate capitalize">
                      {(application.preference as { roomType?: string } | null)?.roomType ??
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate/75">Fee status</dt>
                    <dd className="font-medium text-slate">
                      {application.feeVerified ? (
                        <span className="text-green-700">Fee verified</span>
                      ) : (
                        <span className="text-amber-700">Pending payment</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>
            )}
          </section>

          {application?.status === "ALLOCATED" ? (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-head text-xl font-bold text-slate">
                  Accommodation fee
                </h2>
                <Badge tone="gold">Due before session</Badge>
              </div>
              {!hostelInvoice ? (
                <Card>
                  <p className="text-sm text-slate/75">
                    No invoice yet for your allocated bed. Raise one now — the
                    fee is{" "}
                    <span className="font-semibold text-slate">
                      {formatMoney(7500000)}
                    </span>
                    .
                  </p>
                  <div className="mt-4">
                    <GenerateHostelInvoiceButton />
                  </div>
                </Card>
              ) : (
                <Table
                  headers={["Description", "Amount", "Paid", "Status", "Action"]}
                >
                  <tr>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{hostelInvoice.description}</p>
                      <p className="text-xs text-slate/70">{hostelInvoice.module}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate">
                      {formatMoney(hostelInvoice.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {formatMoney(paidOnHostelInvoice)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={hostelInvoice.status} />
                    </td>
                    <td className="px-4 py-3">
                      {hostelInvoice.status === "OPEN" ? (
                        <PayButton
                          invoiceId={hostelInvoice.id}
                          label={`Pay ${formatMoney(
                            hostelInvoice.amountCents - paidOnHostelInvoice,
                          )}`}
                        />
                      ) : (
                        <span className="text-xs text-slate/70">—</span>
                      )}
                    </td>
                  </tr>
                </Table>
              )}
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-head text-xl font-bold text-slate">
                Maintenance requests
              </h2>
              <Badge tone="neutral">Faults & repairs</Badge>
            </div>
            {maintenance.length === 0 ? (
              <EmptyState
                title="No maintenance requests"
                body="Report faulty facilities in your hostel here."
              />
            ) : (
              <Table headers={["Title", "Description", "Status", "Raised"]}>
                {maintenance.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-slate">{m.title}</td>
                    <td className="px-4 py-3 text-slate/70">{m.description}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {m.createdAt.toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ---- student affairs view (allocate, resolve) ----
  if (canAllocate) {
    const [pending, allocated, maintenance] = await Promise.all([
      prisma.hostelApplication.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { user: true, hostel: true },
      }),
      prisma.hostelApplication.findMany({
        where: { status: "ALLOCATED" },
        orderBy: { createdAt: "desc" },
        include: { user: true, hostel: true, allocatedBed: true },
      }),
      prisma.maintenanceRequest.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "asc" },
        include: { user: true },
      }),
    ]);

    const freeBeds = await prisma.bedSpace.count({ where: { status: "FREE" } });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 4 · Student Affairs"
          title="Accommodation"
          description="Allocate beds to applicants and track maintenance across hostels."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending applications" value={pending.length} />
            <StatCard label="Allocated beds" value={allocated.length} />
            <StatCard label="Free beds" value={freeBeds} />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-head text-xl font-bold text-slate">
                Pending applications
              </h2>
              <AllocateBedButton />
            </div>
            {pending.length === 0 ? (
              <EmptyState
                title="No pending applications"
                body="New applications appear here for allocation."
              />
            ) : (
              <Table headers={["Applicant", "Hostel", "Preference", "Applied", "Action"]}>
                {pending.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{a.user.fullName}</p>
                      <p className="text-xs text-slate/70">{a.user.username}</p>
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.hostel?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate/70 capitalize">
                      {(a.preference as { roomType?: string } | null)?.roomType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.createdAt.toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate/70">
                        Use &ldquo;allocate next&rdquo;
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">
              Allocated beds
            </h2>
            {allocated.length === 0 ? (
              <EmptyState title="No allocations yet" />
            ) : (
              <Table headers={["Applicant", "Hostel", "Room", "Fee", "Allocated"]}>
                {allocated.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{a.user.fullName}</p>
                      <p className="text-xs text-slate/70">{a.user.username}</p>
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.hostel?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.allocatedBed
                        ? `${a.allocatedBed.room} · ${a.allocatedBed.bed}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.feeVerified ? (
                        <span className="text-sm font-semibold text-green-700">
                          Verified
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {a.allocatedAt?.toLocaleDateString("en-GB") ?? "—"}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">
              Maintenance queue
            </h2>
            {maintenance.length === 0 ? (
              <EmptyState title="Nothing open" />
            ) : (
              <Table headers={["Issue", "Reporter", "Status", "Action"]}>
                {maintenance.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate">{m.title}</p>
                      <p className="text-xs text-slate/70">{m.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate/70">{m.user.fullName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ResolveMaintenanceButton id={m.id} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ---- read-only view ----
  if (readOnly) {
    const [hostels, pendingCount] = await Promise.all([
      prisma.hostel.findMany({ orderBy: { name: "asc" } }),
      prisma.hostelApplication.count({ where: { status: "PENDING" } }),
    ]);
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 4 · Read-only"
          title="Accommodation"
          description="Overview of hostel capacity and pending applications."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Hostels" value={hostels.length} />
            <StatCard label="Pending applications" value={pendingCount} />
            <StatCard
              label="Free beds"
              value={hostels.reduce((a, h) => a + h.bedsAvailable, 0)}
            />
          </div>
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">
              Hostel capacity
            </h2>
            <Table headers={["Hostel", "Code", "Capacity", "Beds available"]}>
              {hostels.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 font-medium text-slate">{h.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate/70">
                    {h.code}
                  </td>
                  <td className="px-4 py-3 text-slate/70">{h.capacity}</td>
                  <td className="px-4 py-3 text-slate/70">{h.bedsAvailable}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
