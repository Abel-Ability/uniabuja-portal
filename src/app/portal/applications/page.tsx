import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  StatCard,
  SectionHeading,
  Table,
  EmptyState,
} from "@/components/ui";
import { ApplicationForm } from "./application-form";
import { DocumentUploadForm } from "./document-upload-form";
import { AdvanceApplicationButton } from "./advance-application-button";
import { VerifyDocumentButton } from "./verify-document-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admissions" };

const PIPELINE = ["DRAFT", "SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED"];
const REGISTRY_QUEUE = ["SUBMITTED", "SCREENING", "PENDING_CAPS"];
const STATUS_ORDER = ["DRAFT", "SUBMITTED", "SCREENING", "PENDING_CAPS", "ADMITTED", "REJECTED", "WITHDRAWN"];
const READONLY_ROLES = ["HOD", "DEAN", "BURSARY", "STUDENT_AFFAIRS", "EXAMS_RECORDS", "PG_SCHOOL", "DVC_OVERSIGHT", "VC"];

const NIPEDS_TONE: Record<string, "neutral" | "brand" | "slate" | "gold" | "red" | "amber"> = {
  VERIFIED: "brand",
  MISMATCH: "red",
  UNVERIFIED: "neutral",
};

function NipedsBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate/70">—</span>;
  return <Badge tone={NIPEDS_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>;
}

