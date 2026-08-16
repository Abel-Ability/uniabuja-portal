// Single source of truth for the institution's academic & organisational
// structure and public content, hosted on Google Sheets so it can be updated
// without redeploying:
//   - Fac_Dept_All       → faculties and their departments
//   - Centres2           → institutes, directorates, centres, units & schools
//   - Announcements      → public notices shown in the homepage marquee
//   - Academic_Calendar  → upcoming deadlines (e.g. tuition fee deadline)
//   - Standard_Levies    → flat fee items on the public fees page
//   - Programme_Tuition  → tuition per programme (keyed by programme code)
// Each request is cached in-memory for SHEETS_TTL_MS so the public site does
// not hit Google on every page view. If the fetch fails we fall back to the
// last good payload (or an empty result) rather than failing the page.

const SPREADSHEET_ID = "1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8";
const SHEETS_TTL_MS = 10 * 60 * 1000;

// A faculty row may carry a college prefix, e.g. "CHS- Basic Clinical
// Sciences" means the faculty "Basic Clinical Sciences" belongs to the
// "College of Health Sciences". The generic rule strips whatever code
// precedes the first "-" so future college codes work without code changes.
const COLLEGE_NAMES: Record<string, string> = {
  CHS: "College of Health Sciences",
};

export type AcademicUnit = {
  name: string;
  college?: string;
  departments: string[];
};
export type AcademicUnits = {
  faculties: AcademicUnit[];
  facultyCount: number;
  departmentCount: number;
};

const cache = new Map<string, { text: string; expiresAt: number }>();

function gvizUrl(sheet: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
}

