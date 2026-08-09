import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAcademicUnits, getCentres } from "@/lib/sheets";
import {
  PageHeader,
  Card,
  Table,
  Badge,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import { StaffProfileForm } from "./profile-forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profiles & Research" };

function formatUpdated(d?: Date): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ProfilesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  const isLecturerOrHod = ["LECTURER", "HOD_DEAN"].includes(user.role);

  const [academicUnits, centres, researchOutputs, myStaffProfile] = await Promise.all([
    getAcademicUnits(),
    getCentres(),
    prisma.researchOutput.findMany({
      orderBy: { year: "desc" },
      include: { user: true },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: user.id },
      include: { user: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 7 · Directory"
        title="Profiles & Research"
        description="Academic unit directory, institutes and centres, research outputs and staff profiles."
      />
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
        <section aria-label="Academic unit directory">
          <SectionHeading
            title="Academic units"
            subtitle="Faculties and their departments, sourced live from the registry sheet."
          />
          {academicUnits.faculties.length === 0 ? (
            <EmptyState title="No academic units available" />
          ) : (
            <div className="space-y-6">
              {academicUnits.faculties.map((f) => (
                <div key={f.name}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-head text-xl font-bold text-slate">{f.name}</h2>
                      {f.college ? (
                        <p className="text-xs font-medium uppercase tracking-wide text-slate/50">{f.college}</p>
                      ) : null}
                    </div>
                    <Badge tone="slate">
                      {f.departments.length} {f.departments.length === 1 ? "department" : "departments"}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {f.departments.map((d) => (
                      <Card key={d} className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-slate">{d}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Institutes & centres">
          <SectionHeading
            title="Institutes, directorates & centres"
            subtitle="University institutes, directorates, centres, units and schools."
          />
          {centres.length === 0 ? (
            <EmptyState title="No institutes or centres available" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {centres.map((c) => (
                <Card key={c} className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-slate">{c}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Research outputs">
          <SectionHeading
            title="Research outputs"
            subtitle="Publications, datasets and repository entries registered by staff and students."
          />
          {researchOutputs.length === 0 ? (
            <EmptyState
              title="No research outputs registered"
              body="Research outputs will appear here once staff register their publications."
            />
          ) : (
            <Table headers={["Title", "Type", "Author", "Year", "DOI", "Repository"]}>
              {researchOutputs.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate">{r.title}</td>
                  <td className="px-4 py-3 text-slate/70">{r.outputType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate">{r.user.fullName}</td>
                  <td className="px-4 py-3 text-slate/70">{r.year}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate/70">{r.doi ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate/70">
                    {r.repositoryUrl ? (
                      <a
                        href={r.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline hover:text-brand-dark"
                      >
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>

        <section aria-label="Staff profile">
          <SectionHeading
            title="Your staff profile"
            subtitle="Your public academic profile and research identifiers."
          />
          {myStaffProfile ? (
            <Card className="mb-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate">{myStaffProfile.user.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    Designation
                  </dt>
                  <dd className="mt-1 text-sm text-slate/80">{myStaffProfile.designation ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    ORCID
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-slate/80">{myStaffProfile.orcid ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    Scopus author ID
                  </dt>
                  <dd className="mt-1 text-sm text-slate/80">{myStaffProfile.scopUserId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/75">
                    Updated
                  </dt>
                  <dd className="mt-1 text-sm text-slate/80">{formatUpdated(myStaffProfile.updatedAt)}</dd>
                </div>
              </dl>
              {myStaffProfile.bio ? (
                <p className="mt-4 border-t border-slate/10 pt-4 text-sm text-slate/80">
                  {myStaffProfile.bio}
                </p>
              ) : null}
            </Card>
          ) : null}

          {isLecturerOrHod ? (
            <Card>
              <h3 className="mb-4 font-head text-lg font-bold text-slate">Edit your profile</h3>
              <StaffProfileForm
                initial={{
                  designation: myStaffProfile?.designation,
                  bio: myStaffProfile?.bio,
                  orcid: myStaffProfile?.orcid,
                }}
              />
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}
