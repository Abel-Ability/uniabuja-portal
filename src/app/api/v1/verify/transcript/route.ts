import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REGEX_REF = /^TXN-\d{4}-\d{6}$/;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lim = rateLimit(`verify:${ip}`, 10, 60_000);
  if (!lim.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { referenceNo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const referenceNo = (body.referenceNo ?? "").toString().trim().toUpperCase();
  if (!REGEX_REF.test(referenceNo)) {
    return NextResponse.json(
      { error: "referenceNo must match transcript reference format" },
      { status: 400 },
    );
  }

  const tr = await prisma.transcriptRequest.findUnique({
    where: { referenceNo },
    include: { user: { include: { programme: true } } },
  });

  await writeAudit({
    action: "VERIFY",
    module: "TRANSCRIPT",
    targetType: "TRANSCRIPT_REQUEST",
    targetId: tr?.id ?? referenceNo,
    meta: { ip },
    after: { referenceNo, found: Boolean(tr), channel: "API" },
  });

  if (!tr || tr.status === "SUBMITTED") {
    return NextResponse.json({ verified: false, referenceNo }, { status: 404 });
  }

  return NextResponse.json({
    verified: true,
    referenceNo,
    status: tr.status,
    issuedAt: tr.issuedAt?.toISOString() ?? null,
    graduate: tr.user.fullName,
    programme: tr.user.programme?.name ?? null,
  });
}
