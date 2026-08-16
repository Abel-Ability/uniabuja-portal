// Safe, additive, idempotent activation of the recovered Executive &
// Governance demo accounts against the CURRENT database.
//
//   tsx scripts/activate-executive-governance-demo.ts precheck   # read-only
//   tsx scripts/activate-executive-governance-demo.ts apply      # upsert only
//   tsx scripts/activate-executive-governance-demo.ts verify     # post-check
//
// Guarantees:
//   - never truncates, resets, migrates or seeds;
//   - never deletes a user or membership;
//   - upserts users by their unique email, preserving unrelated attributes;
//   - creates CommitteeMembership rows only when absent, and only ever makes
//     the two required governance memberships ACTIVE;
//   - aborts unless DATABASE_URL targets the local demo database
//     (localhost:5432 / database "portal");
//   - idempotent: a second run changes nothing.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { isHodRole } from "../src/lib/hod";
import {
  can,
  ROLE_LABELS,
} from "../src/lib/constants";
import {
  membershipIsActive,
  RESULT_STAGE_ORDER,
} from "../src/lib/governance";

const DEMO_PASSWORD = "UniAbuja@2026";

type AccountConfig = {
  key: string;
  username: string;
  email: string;
  role: string;
  faculty?: string;
  department?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  staffNo?: string;
};

const ACCOUNTS: AccountConfig[] = [
  {
    key: "hod",
    username: "ACA140",
    email: "aca140@uniabuja.edu.ng",
    role: "HOD",
    faculty: "Physical Science",
    department: "Computer Science",
    firstName: "Chidiebere",
    lastName: "Ibe",
    fullName: "Prof. Chidiebere Ibe",
    phone: "08170000000",
    staffNo: "ACA140",
  },
  {
    key: "dean",
    username: "ACA8614",
    email: "aca8614@uniabuja.edu.ng",
    role: "DEAN",
    faculty: "Physical Science",
    department: "Computer Science",
    firstName: "Michael",
    lastName: "Egbuna",
    fullName: "Prof. Michael Egbuna",
    phone: "80600000000",
    staffNo: "ACA8614",
  },
  {
    key: "sbc",
    username: "AC13",
    email: "sbc@uniabuja.edu.ng",
    role: "SBC_CHAIRMAN",
    firstName: "Prof.",
    lastName: "Bala Ibrahim",
    fullName: "Prof. Bala Ibrahim",
    phone: "+2348032223334",
    staffNo: "AC13",
  },
  {
    key: "gov",
    username: "BD24",
    email: "gov@uniabuja.edu.ng",
    role: "GOVERNANCE_OVERSIGHT_MEMBER",
    firstName: "Prof.",
    lastName: "Hauwa Sani",
    fullName: "Prof. Hauwa Sani",
    phone: "+2348043334445",
    staffNo: "BD24",
  },
  {
    key: "dvc",
    username: "ACA5129",
    email: "aca5129@uniabuja.edu.ng",
    role: "DVC_OVERSIGHT",
    faculty: "CHS-Nursing and Allied Health Sciences",
    department: "Public Health",
    firstName: "Simisola",
    lastName: "Usman",
    fullName: "Prof. Simisola Usman",
    phone: "07090000000",
    staffNo: "ACA5129",
  },
];

type MembershipConfig = {
  key: string;
  email: string;
  committee: string;
  designation: string;
  status: string;
};

const MEMBERSHIPS: MembershipConfig[] = [
  {
    key: "dvc",
    email: "aca5129@uniabuja.edu.ng",
    committee: "GOVERNANCE_OVERSIGHT",
    designation: "CHAIRMAN",
    status: "ACTIVE",
  },
  {
    key: "gov",
    email: "gov@uniabuja.edu.ng",
    committee: "GOVERNANCE_OVERSIGHT",
    designation: "MEMBER",
    status: "ACTIVE",
  },
];

const STAFF_ROLES = [
  "LECTURER",
  "HOD",
  "DEAN",
  "REGISTRY",
  "BURSARY",
  "STUDENT_AFFAIRS",
  "EXAMS_RECORDS",
  "PG_SCHOOL",
  "SIWES",
  "TIMETABLE",
  "IT_ADMIN",
  "DVC_OVERSIGHT",
  "SBC_CHAIRMAN",
  "GOVERNANCE_OVERSIGHT_MEMBER",
  "VC",
  "VERIFIER",
];

