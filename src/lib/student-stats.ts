// Departmental student dashboard — derivation, aggregation, filtering and
// pagination. All statistics are computed from the HOD's own department scope
// (enforced server-side by the caller via the `department` filter) and from a
// single fetch of that department's students — no N+1 queries, no client-side
// aggregation of the university-wide population.
import { prisma } from "@/lib/prisma";
import {
  CURRENT_SESSION,
  CURRENT_SESSION_START_YEAR,
  admissionYearFromRegNo,
  studentLevel,
  departmentMaxLevel,
  STUDENT_CATEGORY_LABELS,
  type StudentCategory,
} from "@/lib/constants";

// Reference date for age calculations: 15 September of the current session's
// start year (the conventional start of the Nigerian academic year). Age is
// always derived from `dateOfBirth` at request time — it is never stored.
export const AGE_REFERENCE_DATE = new Date(Date.UTC(CURRENT_SESSION_START_YEAR, 8, 15));

export const AGE_BRACKETS: { label: string; min: number; max: number }[] = [
  { label: "Below 18", min: 0, max: 17 },
  { label: "18–20", min: 18, max: 20 },
  { label: "21–23", min: 21, max: 23 },
  { label: "24–26", min: 24, max: 26 },
  { label: "27–29", min: 27, max: 29 },
  { label: "30–34", min: 30, max: 34 },
  { label: "35–39", min: 35, max: 39 },
  { label: "40–49", min: 40, max: 49 },
  { label: "50+", min: 50, max: Number.POSITIVE_INFINITY },
];

// Minimum valid-age sample before min/max/mean/median are reported.
export const MIN_AGE_SAMPLE = 5;

export const REGISTER_PAGE_SIZE = 25;

// Display label + filter value used for students with no programme assigned.
// The filter is matched against the derived programme *name* because bulk
// student records may lack a programmeId (see applyStudentFilters).
export const NO_PROGRAMME = "(no programme)";

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function ageOn(dateOfBirth: Date, ref: Date = AGE_REFERENCE_DATE): number | null {
  if (!(dateOfBirth instanceof Date) || Number.isNaN(dateOfBirth.getTime())) return null;
  let age = ref.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = ref.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age < 0 ? 0 : age;
}

export function bracketForAge(age: number | null): string | null {
  if (age == null) return null;
  for (const b of AGE_BRACKETS) {
    if (age >= b.min && age <= b.max) return b.label;
  }
  return "50+";
}

export function admissionSessionFromRegNo(regNo: string | null | undefined): string | null {
  const y = admissionYearFromRegNo(regNo);
  return y == null ? null : `${y}/${y + 1}`;
}

// ---------------------------------------------------------------------------
// Row model + fetch (department-scoped)
// ---------------------------------------------------------------------------

export interface StudentRow {
  id: string;
  registrationNo: string | null;
  username: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  dateOfBirth: Date | null;
  department: string | null;
  faculty: string | null;
  status: string;
  studentCategory: string | null;
  programmeId: string | null;
  programmeName: string | null;
  admissionSession: string | null;
  level: number | null;
  age: number | null;
  ageBracket: string | null;
}

type StudentUser = {
  id: string;
  registrationNo: string | null;
  username: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  dateOfBirth: Date | null;
  department: string | null;
  faculty: string | null;
  status: string;
  studentCategory: string | null;
  programmeId: string | null;
  programme: { name: string } | null;
};

function toStudentRow(u: StudentUser, maxLevel: number): StudentRow {
  const regNo = u.registrationNo ?? u.username;
  const age = u.dateOfBirth ? ageOn(u.dateOfBirth) : null;
  return {
    id: u.id,
    registrationNo: u.registrationNo,
    username: u.username,
    fullName: u.fullName,
    firstName: u.firstName,
    lastName: u.lastName,
    sex: u.sex,
    dateOfBirth: u.dateOfBirth,
    department: u.department,
    faculty: u.faculty,
    status: u.status,
    studentCategory: u.studentCategory,
    programmeId: u.programmeId,
    programmeName: u.programme?.name ?? null,
    admissionSession: admissionSessionFromRegNo(regNo),
    level: studentLevel(regNo, maxLevel),
    age,
    ageBracket: bracketForAge(age),
  };
}

