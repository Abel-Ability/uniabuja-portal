import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { can } from "@/lib/constants";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  SectionHeading,
  Table,
  EmptyState,
} from "@/components/ui";
import { MeritListFilters } from "./merit-list-filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Merit List" };

type SearchParams = {
  session?: string;
  faculty?: string;
  department?: string;
  programme?: string;
  eligibility?: string;
  cutoff?: string;
  category?: string;
  status?: string;
  search?: string;
  minScore?: string;
  maxScore?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (!can(user.role, "ADMISSIONS", "R")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Access Denied" description="Your role does not have access to this page." />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Card>
            <p className="text-sm text-slate/70">You do not have permission to view the merit list.</p>
          </Card>
        </div>
      </div>
    );
  }

  const params = await searchParams;

  // Build filter conditions
  const where: Record<string, unknown> = { status: { notIn: ["DRAFT", "WITHDRAWN"] } };

  if (params.faculty) where.faculty = params.faculty;
  if (params.department) where.department = params.department;
  if (params.programme) where.programmeName = params.programme;
  if (params.eligibility === "eligible") where.eligible = true;
  if (params.eligibility === "ineligible") where.eligible = false;
  if (params.cutoff === "met") where.cutoffMet = true;
  if (params.cutoff === "not_met") where.cutoffMet = false;
  if (params.category) where.committeeCategory = params.category;
  if (params.status) where.status = params.status;

  if (params.minScore) where.compositeScore = { gte: parseFloat(params.minScore) };
  if (params.maxScore) where.compositeScore = { lte: parseFloat(params.maxScore) };

  if (params.search) {
    const search = params.search.trim();
    where.OR = [
      { applicantName: { contains: search, mode: "insensitive" } },
      { jambNo: { contains: search, mode: "insensitive" } },
      { applicantEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.application.findMany({
    where,
    include: { programme: true },
    orderBy: [
      { compositeScore: "desc" },
      { meritRank: "asc" },
      { createdAt: "asc" },
    ],
  });

  // Get unique values for filter dropdowns
  const [faculties, departments, programmes] = await Promise.all([
    prisma.application.findMany({
      where: { faculty: { not: null } },
      select: { faculty: true },
      distinct: ["faculty"],
    }),
    prisma.application.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.application.findMany({
      where: { programmeName: { not: null } },
      select: { programmeName: true },
      distinct: ["programmeName"],
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admission Committee"
        title="Merit List"
        description="Ranked eligible applicants for the current admission session"
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        {/* Filters */}
        <MeritListFilters
          faculties={faculties.map((f) => f.faculty!).filter(Boolean)}
          departments={departments.map((d) => d.department!).filter(Boolean)}
          programmes={programmes.map((p) => p.programmeName!).filter(Boolean)}
          currentParams={params}
        />

        {/* Results */}
        <section aria-label="Merit list results">
          <SectionHeading
            title={`${applications.length} Applicant${applications.length !== 1 ? "s" : ""}`}
            subtitle="Ranked by composite admission score (highest first)"
          />

          {applications.length > 0 ? (
            <Table headers={["Rank", "Applicant", "Programme", "Score", "Cut-off", "Eligibility", "Status"]}>
              {applications.map((app, index) => (
                <tr key={app.id} className="hover:bg-slate/5">
                  <td className="px-4 py-3 text-sm font-medium">{app.meritRank ?? index + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/admissions/applications/${app.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {app.applicantName ?? "Unknown"}
                    </Link>
                    <p className="text-xs text-slate/60">{app.jambNo ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{app.programmeName ?? app.programme?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {app.compositeScore !== null ? `${app.compositeScore.toFixed(2)}/100` : "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.cutoffMet === true ? "MET" : app.cutoffMet === false ? "NOT_MET" : "UNKNOWN"} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={app.eligible === true ? "brand" : app.eligible === false ? "red" : "neutral"}>
                      {app.eligible === true ? "Eligible" : app.eligible === false ? "Ineligible" : "Unknown"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No applicants found"
              body={Object.keys(params).length > 0 ? "Try adjusting your filters." : "Applications will appear here once the Google Apps Script integration is connected."}
            />
          )}
        </section>
      </div>
    </div>
  );
}