// ---------------------------------------------------------------------------
// Safety guard: only ever operate against the local demo database.
// ---------------------------------------------------------------------------
function assertSafeTarget(): void {
  const raw = process.env.DATABASE_URL ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a parseable URL — aborting.");
  }
  const host = url.hostname;
  const db = url.pathname.replace(/^\//, "").split("?")[0];
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal) {
    throw new Error(
      `DATABASE_URL host "${host}" is not localhost — refusing to run.`,
    );
  }
  if (db !== "portal") {
    throw new Error(
      `DATABASE_URL database "${db}" is not "portal" — refusing to run.`,
    );
  }
  if (raw.includes("schema=")) {
    const schema = /schema=([^&?]+)/.exec(raw)?.[1];
    if (schema && schema !== "public") {
      throw new Error(
        `DATABASE_URL schema "${schema}" is not "public" — refusing to run.`,
      );
    }
  }
  console.log(`Target database: ${host}:${url.port ?? "5432"}/${db} (schema public)`);
}

// ---------------------------------------------------------------------------
// Integrity snapshot (read-only counts of unrelated data).
// ---------------------------------------------------------------------------
async function integritySnapshot() {
  const [users, staff, students, courses, offerings, registrations, headers,
    payments, invoices, auditLogs, memberships, results] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.course.count(),
    prisma.courseOffering.count(),
    prisma.courseRegistration.count(),
    prisma.registration.count(),
    prisma.payment.count(),
    prisma.invoice.count(),
    prisma.auditLog.count(),
    prisma.committeeMembership.count(),
    prisma.result.count(),
  ]);
  return {
    User: users,
    "Staff Users": staff,
    "Student Users": students,
    Course: courses,
    CourseOffering: offerings,
    CourseRegistration: registrations,
    Registration: headers,
    Payment: payments,
    Invoice: invoices,
    AuditLog: auditLogs,
    CommitteeMembership: memberships,
    Result: results,
  };
}

function printSnapshot(label: string, snap: Record<string, number>) {
  console.log(`\n[snapshot] ${label}`);
  for (const [k, v] of Object.entries(snap)) {
    console.log(`  ${k}: ${v}`);
  }
}

function diffSnapshots(before: Record<string, number>, after: Record<string, number>) {
  const deltas: string[] = [];
  for (const key of Object.keys(before)) {
    const d = after[key] - before[key];
    deltas.push(`${key}: ${d >= 0 ? "+" : ""}${d}`);
  }
  return deltas;
}