function eligibilityRows(value: unknown): [string, string][] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return ["totalScore", "utme", "oLevel", "eligible"]
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => [key, String(record[key])]);
}

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "APPLICANT") {
    const [application, programmes] = await Promise.all([
      prisma.application.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          programme: true,
          documents: { orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.programme.findMany({
        where: { programmeType: { in: ["UTME", "DISTANCE_LEARNING", "TRANSFER"] } },
        orderBy: { code: "asc" },
      }),
    ]);

    if (!application) {
      return (
        <div className="space-y-8">
          <PageHeader
            eyebrow="Module 1 · Admissions"
            title="Apply for Admission"
            description="Applications for the 2026/27 session across undergraduate, distance learning and transfer entry."
          />
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
            <Card>
              <h2 className="mb-4 font-head text-lg font-bold text-slate">New application</h2>
              <ApplicationForm programmes={programmes} defaultJambNo={user.jambNo ?? null} />
            </Card>
          </div>
        </div>
      );
    }

    const currentIndex = PIPELINE.indexOf(application.status);
    const eligibility = eligibilityRows(application.eligibility);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 1 · Admissions"
          title="My Application"
          description={`${application.programme.code} · ${application.programme.name}`}
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Application status">
            <Card>
              <h2 className="mb-4 font-head text-lg font-bold text-slate">Application status</h2>
              <ol className="flex flex-wrap items-center gap-2">
                {PIPELINE.map((stage, i) => {
                  const done = currentIndex >= 0 && i < currentIndex;
                  const active = i === currentIndex;
                  return (
                    <li key={stage} className="flex items-center gap-2">
                      {i > 0 ? (
                        <span aria-hidden="true" className="text-slate/30">
                          →
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-4 py-2 font-head text-sm font-semibold ${
                          active
                            ? "bg-amber-100 text-amber-800 ring-2 ring-gold dark:bg-amber-900/40 dark:text-amber-200"
                            : done
                              ? "bg-brand-light text-brand-dark"
                              : "bg-slate/10 text-slate/70"
                        }`}
                      >
                        {stage.replaceAll("_", " ")}
                      </span>
                    </li>
                  );
                })}
                {currentIndex === -1 ? (
                  <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-slate/30">
                      →
                    </span>
                    <span className="rounded-full bg-amber-100 px-4 py-2 font-head text-sm font-semibold text-amber-800 ring-2 ring-gold dark:bg-amber-900/40 dark:text-amber-200">
                      {application.status.replaceAll("_", " ")}
                    </span>
                  </li>
                ) : null}
              </ol>

              {eligibility.length > 0 ? (
                <div className="mt-5 rounded-xl border border-slate/10 bg-slate/5 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate/75">
                    Eligibility summary
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {eligibility.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-slate/75">{key}</dt>
                        <dd className="font-head text-sm font-bold text-slate">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="slate">JAMB {application.jambNo ?? "—"}</Badge>
                {application.capsStatus ? <StatusBadge status={application.capsStatus} /> : null}
                <NipedsBadge status={application.nipedsStatus} />
                <Badge tone={application.parentConsent ? "brand" : "amber"}>
                  {application.parentConsent ? "Parental consent recorded" : "No parental consent"}
                </Badge>
              </div>
            </Card>
          </section>

          <section aria-label="Documents">
            <SectionHeading
              title="Documents"
              subtitle="Upload result slips, certificates, passport photographs and supporting evidence for verification."
            />
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Upload a document</h3>
              <DocumentUploadForm />
            </Card>
            <div className="mt-6">
              {application.documents.length === 0 ? (
                <EmptyState
                  title="No documents uploaded"
                  body="Documents appear here once uploaded."
                />
              ) : (
                <Table headers={["Type", "File name", "Checksum", "Status"]}>
                  {application.documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3 font-medium text-slate">
                        {doc.kind.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-slate/70">{doc.fileName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate/70">{doc.checksum}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.verificationStatus} />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "REGISTRY") {
    const [applications, documents, total, queue, pendingDocs] = await Promise.all([
      prisma.application.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: { user: true, programme: true },
      }),
      prisma.documentUpload.findMany({
        orderBy: { createdAt: "desc" },
        include: { application: { include: { user: true } } },
      }),
      prisma.application.count(),
      prisma.application.count({ where: { status: { in: REGISTRY_QUEUE } } }),
      prisma.documentUpload.count({
        where: { verificationStatus: { in: ["PENDING", "FLAGGED"] } },
      }),
    ]);

    const groups = new Map<string, typeof applications>();
    for (const app of applications) {
      groups.set(app.status, [...(groups.get(app.status) ?? []), app]);
    }

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 1 · Admissions"
          title="Admissions Officer Console"
          description="Screen applications, advance the pipeline and verify applicant documents."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total applications" value={total} hint="All applications on record" />
            <StatCard
              label="Screening queue"
              value={queue}
              hint="SUBMITTED · SCREENING · PENDING_CAPS"
            />
            <StatCard
              label="Docs pending verification"
              value={pendingDocs}
              hint="PENDING or FLAGGED"
            />
          </section>

          <section aria-label="Applications">
            <SectionHeading
              title="Applications"
              subtitle="Grouped by pipeline stage. Advance applications that have passed each stage."
            />
            {applications.length === 0 ? (
              <EmptyState title="No applications" body="Applicant submissions will appear here." />
            ) : (
              <div className="space-y-10">
                {STATUS_ORDER.map((status) => {
                  const rows = groups.get(status);
                  if (!rows || rows.length === 0) return null;
                  return (
                    <div key={status}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="font-head text-lg font-bold text-slate">
                          {status.replaceAll("_", " ")}
                        </h3>
                        <Badge tone="slate">{rows.length}</Badge>
                      </div>
                      <Table headers={["Applicant", "Programme", "JAMB", "CAPS", "NIPEDS", "Action"]}>
                        {rows.map((app) => (
                          <tr key={app.id}>
                            <td className="px-4 py-3 font-medium text-slate">{app.user.fullName}</td>
                            <td className="px-4 py-3 text-slate">
                              {app.programme.code} · {app.programme.name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate/70">
                              {app.jambNo ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              {app.capsStatus ? (
                                <StatusBadge status={app.capsStatus} />
                              ) : (
                                <span className="text-xs text-slate/70">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <NipedsBadge status={app.nipedsStatus} />
                            </td>
                            <td className="px-4 py-3">
                              {REGISTRY_QUEUE.includes(app.status) ? (
                                <AdvanceApplicationButton id={app.id} status={app.status} />
                              ) : (
                                <span className="text-xs text-slate/70">Final</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="Document verification">
            <SectionHeading
              title="Document verification"
              subtitle="Verify pending or flagged uploads; every action is audit-trailed."
            />
            {documents.length === 0 ? (
              <EmptyState title="No documents uploaded" />
            ) : (
              <Table headers={["Applicant", "Type", "File", "Checksum", "Status", "Action"]}>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-3 font-medium text-slate">
                      {doc.application?.user.fullName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate">{doc.kind.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{doc.fileName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{doc.checksum}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.verificationStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {doc.verificationStatus === "PENDING" || doc.verificationStatus === "FLAGGED" ? (
                        <VerifyDocumentButton id={doc.id} />
                      ) : (
                        <span className="text-xs text-slate/70">Verified</span>
                      )}
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

  if (READONLY_ROLES.includes(user.role)) {
    const applications = await prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: true, programme: true },
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 1 · Admissions"
          title="Admissions Register"
          description="Read-only oversight of all applications."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Applications">
            <SectionHeading
              title="Applications"
              subtitle={`${applications.length} application${applications.length === 1 ? "" : "s"} on record.`}
            />
            {applications.length === 0 ? (
              <EmptyState title="No applications" body="Applicant submissions will appear here." />
            ) : (
              <Table headers={["Applicant", "Programme", "Status", "CAPS", "NIPEDS"]}>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td className="px-4 py-3 font-medium text-slate">{app.user.fullName}</td>
                    <td className="px-4 py-3 text-slate">{app.programme.code}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3">
                      {app.capsStatus ? (
                        <StatusBadge status={app.capsStatus} />
                      ) : (
                        <span className="text-xs text-slate/70">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <NipedsBadge status={app.nipedsStatus} />
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

  redirect("/portal/dashboard");
}
