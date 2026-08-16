import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, Table, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { TranscriptRequestForm, IssueTranscriptButton, PayButton } from "@/components/module-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Transcripts" };

const PURPOSE_LABEL: Record<string, string> = {
  JOB: "Job application",
  FURTHER_STUDY: "Further study",
  IMMIGRATION: "Immigration / visa",
  OTHER: "Other",
};

export default async function TranscriptsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const [requests, invoices] = await Promise.all([
      prisma.transcriptRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.invoice.findMany({ where: { userId: user.id, module: "TRANSCRIPT" }, include: { payments: true } }),
    ]);
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 5 · Transcripts"
          title="Transcript Requests"
          description="Request official transcripts online. Fees are billed to your Fees page and settled via Remita."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">New request</h2>
            <Card>
              <TranscriptRequestForm />
            </Card>
          </section>

          <section>
            <h2 className="mb-4 font-head text-xl font-bold text-slate">Your requests</h2>
            {requests.length === 0 ? (
              <EmptyState title="No transcript requests yet" />
            ) : (
              <Table headers={["Reference", "Purpose", "Destination", "Copies", "Status", "Issued", "Payment"]}>
                {requests.map((t) => {
                  const invoice = invoices.find((i) => i.description.includes(t.referenceNo));
                  const paid = invoice?.payments.reduce((a, p) => a + p.amountCents, 0) ?? 0;
                  const payable = invoice && invoice.status === "OPEN" && invoice.amountCents - paid > 0;
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{t.referenceNo}</td>
                      <td className="px-4 py-3 text-slate">{PURPOSE_LABEL[t.purpose] ?? t.purpose}</td>
                      <td className="px-4 py-3 text-slate/70">{t.destinationInstitution ?? "—"}</td>
                      <td className="px-4 py-3 text-slate/70">{t.copies}{t.courier ? <span className="ml-1 text-xs text-slate/70">+courier</span> : null}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-slate/70">{formatDate(t.issuedAt)}</td>
                      <td className="px-4 py-3">
                        {payable ? <PayButton invoiceId={invoice!.id} label="Pay transcript fee" /> : <span className="text-xs text-slate/70">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "EXAMS_RECORDS" || user.role === "REGISTRY" || user.role === "VERIFIER") {
    const queue = await prisma.transcriptRequest.findMany({
      where: user.role === "VERIFIER" ? { status: "ISSUED" } : { status: { in: ["QUEUED", "PROCESSING", "ISSUED"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { user: true },
    });
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 5 · Records" title="Transcript Queue" description="Transcript requests to process and issue." />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          {queue.length === 0 ? (
            <EmptyState title="Queue empty" />
          ) : (
            <Table headers={["Reference", "Student", "Purpose", "Destination", "Status", "Action"]}>
              {queue.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate">{t.referenceNo}</td>
                  <td className="px-4 py-3 font-medium text-slate">{t.user.fullName}</td>
                  <td className="px-4 py-3 text-slate/70">{PURPOSE_LABEL[t.purpose] ?? t.purpose}</td>
                  <td className="px-4 py-3 text-slate/70">{t.destinationInstitution ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    {t.status !== "ISSUED" && user.role === "EXAMS_RECORDS" ? (
                      <IssueTranscriptButton id={t.id} />
                    ) : (
                      <span className="text-xs text-slate/70">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <p className="text-xs text-slate/70">
            Verifiers can review issued transcripts; public verification is at /verify.
          </p>
        </div>
      </div>
    );
  }

  if (user.role === "HOD" || user.role === "BURSARY" || user.role === "DVC_OVERSIGHT" || user.role === "VC") {
    const count = await prisma.transcriptRequest.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } });
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Module 5 · Read-only" title="Transcripts" description="Transcript workflow status." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <div className="flex items-center gap-3">
              <Badge tone="slate">{count} pending</Badge>
              <p className="text-sm text-slate/70">Transcripts pending processing and issuance.</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