// ---------------------------------------------------------------------------
// Precheck (read-only).
// ---------------------------------------------------------------------------
async function precheck() {
  assertSafeTarget();
  console.log("== PHASE 1 PRECHECK (read-only) ==\n");

  for (const acct of ACCOUNTS) {
    const byEmail = await prisma.user.findFirst({ where: { email: acct.email } });
    const byUsername = await prisma.user.findFirst({ where: { username: acct.username } });
    const dupByEmail = await prisma.user.findMany({ where: { email: acct.email } });
    const dupByUsername = await prisma.user.findMany({ where: { username: acct.username } });
    console.log(`\n[${acct.key}] ${acct.email}`);
    console.log(`  expected role: ${acct.role}`);
    if (byEmail) {
      console.log(
        `  by-email  -> id=${byEmail.id} username=${byEmail.username} role=${byEmail.role} ` +
          `faculty=${byEmail.faculty ?? "—"} department=${byEmail.department ?? "—"} ` +
          `status=${byEmail.status} staffNo=${byEmail.staffNo ?? "—"} ` +
          `mustChangePw=${byEmail.mustChangePassword} emailVerified=${byEmail.emailVerifiedAt ? "yes" : "no"}`,
      );
      const demoMatch = await bcrypt.compare(DEMO_PASSWORD, byEmail.passwordHash);
      console.log(`  password==demo: ${demoMatch}`);
    } else {
      console.log("  by-email  -> NOT FOUND");
    }
    if (byUsername && byUsername.id !== byEmail?.id) {
      console.log(`  by-username(${acct.username}) -> DIFFERENT user id=${byUsername.id} role=${byUsername.role}`);
    } else if (!byEmail) {
      console.log(`  by-username(${acct.username}) -> ${byUsername ? `id=${byUsername.id} role=${byUsername.role}` : "NOT FOUND"}`);
    }
    if (dupByEmail.length > 1) {
      console.log(`  DUPLICATE by-email: ${dupByEmail.map((u) => u.id).join(", ")}`);
    }
    if (dupByUsername.length > 1) {
      console.log(`  DUPLICATE by-username: ${dupByUsername.map((u) => u.id).join(", ")}`);
    }
  }

  console.log("\n[memberships]");
  for (const m of MEMBERSHIPS) {
    const user = await prisma.user.findFirst({ where: { email: m.email } });
    if (!user) {
      console.log(`  ${m.email} (${m.committee}): user missing — nothing to check`);
      continue;
    }
    const rows = await prisma.committeeMembership.findMany({
      where: { committee: m.committee, userId: user.id },
    });
    if (rows.length === 0) {
      console.log(`  ${m.email} (${m.committee}): NONE (will be created ${m.designation}/${m.status})`);
    } else {
      for (const r of rows) {
        console.log(
          `  ${m.email} (${m.committee}): id=${r.id} designation=${r.designation} ` +
            `status=${r.status} start=${r.startDate ? r.startDate.toISOString() : "—"} end=${r.endDate ? r.endDate.toISOString() : "—"}`,
        );
      }
    }
  }

  console.log("\n[other committees for the same users]");
  for (const m of MEMBERSHIPS) {
    const user = await prisma.user.findFirst({ where: { email: m.email } });
    if (!user) continue;
    const others = await prisma.committeeMembership.findMany({
      where: { userId: user.id, committee: { not: m.committee } },
    });
    if (others.length) {
      console.log(
        `  ${m.email}: ${others.map((o) => `${o.committee}/${o.designation}/${o.status}`).join(", ")}`,
      );
    }
  }

  console.log("\n[integrity snapshot (pre) ]");
  printSnapshot("before any write", await integritySnapshot());

  console.log(
    "\nPrecheck complete. Review above; no write has been performed.",
  );
}