const STUDENT_SELECT = {
  id: true,
  registrationNo: true,
  username: true,
  fullName: true,
  firstName: true,
  lastName: true,
  sex: true,
  dateOfBirth: true,
  department: true,
  faculty: true,
  status: true,
  studentCategory: true,
  programmeId: true,
  programme: { select: { name: true } },
} as const;

export async function fetchDepartmentStudents(
  department: string,
  maxLevel: number,
): Promise<StudentRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "STUDENT", department },
    select: STUDENT_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return users.map((u) => toStudentRow(u as StudentUser, maxLevel));
}

// A single department student by record id — the department is part of the
// WHERE clause, so a URL parameter can never surface a student from another
// department. Returns null when the student is not in the HOD's department.
export async function fetchDepartmentStudentById(
  department: string,
  id: string,
  maxLevel: number,
): Promise<StudentRow | null> {
  const u = await prisma.user.findFirst({
    where: { role: "STUDENT", department, id },
    select: STUDENT_SELECT,
  });
  return u ? toStudentRow(u as StudentUser, maxLevel) : null;
}

// Every student in the faculty's departments (the caller resolves the faculty's
// departments first). Levels are derived per student using their own
// department's maximum level, so a 5-year Law or Engineering student and a
// 4-year B.Sc. student in the same faculty are each placed on their correct
// session-derived level.
export async function fetchFacultyStudents(
  departments: string[],
): Promise<StudentRow[]> {
  if (departments.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { role: "STUDENT", department: { in: departments } },
    select: STUDENT_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return users.map((u) => toStudentRow(u as StudentUser, departmentMaxLevel(u.department ?? "")));
}

// A single faculty student by record id. The department set is part of the
// WHERE clause, so a URL parameter can never surface a student from another
// faculty.
export async function fetchFacultyStudentById(
  departments: string[],
  id: string,
): Promise<StudentRow | null> {
  if (departments.length === 0) return null;
  const u = await prisma.user.findFirst({
    where: { role: "STUDENT", department: { in: departments }, id },
    select: STUDENT_SELECT,
  });
  return u ? toStudentRow(u as StudentUser, departmentMaxLevel(u.department ?? "")) : null;
}

// Every student in the university (used by the Governance & Oversight students
// view). Levels are derived per student using their own department's maximum
// level, matching the faculty-scoped fetch.
export async function fetchUniversityStudents(): Promise<StudentRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: STUDENT_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return users.map((u) => toStudentRow(u as StudentUser, departmentMaxLevel(u.department ?? "")));
}

// Display name for a register row, preferring the formal "Surname, First Name"
// format and falling back to the stored fullName when parts are missing.
export function displayName(
  r: Pick<StudentRow, "lastName" | "firstName" | "fullName">,
): string {
  const surname = (r.lastName ?? "").trim();
  const first = (r.firstName ?? "").trim();
  if (surname && first) return `${surname}, ${first}`;
  return r.fullName?.trim() || surname || first || "—";
}

