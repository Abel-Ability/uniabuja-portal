// Single source of truth for the institution's academic & organisational
// structure, hosted on Google Sheets so it can be updated without redeploying:
//   - Fac_Dept_All  → faculties and their departments
//   - Centres2      → institutes, directorates, centres, units & schools
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
  const csv = await fetchSheetCsv("Centres2");
  if (!csv) return [];

  const centres = new Set<string>();
  for (const row of parseCsv(csv)) {
    const name = (row[0] ?? "").trim();
    if (!name || name.toLowerCase() === CENTRES_HEADER) continue;
    centres.add(name);
  }

  return [...centres].sort((a, b) => a.localeCompare(b));
}
