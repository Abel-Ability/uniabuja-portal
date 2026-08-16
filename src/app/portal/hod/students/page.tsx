import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import {
  landingForRole,
  departmentMaxLevel,
  departmentLevels,
  CURRENT_SESSION,
} from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { formatDateTime } from "@/lib/utils";
import {
  fetchDepartmentStudents,
  computeStudentStats,
  buildFilterOptions,
  applyStudentFilters,
  paginate,
  parseStudentFilters,
  fetchDepartmentCoordinators,
  fetchDepartmentLevelAdvisers,
  resolveStudentAdviser,
  displayName,
  REGISTER_PAGE_SIZE,
  MIN_AGE_SAMPLE,
  AGE_REFERENCE_DATE,
  NO_PROGRAMME,
  type CrossTabResult,
  type ActiveStudentFilters,
} from "@/lib/student-stats";
import {
  PageHeader,
  Card,
  SectionHeading,
  Table,
  StatusBadge,
  EmptyState,
  Badge,
} from "@/components/ui";
import { HBars } from "@/components/hbar";
import { StudentFilters } from "@/components/student-filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Department Students" };

const BASE_PATH = "/portal/hod/students";

const nfmt = (n: number) => new Intl.NumberFormat("en-NG").format(n);

// Drill-down / pagination link builder. A stat click sets one filter and
// resets the register to page 1; pagination links keep the page.
function hrefFor(
  active: ActiveStudentFilters,
  patch: Record<string, string | null>,
  keepPage = false,
): string {
  const merged: Record<string, string> = { ...active };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete merged[k];
    else merged[k] = v;
  }
  if (!keepPage) delete merged.page;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

