// Sheet-driven roster sync: the public Google Sheet (SPREADSHEET_ID) is the
// source of truth for staff and student users. The "staff" tab provisions all
// staff accounts (staff no, role, faculty/department snapshots) and the
// "students" tab provisions all student accounts (registration no, category,
// faculty/department, per-department programme link).
//
// The portal authenticates against the database (password hashes, MFA,
// rate-limiting, password history), so this script materialises the sheet
// roster into PostgreSQL. It is safe to re-run: profile fields are refreshed,
// passwords are never overwritten, and rows already in the DB are updated in
// place.
//
// Usage: npm run db:sync-roster [-- --from=data] [-- --purge-stale-students]
//   (default)            sync from the Google Sheet staff/students tabs
//   --from=data          sync from data/staff.csv + data/students.csv instead
//   --purge-stale-students  delete roster students absent from the synced set
//
// The students tab uses a 13-column positional layout that the generated
// data/students.csv mirrors (Reg No, Surname, First Name, Other names, Faculty,
// Department, Gender, State, Local_Government, DOB, Phone, Email, Category).
import "dotenv/config";
import * as fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const SPREADSHEET_ID = "1cu9Wm1fN8f-cKeDj5LEeSFGxQsF9Z7IAjsBZpF4Pvz8";
const DEFAULT_PASSWORD = "UniAbuja@2026";

// Seed demo student usernames/reg numbers that are never part of the roster and
// must survive a stale-student purge (the seed is the source for these).
const KEEP_STUDENT_REG_NOS = new Set(["12/345ABC/678", "UA/PG1234/567890", "99/123XYZ/456"]);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Google Sheets fetch + RFC-4180-ish CSV parsing (gviz `out:csv`).
// ---------------------------------------------------------------------------

function gvizUrl(sheet: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
}

async function fetchSheetCsv(sheet: string): Promise<string | null> {
  try {
    const res = await fetch(gvizUrl(sheet), {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Sheets request failed with ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`Failed to fetch "${sheet}" tab: ${err}`);
    return null;
  }
}

// --from=data: read the generated CSV files in data/ instead of the sheet. The
// staff.csv mirrors the staff tab (15 cols); students.csv mirrors the students
// tab (13 cols).
function readDataFile(name: "staff" | "students"): string | null {
  const path = `data/${name}.csv`;
  try {
    return fs.readFileSync(path, "utf8");
  } catch (err) {
    console.error(`Failed to read ${path}: ${err}`);
    return null;
  }
}

function rosterSource(name: "staff" | "students"): Promise<string | null> {
  return process.argv.includes("--from=data") ? Promise.resolve(readDataFile(name)) : fetchSheetCsv(name);
}

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

// ---------------------------------------------------------------------------
// Value normalisation
// ---------------------------------------------------------------------------

function normalizeSex(value: string | undefined): "MALE" | "FEMALE" | null {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "MALE") return "MALE";
  if (v === "FEMALE") return "FEMALE";
  return null;
}

// Staff phones arrive in scientific notation (8.03E+09) that loses the leading
// "0"; reconstruct the familiar 11-digit Nigerian mobile shape.
function normalizePhone(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const sci = /^(\d+(?:\.\d+)?)E([+-]?\d+)$/i.exec(raw);
  if (sci) {
    const digits = String(Math.round(parseFloat(`${sci[1]}e${sci[2]}`)));
    return digits.length === 10 ? `0${digits}` : digits;
  }
  return raw.replace(/[^0-9]/g, "") || null;
}