// ---------------------------------------------------------------------------
// Apply (additive upsert, idempotent).
// ---------------------------------------------------------------------------
async function apply() {
  assertSafeTarget();
  const before = await integritySnapshot();

  const demoHash = await hashPassword(DEMO_PASSWORD);
  const verifiedAt = new Date();

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  await prisma.$transaction(async (tx) => {
    const userIdByKey = new Map<string, string>();

    for (const acct of ACCOUNTS) {
      const existing = await tx.user.findFirst({ where: { email: acct.email } });
      const demoMatch = existing
        ? await bcrypt.compare(DEMO_PASSWORD, existing.passwordHash)
        : false;

      if (!existing) {
        const createdUser = await tx.user.create({
          data: {
            username: acct.username,
            email: acct.email,
            passwordHash: demoHash,
            role: acct.role,
            firstName: acct.firstName,
            lastName: acct.lastName,
            fullName: acct.fullName,
            phone: acct.phone,
            staffNo: acct.staffNo,
            faculty: acct.faculty,
            department: acct.department,
            status: "ACTIVE",
            mustChangePassword: true,
            emailVerifiedAt: verifiedAt,
          },
        });
        userIdByKey.set(acct.key, createdUser.id);
        console.log(`[create] ${acct.email} role=${acct.role} id=${createdUser.id}`);
        created++;
        continue;
      }

      userIdByKey.set(acct.key, existing.id);
      const patch: Record<string, string | Date | boolean> = {};

      if (existing.role !== acct.role) {
        patch.role = acct.role;
        console.log(`[update] ${acct.email} role ${existing.role} -> ${acct.role}`);
      }
      if (acct.faculty !== undefined && existing.faculty !== acct.faculty) {
        patch.faculty = acct.faculty;
        console.log(`[update] ${acct.email} faculty ${existing.faculty ?? "—"} -> ${acct.faculty}`);
      }
      if (acct.department !== undefined && existing.department !== acct.department) {
        patch.department = acct.department;
        console.log(`[update] ${acct.email} department ${existing.department ?? "—"} -> ${acct.department}`);
      }
      if (existing.status !== "ACTIVE") {
        patch.status = "ACTIVE";
        console.log(`[update] ${acct.email} status ${existing.status} -> ACTIVE (demo activation)`);
      }
      if (!demoMatch) {
        patch.passwordHash = demoHash;
        patch.mustChangePassword = true;
        console.log(`[update] ${acct.email} demo password reset + forced change (was not on demo password)`);
      } else if (!existing.mustChangePassword) {
        patch.mustChangePassword = true;
        console.log(`[update] ${acct.email} mustChangePassword -> true (demo account)`);
      }
      if (!existing.emailVerifiedAt) {
        patch.emailVerifiedAt = verifiedAt;
        console.log(`[update] ${acct.email} emailVerifiedAt set (demo activation)`);
      }

      if (Object.keys(patch).length > 0) {
        await tx.user.update({ where: { id: existing.id }, data: patch });
        updated++;
      } else {
        console.log(`[unchanged] ${acct.email} already matches the recovered configuration`);
        unchanged++;
      }
    }

    for (const m of MEMBERSHIPS) {
      const userId = userIdByKey.get(m.key);
      if (!userId) {
        throw new Error(`Cannot resolve user for membership ${m.email} — aborting.`);
      }
      const existing = await tx.committeeMembership.findFirst({
        where: { committee: m.committee, userId },
      });

      if (!existing) {
        await tx.committeeMembership.create({
          data: {
            committee: m.committee,
            userId,
            designation: m.designation,
            status: m.status,
            startDate: new Date(),
          },
        });
        console.log(
          `[create] membership ${m.email} ${m.committee} ${m.designation}/${m.status}`,
        );
      } else {
        const patch: Record<string, string | Date> = {};
        if (existing.designation !== m.designation) {
          patch.designation = m.designation;
          console.log(
            `[update] membership ${m.email} designation ${existing.designation} -> ${m.designation}`,
          );
        }
        if (existing.status !== m.status) {
          patch.status = m.status;
          console.log(
            `[update] membership ${m.email} status ${existing.status} -> ${m.status}`,
          );
        }
        if (!existing.startDate) {
          patch.startDate = new Date();
          console.log(`[update] membership ${m.email} startDate set`);
        }
        if (Object.keys(patch).length > 0) {
          await tx.committeeMembership.update({
            where: { id: existing.id },
            data: patch,
          });
          updated++;
        } else {
          console.log(
            `[unchanged] membership ${m.email} ${m.committee} already ${m.designation}/${m.status}`,
          );
          unchanged++;
        }
      }
    }
  }, { maxWait: 15_000, timeout: 60_000 });

  const after = await integritySnapshot();
  console.log("\n=== apply summary ===");
  console.log(`created: ${created}, updated: ${updated}, unchanged: ${unchanged}`);
  printSnapshot("before", before);
  printSnapshot("after", after);
  console.log("\n[delta]");
  for (const line of diffSnapshots(before, after)) {
    console.log(`  ${line}`);
  }
  console.log("\nApply complete — additive upserts only, no destructive commands used.");
}