// Human label for a stored status, e.g. "ACTIVE" → "Active", "ACTIVE_ENROLLED"
// → "Active Enrolled". Falls back to the raw value when not title-casable.
export function statusLabel(status: string): string {
  const raw = (status ?? "").trim();
  if (!raw) return raw;
  return raw
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Level coordination & advising (reuses the existing LevelCoordinator and
// LevelAdvisorAssignment models — no second coordination system here)
// ---------------------------------------------------------------------------

export interface LevelCoordinatorInfo {
  level: number;
  academicSession: string;
  coordinatorId: string;
  coordinatorName: string;
  staffNo: string | null;
}

// Coordinators for a department + session. NULL when a level has none.
export async function fetchDepartmentCoordinators(
  department: string,
  academicSession: string,
): Promise<LevelCoordinatorInfo[]> {
  const rows = await prisma.levelCoordinator.findMany({
    where: { department, academicSession },
    include: { coordinator: { select: { id: true, fullName: true, staffNo: true } } },
    orderBy: { level: "asc" },
  });
  return rows.map((c) => ({
    level: c.level,
    academicSession: c.academicSession,
    coordinatorId: c.coordinator?.id ?? "",
    coordinatorName: c.coordinator?.fullName ?? "—",
    staffNo: c.coordinator?.staffNo ?? null,
  }));
}

export interface DepartmentAdviser {
  level: number;
  programmeId: string | null;
  adviserId: string;
  adviserName: string;
}

// ACTIVE level-adviser assignments for a department + session. Programme-scoped
// assignments and department-wide assignments both come back here so the caller
// can resolve a student's adviser in memory (no N+1 queries).
export async function fetchDepartmentLevelAdvisers(
  department: string,
  academicSession: string,
): Promise<DepartmentAdviser[]> {
  const rows = await prisma.levelAdvisorAssignment.findMany({
    where: { department, academicSession, status: "ACTIVE" },
    select: {
      level: true,
      programmeId: true,
      adviserId: true,
      adviser: { select: { fullName: true } },
    },
  });
  return rows.map((a) => ({
    level: a.level,
    programmeId: a.programmeId,
    adviserId: a.adviserId,
    adviserName: a.adviser.fullName,
  }));
}

// Resolve a student's adviser from the batch of department assignments: a
// programme-scoped adviser for the student's level wins; otherwise the
// department-wide adviser for that level. Returns null when none applies.
export function resolveStudentAdviser(
  student: { level: number | null; programmeId: string | null },
  advisers: DepartmentAdviser[],
): string | null {
  if (student.level == null) return null;
  const scoped = advisers.find(
    (a) => a.level === student.level && a.programmeId != null && a.programmeId === student.programmeId,
  );
  if (scoped) return scoped.adviserName;
  const deptWide = advisers.find((a) => a.level === student.level && a.programmeId == null);
  return deptWide?.adviserName ?? null;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface StudentFilters {
  session?: string;
  level?: number;
  programme?: string;
  category?: string;
  sex?: string;
  status?: string;
  ageBracket?: string;
  q?: string;
}

// URL-encoded active filters, mirrored to the client filter bar.
export interface ActiveStudentFilters {
  session?: string;
  level?: string;
  programme?: string;
  category?: string;
  sex?: string;
  status?: string;
  age?: string;
  q?: string;
  page?: string;
}

export interface ParsedStudentFilters {
  filters: StudentFilters;
  active: ActiveStudentFilters;
  page: number;
}

// Validate raw query parameters against the department's own option lists and
// turn them into a safe filter set + the active (URL) filter object. Any value
// that is not in the department's option list is dropped, so a manipulated URL
// can never reach a foreign department's data.
export function parseStudentFilters(
  params: Record<string, string | string[] | undefined>,
  options: FilterOptions,
): ParsedStudentFilters {
  const asString = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" ? v : undefined;
  const session = asString(params.session);
  const level = asString(params.level);
  const programme = asString(params.programme);
  const category = asString(params.category);
  const sex = asString(params.sex);
  const status = asString(params.status);
  const age = asString(params.age);

  const levelValues = new Set(options.levels.map(String));
  const programmeValues = new Set(options.programmes);
  const categoryValues = new Set(options.categories.map((c) => c.value));
  const sexValues = new Set(options.sexes.map((s) => s.value));
  const statusValues = new Set(options.statuses.map((s) => s.value));
  const ageValues = new Set(options.ageBrackets);

  const sessionF = session && options.sessions.includes(session) ? session : undefined;
  const levelF = level && levelValues.has(level) ? Number(level) : undefined;
  const programmeF = programme && programmeValues.has(programme) ? programme : undefined;
  const categoryF = category && categoryValues.has(category) ? category : undefined;
  const sexF = sex && sexValues.has(sex) ? sex : undefined;
  const statusF = status && statusValues.has(status) ? status : undefined;
  const ageF = age && ageValues.has(age) ? age : undefined;
  const qF = asString(params.q)?.trim().slice(0, 120) || undefined;
  const pageRaw = Number(asString(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const filters: StudentFilters = {
    session: sessionF,
    level: levelF,
    programme: programmeF,
    category: categoryF,
    sex: sexF,
    status: statusF,
    ageBracket: ageF,
    q: qF,
  };
  const active: ActiveStudentFilters = {
    ...(sessionF ? { session: sessionF } : {}),
    ...(levelF != null ? { level: String(levelF) } : {}),
    ...(programmeF ? { programme: programmeF } : {}),
    ...(categoryF ? { category: categoryF } : {}),
    ...(sexF ? { sex: sexF } : {}),
    ...(statusF ? { status: statusF } : {}),
    ...(ageF ? { age: ageF } : {}),
    ...(qF ? { q: qF } : {}),
  };
  return { filters, active, page };
}

export function applyStudentFilters(rows: StudentRow[], f: StudentFilters): StudentRow[] {
  const q = f.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.session && r.admissionSession !== f.session) return false;
    if (f.level != null && r.level !== f.level) return false;
    if (f.programme) {
      const matches =
        f.programme === NO_PROGRAMME ? r.programmeName == null : r.programmeName === f.programme;
      if (!matches) return false;
    }
    if (f.category && r.studentCategory !== f.category) return false;
    if (f.sex && r.sex !== f.sex) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.ageBracket && r.ageBracket !== f.ageBracket) return false;
    if (q) {
      const hay = `${r.registrationNo ?? ""} ${r.username} ${r.fullName} ${r.programmeName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface Distribution {
  label: string;
  count: number;
  pct: number; // share of the total, one decimal place
}

type SortMode = "count" | "asc" | "desc";

function distribution(
  rows: StudentRow[],
  key: (r: StudentRow) => string | number | null,
  label: (k: string) => string,
  mode: SortMode = "count",
): { buckets: Distribution[]; unknown: number } {
  const map = new Map<string, number>();
  let unknown = 0;
  for (const r of rows) {
    const k = key(r);
    if (k == null || k === "") {
      unknown += 1;
      continue;
    }
    const sk = String(k);
    map.set(sk, (map.get(sk) ?? 0) + 1);
  }
  const total = rows.length;
  const buckets: Distribution[] = [...map.entries()].map(([k, count]) => ({
    label: label(k),
    count,
    pct: total ? Math.round((count / total) * 1000) / 10 : 0,
  }));
  if (mode === "asc") buckets.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  else if (mode === "desc") buckets.sort((a, b) => b.label.localeCompare(a.label, undefined, { numeric: true }));
  else buckets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { buckets, unknown };
}

export interface CrossTab {
  rowKey: string;
  cells: Record<string, number>;
  total: number;
}

export interface CrossTabResult {
  rows: CrossTab[];
  columns: string[];
}

export function crossTab(
  rows: StudentRow[],
  rowKey: (r: StudentRow) => string | null,
  colKey: (r: StudentRow) => string | null,
): CrossTabResult {
  const cols = new Set<string>();
  const map = new Map<string, Record<string, number>>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const rk = rowKey(r);
    if (rk == null) continue;
    const ck = colKey(r) ?? "(none)";
    cols.add(ck);
    let row = map.get(rk);
    if (!row) {
      row = {};
      map.set(rk, row);
    }
    row[ck] = (row[ck] ?? 0) + 1;
    totals.set(rk, (totals.get(rk) ?? 0) + 1);
  }
  return {
    rows: [...map.entries()]
      .map(([rk, cells]) => ({ rowKey: rk, cells, total: totals.get(rk) ?? 0 }))
      .sort((a, b) => a.rowKey.localeCompare(b.rowKey, undefined, { numeric: true })),
    columns: [...cols].sort(),
  };
}

export interface StudentStats {
  total: number;
  active: number;
  activePct: number | null;
  sexRatio: {
    male: number;
    female: number;
    malePct: number | null;
    femalePct: number | null;
    ratio: string | null;
  };
  undergraduate: number;
  undergraduatePct: number | null;
  postgraduate: number;
  postgraduatePct: number | null;
  byLevel: { buckets: Distribution[]; unknown: number };
  bySession: { buckets: Distribution[]; unknown: number };
  bySex: { buckets: Distribution[]; unknown: number };
  byProgramme: { buckets: Distribution[]; unknown: number };
  byCategory: { buckets: Distribution[]; unknown: number };
  byStatus: { buckets: Distribution[]; unknown: number };
  byAgeBracket: { buckets: Distribution[]; unknown: number };
  programmeCount: number;
  ageStats: { n: number; min: number | null; max: number | null; mean: number | null; median: number | null };
  ageProfileByLevel: { level: string; n: number; mean: number | null; median: number | null }[];
  levelSex: CrossTabResult;
  programmeLevel: CrossTabResult;
  levelStatus: CrossTabResult;
  dataQuality: {
    missingDob: number;
    missingSex: number;
    missingProgramme: number;
    missingLevel: number;
    missingCategory: number;
    missingStatus: number;
    duplicateRegNo: number;
  };
}

export function categoryLabel(category: string | null | undefined): string {
  if (category == null) return "(none)";
  return STUDENT_CATEGORY_LABELS[category as StudentCategory] ?? category;
}

export function computeStudentStats(rows: StudentRow[]): StudentStats {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "ACTIVE").length;
  const pctOf = (n: number): number | null => (total ? Math.round((n / total) * 1000) / 10 : null);

  const male = rows.filter((r) => r.sex === "Male").length;
  const female = rows.filter((r) => r.sex === "Female").length;
  const sexRatio = {
    male,
    female,
    malePct: pctOf(male),
    femalePct: pctOf(female),
    ratio: male > 0 && female > 0 ? `${(male / female).toFixed(2)} : 1` : null,
  };

  // Category counts use the stored values from the shared category registry —
  // never hard-coded display names.
  const undergraduate = rows.filter((r) => r.studentCategory === "UNDERGRADUATE").length;
  const postgraduate = rows.filter((r) => r.studentCategory === "POSTGRADUATE").length;

  const ages = rows
    .map((r) => r.age)
    .filter((a): a is number => a != null)
    .sort((a, b) => a - b);
  const n = ages.length;
  const mean = n ? ages.reduce((a, b) => a + b, 0) / n : null;
  const median = n
    ? n % 2
      ? ages[(n - 1) / 2]
      : (ages[n / 2 - 1] + ages[n / 2]) / 2
    : null;
  const ageStats = {
    n,
    min: n ? ages[0] : null,
    max: n ? ages[n - 1] : null,
    mean: n >= MIN_AGE_SAMPLE ? Math.round(mean! * 10) / 10 : null,
    median: n >= MIN_AGE_SAMPLE ? Math.round(median! * 10) / 10 : null,
  };

  const ageByLevel = new Map<string, number[]>();
  for (const r of rows) {
    if (r.age == null || r.level == null) continue;
    const key = `${r.level}`;
    const list = ageByLevel.get(key) ?? [];
    list.push(r.age);
    ageByLevel.set(key, list);
  }
  const ageProfileByLevel = [...ageByLevel.entries()]
    .map(([level, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      const sMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const sMedian =
        sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      return {
        level,
        n: list.length,
        mean: Math.round(sMean * 10) / 10,
        median: Math.round(sMedian * 10) / 10,
      };
    })
    .sort((a, b) => a.level.localeCompare(b.level, undefined, { numeric: true }));

  const seenRegNos = new Set<string>();
  let duplicateRegNo = 0;
  for (const r of rows) {
    if (!r.registrationNo) continue;
    if (seenRegNos.has(r.registrationNo)) duplicateRegNo += 1;
    seenRegNos.add(r.registrationNo);
  }

  const byLevel = distribution(rows, (r) => r.level, (k) => `${k} Level`, "asc");
  const byAgeBracket = distribution(rows, (r) => r.ageBracket, (k) => k, "count");
  // Age brackets must follow the natural bracket order, not alphabetical.
  byAgeBracket.buckets.sort((a, b) => {
    const ia = AGE_BRACKETS.findIndex((x) => x.label === a.label);
    const ib = AGE_BRACKETS.findIndex((x) => x.label === b.label);
    return (ia === -1 ? AGE_BRACKETS.length : ia) - (ib === -1 ? AGE_BRACKETS.length : ib);
  });

  const programmeNames = new Set(rows.map((r) => r.programmeName).filter((p): p is string => p != null));

  return {
    total,
    active,
    activePct: pctOf(active),
    sexRatio,
    undergraduate,
    undergraduatePct: pctOf(undergraduate),
    postgraduate,
    postgraduatePct: pctOf(postgraduate),
    byLevel,
    bySession: distribution(rows, (r) => r.admissionSession, (k) => k, "desc"),
    bySex: distribution(rows, (r) => r.sex, (k) => k, "count"),
    byProgramme: distribution(rows, (r) => r.programmeName, (k) => k, "count"),
    byCategory: distribution(rows, (r) => r.studentCategory, categoryLabel, "count"),
    byStatus: distribution(rows, (r) => r.status, statusLabel, "count"),
    byAgeBracket,
    programmeCount: programmeNames.size,
    ageStats,
    ageProfileByLevel,
    levelSex: crossTab(rows, (r) => (r.level == null ? null : `${r.level}`), (r) => r.sex ?? "(unknown)"),
    programmeLevel: crossTab(rows, (r) => r.programmeName, (r) => (r.level == null ? null : `${r.level}`)),
    levelStatus: crossTab(rows, (r) => (r.level == null ? null : `${r.level}`), (r) => r.status ?? "(unknown)"),
    dataQuality: {
      missingDob: rows.filter((r) => r.dateOfBirth == null).length,
      missingSex: rows.filter((r) => r.sex == null).length,
      missingProgramme: rows.filter((r) => r.programmeId == null).length,
      missingLevel: rows.filter((r) => r.level == null).length,
      missingCategory: rows.filter((r) => r.studentCategory == null).length,
      missingStatus: rows.filter((r) => r.status == null).length,
      duplicateRegNo,
    },
  };
}

// ---------------------------------------------------------------------------
// Filter option lists (built from the full department scope so options do not
// disappear while a filter is active) + pagination
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  sessions: string[];
  levels: number[];
  programmes: string[];
  categories: FilterOption[];
  sexes: FilterOption[];
  statuses: FilterOption[];
  ageBrackets: string[];
}

export function buildFilterOptions(rows: StudentRow[]): FilterOptions {
  const programmes = new Set(rows.map((r) => r.programmeName).filter((p): p is string => p != null));
  if (rows.some((r) => r.programmeName == null)) programmes.add(NO_PROGRAMME);
  return {
    sessions: [...new Set(rows.map((r) => r.admissionSession).filter((s): s is string => s != null))].sort().reverse(),
    levels: [...new Set(rows.map((r) => r.level).filter((l): l is number => l != null))].sort((a, b) => a - b),
    programmes: [...programmes].sort((a, b) => {
      const aSentinel = a === NO_PROGRAMME ? 1 : 0;
      const bSentinel = b === NO_PROGRAMME ? 1 : 0;
      return aSentinel - bSentinel || a.localeCompare(b);
    }),
    categories: [...new Set(rows.map((r) => r.studentCategory).filter((c): c is string => c != null))]
      .map((c) => ({ value: c, label: categoryLabel(c) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    sexes: [...new Set(rows.map((r) => r.sex).filter((s): s is string => s != null))]
      .map((s) => ({ value: s, label: s }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    statuses: [...new Set(rows.map((r) => r.status))]
      .map((s) => ({ value: s, label: statusLabel(s) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ageBrackets: AGE_BRACKETS.filter((b) => rows.some((r) => r.ageBracket === b.label)).map((b) => b.label),
  };
}

export function paginate<T>(items: T[], page: number, pageSize = REGISTER_PAGE_SIZE): {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
} {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    totalPages,
    total: items.length,
  };
}

// ---------------------------------------------------------------------------
// CSV export (respects whatever row set the caller has already scoped+filtered)
// ---------------------------------------------------------------------------

export const STUDENT_CSV_HEADERS = [
  "Registration No",
  "Surname",
  "First Name",
  "Full Name",
  "Programme",
  "Level",
  "Admission Session",
  "Status",
  "Student Category",
] as const;

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function studentRowsToCsv(rows: StudentRow[]): string {
  const lines = rows.map((r) =>
    [
      r.registrationNo ?? "",
      r.lastName ?? "",
      r.firstName ?? "",
      r.fullName,
      r.programmeName ?? "",
      r.level ?? "",
      r.admissionSession ?? "",
      r.status ?? "",
      r.studentCategory ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [STUDENT_CSV_HEADERS.join(","), ...lines].join("\r\n");
}

// Convenience re-export so pages can label the current session consistently.
export { CURRENT_SESSION };
