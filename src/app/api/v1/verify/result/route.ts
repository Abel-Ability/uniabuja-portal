import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REGEX_REF = /^RS-[A-Z0-9/]+-\d{4}$/;

type Verified = {
  fullName: string;
  registrationNo: string | null;
  academicSession: string;
  count: number;
  cgpa?: string;
};

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lim = rateLimit(`verify-result:${ip}`, 10, 60_000);
  if (!lim.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { referenceNo?: string; registrationNo?: string; academicSession?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const referenceNo = (body.referenceNo ?? "").toString().trim().toUpperCase();
  const registrationNo = (body.registrationNo ?? "").toString().trim().toUpperCase();

  if (referenceNo && !REGEX_REF.test(referenceNo)) {
    return NextResponse.json(
      { error: "referenceNo must match result reference format (RS-<regNo>-<session>)" },
      { status: 400 },
    );
  }
  if (!referenceNo && !registrationNo) {
    return NextResponse.json(
      { error: "Provide referenceNo or registrationNo" },
      { status: 400 },
    );
  }

  let verified: Verified | null = null;

  if (referenceNo) {
    const record = await prisma.verificationRecord.findFirst({
      where: { kind: "RESULT", referenceNo },
    });
    if (record) {
      const user = await prisma.user.findFirst({
        where: { registrationNo: referenceNo.split("-")[1] ?? "" },
      });
      if (record.result === "VALID") {
        verified = {
          fullName: user?.fullName ?? "Unknown",
          registrationNo: user?.registrationNo ?? null,
          academicSession: referenceNo.slice(-4),
          count: 0,
        };
      }
    }
  } else {
    const academicSession = body.academicSession ?? "2025/2026";
    const results = await prisma.result.findMany({
      where: { user: { registrationNo }, published: true },
      include: { course: true, user: true },
    });
    if (results.length > 0) {
      const units = results.reduce((a, r) => a + r.course.units, 0);
      const gradePoints = results.reduce((a, r) => {
        const map: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
        return a + (map[r.grade ?? "F"] ?? 0) * r.course.units;
      }, 0);
      verified = {
        fullName: results[0].user.fullName,
        registrationNo: results[0].user.registrationNo,
        academicSession,
        count: results.length,
        cgpa: units > 0 ? (gradePoints / units).toFixed(2) : "0.00",
      };
    }
  }

  await writeAudit({
    action: "VERIFY",
    module: "EXAMS_RECORDS",
    targetType: "RESULT",
    targetId: referenceNo || registrationNo,
    meta: { ip },
    after: { referenceNo, registrationNo, found: Boolean(verified), channel: "API" },
  });

  if (!verified) {
    return NextResponse.json({ verified: false, referenceNo }, { status: 404 });
  }

  return NextResponse.json({
    verified: true,
    referenceNo: referenceNo ?? null,
    graduate: verified.fullName,
    registrationNo: verified.registrationNo,
    academicSession: verified.academicSession,
    courseCount: verified.count,
    cgpa: verified.cgpa,
  });
}