// Students tab DOB is DD/MM/YYYY; masked values ("########") are dropped.
function parseDob(value: string | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return null;
  const [d, m, y] = raw.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function slugDepartment(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Roster → role / programme mapping
// ---------------------------------------------------------------------------

// Sheet "Role" → portal role. Values with no portal equivalent are skipped
// (never guessed), so no staff member is silently granted an unchecked role.
const STAFF_ROLE_MAP: Record<string, string> = {
  LECTURER: "LECTURER",
  HOD: "HOD",
  DEAN: "DEAN",
  REGISTRY: "REGISTRY",
  BURSARY: "BURSARY",
  STUDENT_AFFAIRS: "STUDENT_AFFAIRS",
  IT_ADMIN: "IT_ADMIN",
  EXAMS_RECORDS: "EXAMS_RECORDS",
  PG_SCHOOL: "PG_SCHOOL",
  SIWES: "SIWES",
  DVC_OVERSIGHT: "DVC_OVERSIGHT",
  VC: "VC",
};

type CategoryConfig = {
  programmeType: string;
  durationYears: number;
  name: (department: string) => string;
  code: (department: string) => string;
};

// Students carry a category but no programme, so one Programme row is created
// per (department × category) and students are linked to it.
const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  UNDERGRADUATE: {
    programmeType: "UTME",
    durationYears: 4,
    name: (d) => `B.Sc. ${d}`,
    code: (d) => `UG-${slugDepartment(d)}`,
  },
  POSTGRADUATE: {
    programmeType: "PG",
    durationYears: 2,
    name: (d) => `M.Sc. ${d}`,
    code: (d) => `PG-${slugDepartment(d)}`,
  },
  DISTANCE_LEARNING: {
    programmeType: "DISTANCE_LEARNING",
    durationYears: 4,
    name: (d) => `B.Sc. ${d} (Distance Learning)`,
    code: (d) => `DL-${slugDepartment(d)}`,
  },
  REMEDIAL: {
    programmeType: "UTME",
    durationYears: 1,
    name: (d) => `Remedial ${d}`,
    code: (d) => `RM-${slugDepartment(d)}`,
  },
  INSTITUTE_OF_EDUCATION: {
    programmeType: "UTME",
    durationYears: 4,
    name: (d) => `B.Ed. ${d}`,
    code: (d) => `IOE-${slugDepartment(d)}`,
  },
};

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type RowMap = Record<string, string>;

function headerIndex(header: string[]): RowMap {
  const idx: RowMap = {};
  header.forEach((cell, i) => {
    const key = cell.trim().toLowerCase();
    if (key && !(key in idx)) idx[key] = String(i);
  });
  return idx;
}

function cell(row: string[], map: RowMap, key: string): string | undefined {
  const i = map[key];
  return i === undefined ? undefined : (row[Number(i)] ?? "").trim();
}

async function importStaff(): Promise<{ created: number; updated: number; skipped: number }> {
  const csv = await rosterSource("staff");
  if (!csv) return { created: 0, updated: 0, skipped: 0 };
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    console.error("staff tab has no data rows.");
    return { created: 0, updated: 0, skipped: 0 };
  }

  const idx = headerIndex(rows[0]);
  const required = ["staff id", "full name", "first name", "surname", "role", "email"];
  if (required.some((k) => !(k in idx))) {
    console.error(`Unexpected staff header: ${rows[0].join(",")}`);
    return { created: 0, updated: 0, skipped: 0 };
  }

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const verifiedAt = new Date();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const staffNo = cell(row, idx, "staff id") ?? "";
    const sheetRole = (cell(row, idx, "role") ?? "").toUpperCase();
    const role = STAFF_ROLE_MAP[sheetRole];
    const email = cell(row, idx, "email") ?? "";
    const facultyRaw = cell(row, idx, "faculty") ?? "";
    const firstName = cell(row, idx, "first name") ?? "";
    const surname = cell(row, idx, "surname") ?? "";
    const fullName = cell(row, idx, "full name") ?? "";
    const department = cell(row, idx, "department") ?? "";
    const sex = normalizeSex(cell(row, idx, "sex"));
    const phone = normalizePhone(cell(row, idx, "phone number"));

    if (!staffNo || !role || !email || !firstName) {
      skipped++;
      continue;
    }

    // Non-teaching units carry their unit name in the Department column and
    // have no academic faculty, so no faculty string is stored (keeps Dean
    // faculty scoping unambiguous).
    const faculty = facultyRaw && facultyRaw !== "Non-Teaching" ? facultyRaw : null;

    const data = {
      email,
      firstName,
      lastName: surname,
      fullName,
      role,
      faculty,
      department,
      sex,
      phone,
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
      mustChangePassword: true,
    };
    const existing = await prisma.user.findUnique({ where: { staffNo } });
    if (existing) {
      await prisma.user.update({ where: { staffNo }, data });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          username: staffNo,
          passwordHash,
          staffNo,
          ...data,
        },
      });
      created++;
    }
  }
  return { created, updated, skipped };
}