// Export link mirrors the active filters (page excluded) so the CSV contains
// exactly the register the HOD is looking at.
function exportHrefFor(active: ActiveStudentFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(active)) {
    if (v && k !== "page") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${BASE_PATH}/export?${qs}` : `${BASE_PATH}/export`;
}

function DistributionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-head text-lg font-bold text-slate">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate/60">{subtitle}</p> : null}
      </div>
      {children}
    </Card>
  );
}

// Clickable headline statistic. Clicking the card narrows the register below
// via a query-string filter while keeping the current session scope.
function SnapshotStatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">{label}</p>
      <p className="font-head text-2xl font-bold text-slate">{value}</p>
      {hint ? <p className="text-xs text-slate/75">{hint}</p> : null}
    </>
  );
  return (
    <Card className="flex flex-col gap-1">
      {href ? (
        <Link
          href={href}
          className="flex flex-col gap-1 rounded-lg transition-colors hover:text-brand-strong"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function CrossTabTable({
  title,
  subtitle,
  rowLabel,
  result,
  colLabel,
}: {
  title: string;
  subtitle?: string;
  rowLabel: string;
  result: CrossTabResult;
  colLabel?: (c: string) => string;
}) {
  const colCount = result.columns.length + 2;
  return (
    <Card className="overflow-hidden">
      <h3 className="font-head text-lg font-bold text-slate">{title}</h3>
      {subtitle ? <p className="mb-3 mt-0.5 text-xs text-slate/60">{subtitle}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
              <th scope="col" className="px-3 py-2">
                {rowLabel}
              </th>
              {result.columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 text-right">
                  {colLabel ? colLabel(c) : c.replaceAll("_", " ")}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate/10">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-6 text-center text-slate/60">
                  No data
                </td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <tr key={row.rowKey}>
                  <td className="px-3 py-2 font-medium text-slate">{row.rowKey}</td>
                  {result.columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-right tabular-nums text-slate">
                      {row.cells[c] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate">
                    {row.total}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RegisterPagination({
  page,
  totalPages,
  total,
  pageHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageHref: (p: number) => string;
}) {
  const start = total === 0 ? 0 : (page - 1) * REGISTER_PAGE_SIZE + 1;
  const end = Math.min(page * REGISTER_PAGE_SIZE, total);
  const link =
    "inline-flex items-center rounded-full border border-slate/25 px-4 py-1.5 font-head text-xs font-semibold text-slate transition-colors hover:border-brand/40 hover:text-brand-strong disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate/70">
        Showing <span className="font-semibold text-slate">{nfmt(start)}–{nfmt(end)}</span> of{" "}
        <span className="font-semibold text-slate">{nfmt(total)}</span> students
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-2">
        <Link href={pageHref(page - 1)} aria-disabled={page <= 1} className={link}>
          Previous
        </Link>
        <span className="text-sm text-slate/70">
          Page {page} of {nfmt(totalPages)}
        </span>
        <Link href={pageHref(page + 1)} aria-disabled={page >= totalPages} className={link}>
          Next
        </Link>
      </nav>
    </div>
  );
}

function QualityRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate/10 bg-slate/5 px-3 py-2">
      <span className="text-sm text-slate/80">{label}</span>
      <Badge tone={count > 0 ? "amber" : "brand"}>{nfmt(count)}</Badge>
    </li>
  );
}

export default async function HodStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isHodRole(session.user.role)) redirect(landingForRole(session.user.role));
  const { user } = session;
  const dept = user.department;
  const faculty = user.faculty ?? "—";
  const maxLevel = departmentMaxLevel(dept ?? "");
  const offeredLevels = departmentLevels(maxLevel);

  const rows = dept ? await fetchDepartmentStudents(dept, maxLevel) : [];
  const options = buildFilterOptions(rows);
  const params = await searchParams;
  const { filters, active, page } = parseStudentFilters(params, options);

  const [coordinators, advisers] = dept
    ? await Promise.all([
        fetchDepartmentCoordinators(dept, CURRENT_SESSION),
        fetchDepartmentLevelAdvisers(dept, CURRENT_SESSION),
      ])
    : [[], []];

  const filtered = applyStudentFilters(rows, filters);
  const stats = computeStudentStats(filtered);
  const paged = paginate(filtered, page);
  const total = stats.total;

  // Headline statistics describe the department population: the only register
  // dimension that narrows them is the academic session. Level, programme,
  // category, sex and search apply to the analytics and the register below,
  // not to this snapshot.
  const summaryRows = filters.session
    ? applyStudentFilters(rows, { session: filters.session })
    : rows;
  const snapshot = computeStudentStats(summaryRows);
  const summaryByLevel = new Map<number, number>();
  for (const r of summaryRows) {
    if (r.level != null) summaryByLevel.set(r.level, (summaryByLevel.get(r.level) ?? 0) + 1);
  }

  const programmesInDept = options.programmes.filter((p) => p !== NO_PROGRAMME).length;
  const currentSessionCount = stats.bySession.buckets.find((b) => b.label === CURRENT_SESSION)?.count;
  const ageRefLabel = AGE_REFERENCE_DATE.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const getLevelHref = (item: { label: string; count: number; pct: number }) => {
    const lv = item.label.replace(/\s*Level$/i, "");
    return /^\d+$/.test(lv) ? hrefFor(active, { level: lv }) : undefined;
  };
  const getCategoryHref = (item: { label: string; count: number; pct: number }) => {
    const v = options.categories.find((c) => c.label === item.label)?.value;
    return v ? hrefFor(active, { category: v }) : undefined;
  };
  const getStatusHref = (item: { label: string; count: number; pct: number }) => {
    const v = options.statuses.find((s) => s.label === item.label)?.value;
    return v ? hrefFor(active, { status: v }) : undefined;
  };

  const quality = [
    { label: "Date of birth missing", count: stats.dataQuality.missingDob },
    { label: "Sex missing", count: stats.dataQuality.missingSex },
    { label: "Programme missing", count: stats.dataQuality.missingProgramme },
    { label: "Level missing", count: stats.dataQuality.missingLevel },
    { label: "Category missing", count: stats.dataQuality.missingCategory },
    { label: "Status missing", count: stats.dataQuality.missingStatus },
    { label: "Duplicate registration numbers", count: stats.dataQuality.duplicateRegNo },
  ];
  const qualityWarnings = quality.filter((q) => q.count > 0).length;

  const sessionQualifier = filters.session ? ` for ${filters.session}` : "";
  const pctOrDash = (p: number | null) => (p == null ? "—" : `${p}%`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HoD Workspace"
        title="Students"
        description={`Departmental student dashboard and register for ${dept ?? "your department"}. Every statistic is calculated live from the student database and always limited to your department.`}
      />

      <section aria-label="Department context" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Department</p>
          <p className="font-head text-lg font-bold text-slate">{dept ?? "—"}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Faculty</p>
          <p className="font-head text-lg font-bold text-slate">{faculty}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Current session</p>
          <p className="font-head text-lg font-bold text-slate">{CURRENT_SESSION}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Programmes</p>
          <p className="font-head text-lg font-bold text-slate">{nfmt(programmesInDept)}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate/75">Last refreshed</p>
          <p className="text-sm font-semibold text-slate">{formatDateTime(new Date())}</p>
        </Card>
      </section>

      <section aria-label="Key student statistics">
        <SectionHeading
          title={`Key Student Statistics${sessionQualifier}`}
          subtitle="Whole-department counts for the selected academic session. Click a card to filter the register below."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotStatCard
            label="Total students"
            value={nfmt(snapshot.total)}
            hint={filters.session ? `In ${filters.session} · 100%` : "Whole department roster · 100%"}
          />
          <SnapshotStatCard
            label="Active students"
            value={nfmt(snapshot.active)}
            hint={`${pctOrDash(snapshot.activePct)} of total`}
            href={hrefFor(active, { status: "ACTIVE" })}
          />
          <SnapshotStatCard
            label="Male"
            value={nfmt(snapshot.sexRatio.male)}
            hint={`${pctOrDash(snapshot.sexRatio.malePct)} of total`}
            href={hrefFor(active, { sex: "Male" })}
          />
          <SnapshotStatCard
            label="Female"
            value={nfmt(snapshot.sexRatio.female)}
            hint={`${pctOrDash(snapshot.sexRatio.femalePct)} of total`}
            href={hrefFor(active, { sex: "Female" })}
          />
          <SnapshotStatCard
            label="Undergraduate"
            value={nfmt(snapshot.undergraduate)}
            hint={`${pctOrDash(snapshot.undergraduatePct)} of total`}
            href={hrefFor(active, { category: "UNDERGRADUATE" })}
          />
          <SnapshotStatCard
            label="Postgraduate"
            value={nfmt(snapshot.postgraduate)}
            hint={`${pctOrDash(snapshot.postgraduatePct)} of total`}
            href={hrefFor(active, { category: "POSTGRADUATE" })}
          />
          {snapshot.ageStats.n >= MIN_AGE_SAMPLE ? (
            <SnapshotStatCard
              label="Average age"
              value={`${snapshot.ageStats.mean} years`}
              hint={`Median ${snapshot.ageStats.median} yrs · ${snapshot.ageStats.n} DOB records`}
            />
          ) : (
            <SnapshotStatCard
              label="Average age"
              value="—"
              hint={`${snapshot.ageStats.n} DOB records — ${MIN_AGE_SAMPLE} required to compute`}
            />
          )}
        </div>
      </section>

      <section aria-label="Students by level">
        <SectionHeading
          title={`Students by Level${sessionQualifier}`}
          subtitle="Head counts by level for the whole department (selected session). Level is derived from the admission year in each student's registration number. Click a bar to filter the register."
        />
        <DistributionCard title="Department population by level">
          <HBars
            items={snapshot.byLevel.buckets}
            unknown={snapshot.byLevel.unknown}
            unknownLabel="No level recorded"
            getHref={getLevelHref}
          />
        </DistributionCard>
      </section>

      <section aria-label="Level coordination and advising">
        <SectionHeading
          title="Level coordination & advising"
          subtitle={`Who coordinates and advises each level in the ${CURRENT_SESSION} session. Manage assignments from the Level Coordinators and Level Advisers pages.`}
          action={
            <Link
              href="/portal/hod/level-coordinators"
              className="inline-flex items-center rounded-full border border-slate/25 px-4 py-1.5 font-head text-xs font-semibold text-slate transition-colors hover:border-brand/40 hover:text-brand-strong"
            >
              Manage coordinators
            </Link>
          }
        />
        {offeredLevels.length === 0 ? (
          <EmptyState title="No levels offered" body="The department's programme length could not be determined." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offeredLevels.map((lv) => {
              const coordinator = coordinators.find((c) => c.level === lv);
              const adviser = advisers.find((a) => a.level === lv && a.programmeId == null);
              const count = summaryByLevel.get(lv) ?? 0;
              return (
                <Card key={lv} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="brand">{lv} Level</Badge>
                    <span className="text-xs text-slate/60">
                      {nfmt(count)} student{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Coordinator</dt>
                      <dd className="text-right text-slate">
                        {coordinator ? (
                          coordinator.coordinatorName
                        ) : (
                          <span className="text-slate/50">No Level Coordinator Assigned</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Adviser</dt>
                      <dd className="text-right text-slate">
                        {adviser ? (
                          adviser.adviserName
                        ) : (
                          <span className="text-slate/50">No Level Adviser Assigned</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Analytics" className="space-y-8">
        <SectionHeading
          title="Analytics"
          subtitle="Every chart and table below reflects the current filter selection. Any filter change recomputes all statistics at once."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionCard
            title="Students by Sex"
            subtitle="Click a bar to filter the register to that sex."
          >
            <HBars items={stats.bySex.buckets} unknown={stats.bySex.unknown} unknownLabel="Sex unknown" getHref={(i) => hrefFor(active, { sex: i.label })} />
          </DistributionCard>

          <DistributionCard
            title="Students by Age Bracket"
            subtitle={`Age computed from Date of Birth as at ${ageRefLabel} (start of the ${CURRENT_SESSION} session).`}
          >
            <HBars
              items={stats.byAgeBracket.buckets}
              unknown={stats.byAgeBracket.unknown}
              unknownLabel="Age unavailable"
              getHref={(i) => hrefFor(active, { age: i.label })}
            />
          </DistributionCard>

          <DistributionCard
            title="Students by Academic Session"
            subtitle="Admission session derived from the registration number (e.g. 26/… → 2026/2027). Click to filter."
          >
            {currentSessionCount != null ? (
              <p className="text-xs text-slate/60">
                Current session ({CURRENT_SESSION}): <span className="font-semibold text-slate">{nfmt(currentSessionCount)}</span>
              </p>
            ) : null}
            <HBars items={stats.bySession.buckets} unknown={stats.bySession.unknown} unknownLabel="Session unknown" getHref={(i) => hrefFor(active, { session: i.label })} />
          </DistributionCard>

          <DistributionCard
            title="Students by Programme"
            subtitle="Uses the programme recorded on each student record."
          >
            <HBars
              items={stats.byProgramme.buckets}
              unknown={stats.byProgramme.unknown}
              unknownLabel="No programme recorded"
              getHref={(i) => hrefFor(active, { programme: i.label })}
            />
          </DistributionCard>

          <DistributionCard
            title="Students by Student Category"
            subtitle="Categories are read from each student record, never assumed."
          >
            <HBars items={stats.byCategory.buckets} unknown={stats.byCategory.unknown} unknownLabel="Category unknown" getHref={getCategoryHref} />
          </DistributionCard>

          <DistributionCard title="Students by Status" subtitle="Actual statuses present in the database.">
            <HBars items={stats.byStatus.buckets} unknown={stats.byStatus.unknown} unknownLabel="Status unknown" getHref={getStatusHref} />
          </DistributionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <CrossTabTable
            title="Programme × Level"
            subtitle="Head counts per programme and level in the current selection."
            rowLabel="Programme"
            result={stats.programmeLevel}
            colLabel={(c) => `${c} L`}
          />
          <CrossTabTable title="Level × Sex" rowLabel="Level" result={stats.levelSex} />
          <CrossTabTable
            title="Level × Status"
            rowLabel="Level"
            result={stats.levelStatus}
            colLabel={(c) => c.replaceAll("_", " ")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <DistributionCard
            title="Age Statistics"
            subtitle={
              stats.ageStats.n >= MIN_AGE_SAMPLE
                ? `Based on ${stats.ageStats.n} records with a valid date of birth.`
                : `Only ${stats.ageStats.n} valid DOB records — at least ${MIN_AGE_SAMPLE} are required before min/max/mean/median are shown.`
            }
          >
            {stats.ageStats.n >= MIN_AGE_SAMPLE ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Average age</dt>
                  <dd className="font-head text-lg font-bold text-slate">{stats.ageStats.mean} years</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Median age</dt>
                  <dd className="font-head text-lg font-bold text-slate">{stats.ageStats.median} years</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Youngest</dt>
                  <dd className="font-head text-lg font-bold text-slate">{stats.ageStats.min} years</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate/60">Oldest</dt>
                  <dd className="font-head text-lg font-bold text-slate">{stats.ageStats.max} years</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate/60">
                Add dates of birth for more students to unlock the full age profile.
              </p>
            )}
          </DistributionCard>

          <DistributionCard
            title="Demographic Indicators"
            subtitle="Summaries of the current filter selection."
          >
            <ul className="space-y-2 text-sm text-slate/80">
              <li className="flex items-center justify-between gap-3">
                <span>Sex ratio (male : female)</span>
                <span className="font-semibold text-slate">{stats.sexRatio.ratio ?? "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Students per programme</span>
                <span className="font-semibold text-slate">
                  {stats.programmeCount ? `${(total / stats.programmeCount).toFixed(1)} avg` : "—"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Programmes with students</span>
                <span className="font-semibold text-slate">{nfmt(stats.programmeCount)}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Levels with students</span>
                <span className="font-semibold text-slate">{nfmt(stats.byLevel.buckets.length)}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate/60">
              Progression, retention and dropout rates are not reported: the student records do not carry the
              longitudinal data needed to compute them without misleading estimates.
            </p>
          </DistributionCard>

          <DistributionCard
            title="Age Profile by Level"
            subtitle="Mean and median age per level (levels with valid DOB only)."
          >
            {stats.ageProfileByLevel.length === 0 ? (
              <p className="text-sm text-slate/60">No age data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate/10 bg-slate/5 text-xs font-semibold uppercase tracking-wide text-slate/70">
                      <th scope="col" className="px-3 py-2">Level</th>
                      <th scope="col" className="px-3 py-2 text-right">Students</th>
                      <th scope="col" className="px-3 py-2 text-right">Mean age</th>
                      <th scope="col" className="px-3 py-2 text-right">Median age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate/10">
                    {stats.ageProfileByLevel.map((row) => (
                      <tr key={row.level}>
                        <td className="px-3 py-2 font-medium text-slate">{row.level} Level</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate">{row.n}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate">{row.mean}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate">{row.median}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DistributionCard>
        </div>
      </section>

      <section aria-label="Student filters">
        <StudentFilters options={options} active={active} basePath={BASE_PATH} />
      </section>

      {total === 0 ? (
        <EmptyState
          title="No students in this department"
          body="Students registered under your department will appear here once they are enrolled."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No students match the current filters"
          body="Adjust the filters above or clear them to see the full department register."
        />
      ) : (
        <section aria-label="Student register">
          <SectionHeading
            title="Student Register"
            subtitle={`${nfmt(filtered.length)} student${filtered.length === 1 ? "" : "s"} match the current filters. Session is the admission session derived from the registration number.`}
            action={
              <Link
                href={exportHrefFor(active)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-strong px-4 py-1.5 font-head text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Export CSV
              </Link>
            }
          />
          <Table
            headers={[
              "Registration No",
              "Student Name",
              "Programme",
              "Level",
              "Session",
              "Status",
              "Level Adviser",
              "Actions",
            ]}
          >
            {paged.items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate">{s.registrationNo ?? s.username}</td>
                <td className="px-4 py-3 font-medium text-slate">{displayName(s)}</td>
                <td className="px-4 py-3 text-slate">{s.programmeName ?? "—"}</td>
                <td className="px-4 py-3">
                  {s.level != null ? (
                    <Badge tone={s.level > maxLevel ? "gold" : "brand"}>{s.level} Level</Badge>
                  ) : (
                    <span className="text-slate/50">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate">{s.admissionSession ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate">
                  {resolveStudentAdviser(s, advisers) ?? <span className="text-slate/50">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`${BASE_PATH}/${s.id}`}
                    className="inline-flex items-center rounded-full border border-slate/25 px-3 py-1 font-head text-xs font-semibold text-slate transition-colors hover:border-brand/40 hover:text-brand-strong"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          <RegisterPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            pageHref={(p) => hrefFor(active, { page: String(p) }, true)}
          />
        </section>
      )}

      <section aria-label="Data quality">
        <SectionHeading
          title="Data Quality"
          subtitle={
            qualityWarnings > 0
              ? `${qualityWarnings} of ${quality.length} checks found incomplete records in the current selection. Use the register to identify and correct them — records are never changed automatically.`
              : "All records look complete in the current selection."
          }
        />
        <Card>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quality.map((q) => (
              <QualityRow key={q.label} label={q.label} count={q.count} />
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