async function fetchSheetCsv(sheet: string): Promise<string | null> {
  const hit = cache.get(sheet);
  if (hit && hit.expiresAt > Date.now()) return hit.text;

  try {
    const res = await fetch(gvizUrl(sheet), {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Sheets request failed with ${res.status}`);
    const text = await res.text();
    cache.set(sheet, { text, expiresAt: Date.now() + SHEETS_TTL_MS });
    return text;
  } catch {
    const stale = cache.get(sheet);
    return stale ? stale.text : null;
  }
}

// Handles RFC-4180-ish CSV from the gviz endpoint: quoted fields, embedded
// commas, doubled quotes and line breaks inside quoted cells.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // strip carriage returns
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

const FACULTY_HEADER = "faculty";
const CENTRES_HEADER = "centre/directorate/hub/institute/school)";

function parseFaculty(value: string): { name: string; college?: string } {
  const dash = value.indexOf("-");
  if (dash > 0) {
    const code = value.slice(0, dash).trim().toUpperCase();
    return {
      name: value.slice(dash + 1).trim(),
      college: COLLEGE_NAMES[code] ?? code,
    };
  }
  return { name: value.trim() };
}

export async function getAcademicUnits(): Promise<AcademicUnits> {
  const csv = await fetchSheetCsv("Fac_Dept_All");
  if (!csv) return { faculties: [], facultyCount: 0, departmentCount: 0 };

  const grouped = new Map<string, { college?: string; departments: Set<string> }>();
  for (const row of parseCsv(csv)) {
    const rawFaculty = (row[0] ?? "").trim();
    const department = (row[1] ?? "").trim();
    if (!rawFaculty || rawFaculty.toLowerCase() === FACULTY_HEADER) continue;
    if (!department) continue;
    if (rawFaculty.toLowerCase() === "non-teaching") continue;
    const { name, college } = parseFaculty(rawFaculty);
    if (!grouped.has(name)) grouped.set(name, { college, departments: new Set() });
    grouped.get(name)!.departments.add(department);
  }

  const faculties: AcademicUnit[] = [...grouped.entries()]
    .map(([name, { college, departments }]) => ({
      name,
      college,
      departments: [...departments].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const departmentCount = faculties.reduce((n, f) => n + f.departments.length, 0);
  return { faculties, facultyCount: faculties.length, departmentCount };
}

export async function getCentres(): Promise<string[]> {
  const csv = await fetchSheetCsv("Centres_new");
  if (!csv) return [];

  const centres = new Set<string>();
  for (const row of parseCsv(csv)) {
    const name = (row[0] ?? "").trim();
    if (!name || name.toLowerCase() === CENTRES_HEADER) continue;
    centres.add(name);
  }

  return [...centres].sort((a, b) => a.localeCompare(b));
}

// ============================================================
// Public content tabs (same spreadsheet ID)
// ============================================================

export type AnnouncementItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  publishedAt: Date;
  scope: string;
  author?: { fullName: string } | null;
};

export type DeadlineItem = { title: string; endsOn: string };

export type LevyItem = {
  key: string;
  title: string;
  amountNaira: number;
  note: string;
  sortOrder: number;
};

export type ProgrammeTuitionItem = {
  code: string;
  name: string;
  programmeType: string;
  durationYears: number;
  tuitionPerAnnumNaira: number;
};

type SheetRow = Record<string, string>;
type Sheet = { headers: string[]; rows: SheetRow[] };

// Row 1 is the header row; every later row becomes an object keyed by the
// (lowercased) header names, so column order is irrelevant to the portal.
function parseSheet(csv: string): Sheet {
  const parsed = parseCsv(csv);
  if (parsed.length === 0) return { headers: [], rows: [] };
  const headers = parsed[0].map((h) => h.trim().toLowerCase().replace(/^\uFEFF/, ""));
  const rows = parsed
    .slice(1)
    .map((cells) => {
      const row: SheetRow = {};
      headers.forEach((h, i) => {
        if (h) row[h] = (cells[i] ?? "").trim();
      });
      return row;
    })
    .filter((r) => Object.keys(r).length > 0);
  return { headers, rows };
}

// Guard against missing/renamed tabs: the gviz endpoint returns an error-ish
// body for an unknown sheet, which must never be treated as real data.
function hasHeaders(sheet: Sheet, required: string[]): boolean {
  return required.every((h) => sheet.headers.includes(h));
}

function isEnabled(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "" || v === "yes" || v === "true" || v === "1";
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [month, day, year] = v.split("/").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const [month, day, year] = v.split("/").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const monthMatch = v.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}/i);
  if (monthMatch) {
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getSheetAnnouncements(): Promise<AnnouncementItem[]> {
  const csv = await fetchSheetCsv("Announcements");
  if (!csv) return [];
  const sheet = parseSheet(csv);
  if (!hasHeaders(sheet, ["title", "body"])) return [];

  return sheet.rows
    .filter((r) => isEnabled(r.active))
    .map((r) => {
      const publishedAt = parseDate(r.published_at);
      const id =
        r.key ||
        `${r.title || "announcement"}-${r.published_at || "undated"}`
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase();
      return {
        id,
        category: (r.category || "GENERAL").toUpperCase(),
        title: r.title,
        body: r.body,
        publishedAt: publishedAt ? new Date(publishedAt.getTime()) : new Date(),
        scope: (r.scope || "PUBLIC").toUpperCase() === "STAFF" ? "STAFF" : "PUBLIC",
      } satisfies AnnouncementItem;
    })
    .filter((a) => a.title || a.body)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getSheetDeadlines(): Promise<DeadlineItem[]> {
  const csv = await fetchSheetCsv("Academic_Calendar");
  if (!csv) return [];
  const sheet = parseSheet(csv);
  if (!hasHeaders(sheet, ["ends_on"])) return [];

  return sheet.rows
    .filter((r) => isEnabled(r.active))
    .map((r) => {
      const endsOn = parseDate(r.ends_on);
      if (!endsOn) return null;
      return { title: r.title || "Upcoming deadline", endsOn: endsOn.toISOString() };
    })
    .filter((d): d is DeadlineItem => d !== null)
    .sort((a, b) => new Date(a.endsOn).getTime() - new Date(b.endsOn).getTime());
}

export async function getStandardLevies(): Promise<LevyItem[]> {
  const csv = await fetchSheetCsv("Standard_Levies");
  if (!csv) return [];
  const sheet = parseSheet(csv);
  if (!hasHeaders(sheet, ["title", "amount_naira"])) return [];

  return sheet.rows
    .filter((r) => isEnabled(r.active))
    .map((r) => ({
      key: r.key || r.title || "levy",
      title: r.title,
      amountNaira: parseInt(r.amount_naira ?? "0", 10) || 0,
      note: r.note ?? "",
      sortOrder: parseInt(r.sort_order ?? "0", 10) || 0,
    }))
    .filter((l) => l.title)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export async function getProgrammeTuition(): Promise<ProgrammeTuitionItem[]> {
  const csv = await fetchSheetCsv("Programme_Tuition");
  if (!csv) return [];
  const sheet = parseSheet(csv);
  if (!hasHeaders(sheet, ["code", "tuition_per_annum_naira"])) return [];

  return sheet.rows
    .filter((r) => isEnabled(r.active) && r.code)
    .map((r) => ({
      code: r.code!,
      name: r.name ?? r.code,
      programmeType: (r.programme_type || "UTME").toUpperCase(),
      durationYears: parseInt(r.duration_years ?? "0", 10) || 0,
      tuitionPerAnnumNaira: parseInt(r.tuition_per_annum_naira ?? "0", 10) || 0,
    }));
}

// ============================================================
// Undergraduate course catalogue (Courses_UG tab)
// ============================================================

export type CourseUGItem = {
  code: string;
  title: string;
  faculty: string;
  hostingDepartment: string;
  semester: number;
  unit: number;
  prerequisites?: string[];
};

// Headers in the sheet may use different spacing/casing, so match each column
// against a list of plausible lowercased header names.
function sheetCell(row: SheetRow, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

export async function getCoursesUG(): Promise<CourseUGItem[]> {
  const csv = await fetchSheetCsv("Courses_UG");
  if (!csv) return [];
  const sheet = parseSheet(csv);
  if (!hasHeaders(sheet, ["code"])) return [];

  return sheet.rows
    .filter((r) => isEnabled(r.active) && r.code)
    .map((r) => {
      const prerequisites = sheetCell(r, ["prerequisites", "pre_requisites", "prereq"]);
      return {
        code: r.code!.trim().toUpperCase(),
        title: sheetCell(r, ["title", "course title", "course_title"]) || r.code!,
        faculty: sheetCell(r, ["faculty", "fac"]),
        hostingDepartment:
          sheetCell(r, ["hosting department", "hosting_department", "department", "dept", "host dept"]),
        semester: parseInt(sheetCell(r, ["semester", "sem"]), 10) || 1,
        unit: parseInt(sheetCell(r, ["unit", "units", "credit units", "credit_units"]), 10) || 0,
        prerequisites: prerequisites
          ? prerequisites.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
          : undefined,
      };
    })
    .filter((c) => c.hostingDepartment !== "");
}