async function importStudents(): Promise<{ created: number; updated: number; skipped: number }> {
  const csv = await rosterSource("students");
  if (!csv) return { created: 0, updated: 0, skipped: 0 };
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    console.error("students tab has no data rows.");
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Header detection: the generated file (and pasted tab) header row reads
  // "Reg No,Surname,First Name,Other names,...". Older layouts started with
  // "Registration Number ..."; both are skipped. Positional columns after the
  // header: 0 Reg No, 1 Surname, 2 First Name, 3 Other names, 4 Faculty,
  // 5 Department, 6 Gender, 7 State, 8 Local_Government, 9 DOB, 10 Phone,
  // 11 Email, 12 Category.
  const body = rows.filter((r) => !/^(reg\s*no|registration\s+number)/i.test(r[0] ?? ""));
  if (body.length === 0) {
    console.error("students tab has no data rows after the header.");
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Ensure a Programme per (department × category) actually present.
  const programmeByKey = new Map<string, string>();
  const wanted = new Map<string, { department: string; category: string }>();
  for (const row of body) {
    const department = (row[5] ?? "").trim();
    const category = (row[12] ?? "").trim().toUpperCase();
    if (!department || !CATEGORY_CONFIG[category]) continue;
    wanted.set(`${category}|${department}`, { department, category });
  }
  for (const { department, category } of wanted.values()) {
    const cfg = CATEGORY_CONFIG[category];
    const code = cfg.code(department);
    const programme = await prisma.programme.upsert({
      where: { code },
      update: { name: cfg.name(department), programmeType: cfg.programmeType, durationYears: cfg.durationYears },
      create: {
        code,
        name: cfg.name(department),
        programmeType: cfg.programmeType,
        durationYears: cfg.durationYears,
        tuitionCents: 0,
        capacity: 200,
      },
    });
    programmeByKey.set(`${category}|${department}`, programme.id);
  }

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const verifiedAt = new Date();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of body) {
    const regNo = (row[0] ?? "").trim();
    const surname = (row[1] ?? "").trim();
    const firstName = (row[2] ?? "").trim();
    const otherNames = (row[3] ?? "").trim();
    const email = (row[11] ?? "").trim();
    const department = (row[5] ?? "").trim();
    const category = (row[12] ?? "").trim().toUpperCase();
    const sex = normalizeSex(row[6]);
    const phone = normalizePhone(row[10]);
    const dateOfBirth = parseDob(row[9]);
    const programmeId = programmeByKey.get(`${category}|${department}`) ?? null;
    const fullName = [firstName, otherNames, surname].filter(Boolean).join(" ").trim();

    if (!regNo || !email || !firstName || !CATEGORY_CONFIG[category]) {
      skipped++;
      continue;
    }

    const data = {
      email,
      firstName,
      lastName: surname,
      fullName,
      role: "STUDENT",
      faculty: (row[4] ?? "").trim() || null,
      department,
      studentCategory: category,
      sex,
      phone,
      dateOfBirth,
      programmeId,
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
      mustChangePassword: true,
    };
    const existing = await prisma.user.findUnique({ where: { registrationNo: regNo } });
    if (existing) {
      await prisma.user.update({ where: { registrationNo: regNo }, data });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          username: regNo,
          passwordHash,
          registrationNo: regNo,
          ...data,
        },
      });
      created++;
    }
  }
  return { created, updated, skipped };
}

// Deletes roster students (role STUDENT with a registrationNo) that are not part
// of the just-synced set and not in the seed keep-list. Runs only when
// --purge-stale-students is passed, so a plain re-run against a partially
// pasted sheet can never wipe rows.
async function purgeStaleStudents(importedRegNos: Set<string>): Promise<number> {
  const roster = await prisma.user.findMany({
    where: { role: "STUDENT", registrationNo: { not: null } },
    select: { id: true, registrationNo: true },
  });
  const staleIds = roster
    .filter((u) => !importedRegNos.has(u.registrationNo!) && !KEEP_STUDENT_REG_NOS.has(u.registrationNo!))
    .map((u) => u.id);
  if (staleIds.length === 0) return 0;

  const chunk = (arr: string[], size: number): string[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  for (const ids of chunk(staleIds, 500)) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  return staleIds.length;
}

async function main() {
  const fromData = process.argv.includes("--from=data");
  const purgeStale = process.argv.includes("--purge-stale-students");
  console.log(fromData ? "Syncing staff + students from data/*.csv…" : "Syncing staff + students from the Google Sheet roster…");
  const staff = await importStaff();
  console.log(`Staff: ${staff.created} created, ${staff.updated} updated, ${staff.skipped} skipped.`);
  const students = await importStudents();
  console.log(`Students: ${students.created} created, ${students.updated} updated, ${students.skipped} skipped.`);
  if (purgeStale) {
    // Re-derive the imported reg numbers from the same source so the purge only
    // removes students that are genuinely absent from the roster being applied.
    const csv = await rosterSource("students");
    const importedRegNos = new Set<string>();
    if (csv) {
      for (const row of parseCsv(csv)) {
        if (/^(reg\s*no|registration\s+number)/i.test(row[0] ?? "")) continue;
        const regNo = (row[0] ?? "").trim();
        if (regNo) importedRegNos.add(regNo);
      }
    }
    const purged = await purgeStaleStudents(importedRegNos);
    console.log(`Students purged (absent from roster): ${purged}.`);
  }
  console.log("Roster sync complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
