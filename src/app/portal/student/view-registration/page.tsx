import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CURRENT_SESSION, CURRENT_SEMESTER, SEMESTER_LABELS } from "@/lib/constants";
import {
  buildRegistrationDocument,
  getRegistrationForView,
  isRegistrationFinalised,
  type RegistrationDocument,
} from "@/lib/student-finalisation";
import { PrintButton } from "./print-button";
import { AutoPrint } from "./auto-print";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "View Registration" };

type HistoryItem = {
  registrationReference: string;
  academicSession: string;
  semester: number;
  totalUnits: number;
  status: string;
  lockedAt: Date | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  );
}

function RegistrationDocument({
  doc,
  locked,
}: {
  doc: RegistrationDocument;
  locked: boolean;
}) {
  return (
    <Card className="print-document p-6 sm:p-10">
      <div className="text-center mb-8">
        <p className="font-head text-xl font-bold text-slate-800 uppercase">
          University of Abuja
        </p>
        <p className="text-sm text-slate-500 mt-1">Yakubu Gowon University, Abuja</p>
        <div className="my-4 border-b border-slate-300" />
        <p className="font-head text-lg font-semibold text-slate-800 uppercase">
          Student Course Registration
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Academic Session: {doc.academicSession} · {doc.semesterLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <InfoRow label="Registration Reference" value={doc.reference} />
        <InfoRow label="Registration Status" value={doc.statusLabel} />
        <InfoRow label="Date Finalised" value={fmtDate(doc.finalisedAt)} />
      </div>

      <div className="mb-8">
        <h3 className="font-head font-semibold text-slate-700 uppercase tracking-wide mb-3 text-sm">
          Student Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoRow label="Full Name" value={doc.fullName} />
          <InfoRow label="Registration Number" value={doc.registrationNo} />
          <InfoRow label="Faculty" value={doc.faculty} />
          <InfoRow label="Department" value={doc.department} />
          <InfoRow label="Programme" value={doc.programmeId} />
          <InfoRow label="Level" value={doc.level ? `${doc.level} Level` : "—"} />
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-head font-semibold text-slate-700 uppercase tracking-wide mb-3 text-sm">
          Registered Courses
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="px-3 py-2 text-slate-500 font-medium">S/N</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Course Code</th>
                <th className="px-3 py-2 text-slate-500 font-medium">Course Title</th>
                <th className="px-3 py-2 text-slate-500 font-medium text-center">Units</th>
              </tr>
            </thead>
            <tbody>
              {doc.courses.map((course, index) => (
                <tr key={course.code} className="border-b border-slate-200">
                  <td className="px-3 py-2 text-slate-600">{index + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{course.code}</td>
                  <td className="px-3 py-2 text-slate-600">{course.title}</td>
                  <td className="px-3 py-2 text-slate-600 text-center">{course.units}</td>
                </tr>
              ))}
              {doc.courses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-slate-500">
                    No courses recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoRow label="Total Credit Units" value={String(doc.totalUnits)} />
        <InfoRow label="Submitted" value={fmtDate(doc.submittedAt)} />
        <InfoRow label="Registration Reference" value={doc.reference} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge tone={locked ? "red" : "brand"}>{doc.statusLabel}</Badge>
        {!locked && <span className="text-xs text-slate-500">Not yet finalised</span>}
      </div>
    </Card>
  );
}

export default async function ViewRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; session?: string; semester?: string; print?: string }>;
}) {
  const session = await requireSession();
  const { user } = session;
  const params = await searchParams;

  const registration = await getRegistrationForView(user, {
    reference: params.reference ?? null,
    academicSession: params.session ?? CURRENT_SESSION,
    semester: params.semester ? Number(params.semester) : CURRENT_SEMESTER,
  });

  const history = await prisma.registration.findMany({
    where: { userId: user.id },
    orderBy: [{ academicSession: "desc" }, { semester: "desc" }],
    select: {
      registrationReference: true,
      academicSession: true,
      semester: true,
      totalUnits: true,
      status: true,
      lockedAt: true,
    },
  });

  // A specific reference that does not exist for this student is treated as
  // NOT FOUND so students can never probe another student's reference.
  if (!registration && params.reference) notFound();

  const doc = registration ? buildRegistrationDocument(user, registration) : null;
  const locked = doc ? isRegistrationFinalised(registration) : false;

  const legacy = !registration
    ? await prisma.courseRegistration.findMany({
        where: { userId: user.id, academicSession: CURRENT_SESSION, status: "ACTIVE" },
        include: { course: true },
        orderBy: { course: { code: "asc" } },
      })
    : [];

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      {params.print === "1" && <AutoPrint />}
      <div className="no-print">
        <PageHeader
          eyebrow="Student Portal"
          title="View Registration"
          description="Your official course registration document"
        />
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {doc && registration ? (
          <>
            <div className="no-print flex flex-col sm:flex-row gap-3 mb-6">
              <PrintButton />
              <Link
                href="/portal/student"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-strong px-6 py-3 font-head text-sm font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
              >
                ← Back to Dashboard
              </Link>
            </div>
            <RegistrationDocument doc={doc} locked={locked} />
          </>
        ) : (
          <Card className="p-6 sm:p-8">
            <h3 className="font-medium text-slate-600 mb-3">No finalised registration</h3>
            {legacy.length > 0 ? (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  You have active course registrations for {CURRENT_SESSION}{" "}
                  ({SEMESTER_LABELS[CURRENT_SEMESTER]}) but they have not been
                  finalised. A registration reference is issued only after you
                  submit and finalise your selection.
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {legacy.length} course(s),{" "}
                  {legacy.reduce((s, r) => s + r.course.units, 0)} credit units.
                </p>
                <Link
                  href="/portal/student/course-registration"
                  className="inline-flex items-center justify-center rounded-full bg-brand-strong px-6 py-3 font-head text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark"
                >
                  Complete Course Registration
                </Link>
              </>
            ) : (
              <p className="text-sm text-slate-500 mb-4">
                You have not registered any courses for {CURRENT_SESSION}{" "}
                ({SEMESTER_LABELS[CURRENT_SEMESTER]}).
              </p>
            )}
          </Card>
        )}

        {history.length > 0 && (
          <Card className="p-6 mt-8">
            <h3 className="font-medium text-slate-600 mb-3">Registration History</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-2 text-slate-500 font-medium">Reference</th>
                    <th className="px-3 py-2 text-slate-500 font-medium">Session</th>
                    <th className="px-3 py-2 text-slate-500 font-medium">Semester</th>
                    <th className="px-3 py-2 text-slate-500 font-medium text-center">Units</th>
                    <th className="px-3 py-2 text-slate-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: HistoryItem) => (
                    <tr key={h.registrationReference} className="border-b border-slate-200">
                      <td className="px-3 py-2">
                        <Link
                          href={`/portal/student/view-registration?reference=${encodeURIComponent(h.registrationReference)}`}
                          className="font-medium text-brand-strong hover:underline"
                        >
                          {h.registrationReference}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{h.academicSession}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {SEMESTER_LABELS[h.semester] ?? `Semester ${h.semester}`}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-center">{h.totalUnits}</td>
                      <td className="px-3 py-2">
                        <Badge tone={isRegistrationFinalised(h) ? "red" : "neutral"}>
                          {h.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