// ---------------------------------------------------------------------------
// Verify (post-activation RBAC + data checks).
// ---------------------------------------------------------------------------
async function verify() {
  assertSafeTarget();
  console.log("== POST-ACTIVATION VERIFICATION ==\n");

  let ok = true;
  const report = (name: string, pass: boolean, detail = "") => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!pass) ok = false;
  };

  console.log("[A] user accounts");
  for (const acct of ACCOUNTS) {
    const rows = await prisma.user.findMany({ where: { email: acct.email } });
    const exists = rows.length === 1;
    const roleOk = exists && rows[0].role === acct.role;
    const facultyOk =
      !exists || acct.faculty === undefined || rows[0].faculty === acct.faculty;
    const deptOk =
      !exists || acct.department === undefined || rows[0].department === acct.department;
    report(
      `${acct.email}`,
      exists && roleOk && facultyOk && deptOk && rows[0].status === "ACTIVE",
      exists
        ? `role=${rows[0].role} faculty=${rows[0].faculty ?? "—"} dept=${rows[0].department ?? "—"} status=${rows[0].status}`
        : "NOT FOUND",
    );
    if (rows.length > 1) report(`${acct.email} unique`, false, `${rows.length} rows`);
  }

  console.log("\n[B] governance membership");
  for (const m of MEMBERSHIPS) {
    const user = await prisma.user.findFirst({ where: { email: m.email } });
    if (!user) {
      report(`${m.email} → ${m.committee}`, false, "user missing");
      continue;
    }
    const rows = await prisma.committeeMembership.findMany({
      where: { committee: m.committee, userId: user.id },
    });
    report(
      `${m.email} → ${m.committee}`,
      rows.length === 1 &&
        rows[0].designation === m.designation &&
        membershipIsActive(rows[0]),
      rows.length === 1
        ? `designation=${rows[0].designation} status=${rows[0].status}`
        : `${rows.length} rows`,
    );
  }

  console.log("\n[C] RBAC (ACCESS_CONTROL_MATRIX untouched, programmatic checks)");
  report("HOD can reach HOD workspace", isHodRole("HOD"));
  report("HOD can approve results", can("HOD", "EXAMS_RECORDS", "A"));
  report("DEAN gets read-only oversight", can("DEAN", "EXAMS_RECORDS", "R"));
  report("DEAN cannot approve results", !can("DEAN", "EXAMS_RECORDS", "A"));
  report("DEAN cannot submit results", !can("DEAN", "EXAMS_RECORDS", "S"));
  report("SBC can run Senate business (write+approve)",
    can("SBC_CHAIRMAN", "SENATE", "W") && can("SBC_CHAIRMAN", "SENATE", "A"));
  report("SBC cannot approve/finalise results", !can("SBC_CHAIRMAN", "EXAMS_RECORDS", "A"));
  report("GOV member can access DVC workspace (read)", can("GOVERNANCE_OVERSIGHT_MEMBER", "EXAMS_RECORDS", "R"));
  report("GOV member cannot write", !can("GOVERNANCE_OVERSIGHT_MEMBER", "EXAMS_RECORDS", "W"));
  report("DVC reads across the board", can("DVC_OVERSIGHT", "SENATE", "R") && can("DVC_OVERSIGHT", "FEES", "R"));
  report("VC retains executive read", can("VC", "SENATE", "R") && can("VC", "HEALTH", "R"));

  console.log("\n[D] results pipeline");
  report("pipeline = SUBMITTED → HOD_APPROVED → SENATE_APPROVED → FINAL",
    JSON.stringify(RESULT_STAGE_ORDER) ===
      JSON.stringify(["SUBMITTED", "HOD_APPROVED", "SENATE_APPROVED", "FINAL"]));
  report("DEAN_APPROVED not present", !RESULT_STAGE_ORDER.includes("DEAN_APPROVED"));

  console.log("\n[E] role labels (display integrity)");
  for (const role of [
    "HOD",
    "DEAN",
    "SBC_CHAIRMAN",
    "GOVERNANCE_OVERSIGHT_MEMBER",
    "DVC_OVERSIGHT",
    "VC",
  ]) {
    report(`${role} has a label`, Boolean(ROLE_LABELS[role]?.length));
  }

  printSnapshot("current database state", await integritySnapshot());
  console.log(`\nVerification ${ok ? "PASSED" : "FAILED"}.`);
  process.exitCode = ok ? 0 : 1;
}

const cmd = process.argv[2];
const isHostValid = ["precheck", "apply", "verify"].includes(cmd ?? "");
if (!isHostValid) {
  console.error("Usage: tsx scripts/activate-executive-governance-demo.ts <precheck|apply|verify>");
  process.exit(2);
}

const run = async () => {
  try {
    if (cmd === "precheck") await precheck();
    else if (cmd === "apply") await apply();
    else await verify();
  } finally {
    await prisma.$disconnect();
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
