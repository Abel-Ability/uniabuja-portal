// Backfill sex + dateOfBirth on existing student records from data/students.csv
// (the sheet snapshot already carries Gender and Date of Birth columns).
// Run: npx tsx scripts/backfill-student-bio.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";

function parseDateOfBirth(raw: string | undefined): Date | null {
  const parts = (raw ?? "").trim().split("/");
  if (parts.length !== 3) return null;
  const [a, b, y] = parts.map((p) => Number(p));
  if ([a, b, y].some((n) => !Number.isInteger(n))) return null;
  let d = a;
  let m = b;
  if (m > 12 && d <= 12) [d, m] = [m, d];
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear() + 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) return null;
  return date;
}

async function main() {
  const abs = resolve(process.cwd(), "data/students.csv");
  const text = readFileSync(abs, "utf8");
  const rows = text
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => l.split(","));

  // Fetch every student once, then update by registration number via a
  // concurrency-limited pool (per-row sequential round trips to a remote DB
  // are too slow for 1k+ records).
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, registrationNo: true, username: true },
  });
  const byRegNo = new Map<string, string>();
  const byUsername = new Map<string, string>();
  for (const s of students) {
    if (s.registrationNo) byRegNo.set(s.registrationNo, s.id);
    if (s.username) byUsername.set(s.username, s.id);
  }

  const tasks: { id: string; sex?: string; dateOfBirth?: Date }[] = [];
  let badDob = 0;

  for (const r of rows) {
    const regNo = r[0]?.trim();
    const username = r[1]?.trim();
    const gender = r[8]?.trim();
    const dob = parseDateOfBirth(r[9]);

    if (!regNo) continue;
    const id = byRegNo.get(regNo) ?? byUsername.get(username || regNo);
    if (!id) continue;

    const data: { sex?: string; dateOfBirth?: Date } = {};
    if (gender) data.sex = gender.replace(/^\w/, (c) => c.toUpperCase());
    if (r[9]?.trim()) {
      if (dob) data.dateOfBirth = dob;
      else badDob += 1;
    }
    if (Object.keys(data).length) tasks.push({ id, ...data });
  }

  let updated = 0;
  const pool: Promise<void>[] = [];
  const CONCURRENCY = 30;
  for (let i = 0; i < tasks.length; i++) {
    const { id, ...data } = tasks[i];
    const run = prisma.user.update({ where: { id }, data }).then(() => {
      updated += 1;
    });
    pool.push(run);
    if (pool.length >= CONCURRENCY) {
      await Promise.all(pool);
      pool.length = 0;
    }
  }
  if (pool.length) await Promise.all(pool);

  console.log(`backfill done: ${updated} updated (of ${tasks.length} matched), ${badDob} invalid DOB rows skipped`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
