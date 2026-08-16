// One-off backfill: set User.faculty from data/staff.csv (matches the
// Fac_Dept_All structure). Safe to re-run; skips rows with no faculty.
// Usage: npx tsx scripts/backfill-faculty.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

async function main() {
  const rows = parseCsv(readFileSync("data/staff.csv", "utf8"));
  if (rows.length < 2) { console.error("staff.csv is empty."); process.exit(1); }

  const header = rows[0];
  const staffIdx = header.indexOf("Staff ID");
  const facultyIdx = header.indexOf("Faculty");
  if (staffIdx < 0 || facultyIdx < 0) {
    console.error(`Unexpected header: ${header.join(",")}`);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  const byFaculty = new Map<string, string[]>();
  for (const r of rows.slice(1)) {
    const staffNo = (r[staffIdx] ?? "").trim();
    const faculty = (r[facultyIdx] ?? "").trim();
    if (!staffNo || !faculty) { skipped++; continue; }
    byFaculty.set(faculty, [...(byFaculty.get(faculty) ?? []), staffNo]);
  }
  for (const [faculty, staffNos] of byFaculty) {
    const res = await prisma.user.updateMany({
      where: { staffNo: { in: staffNos }, OR: [{ faculty: null }, { faculty: "" }] },
      data: { faculty },
    });
    updated += res.count;
  }
  console.log(
    `Backfilled faculty for ${updated} users across ${byFaculty.size} faculties (skipped ${skipped} rows without staff no / faculty).`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
