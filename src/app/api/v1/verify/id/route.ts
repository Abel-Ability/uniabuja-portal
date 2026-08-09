import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REGEX_QR = /^UAID-(STU|STF)-[A-Z0-9/-]+-\d{1,4}$/;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const lim = rateLimit(`verify-id:${ip}`, 10, 60_000);
  if (!lim.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { qrRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const qrRef = (body.qrRef ?? "").toString().trim().toUpperCase();
  if (!REGEX_QR.test(qrRef)) {
    return NextResponse.json(
      { error: "qrRef must match ID card reference format (UAID-<kind>-<holder>-<4 digits>)" },
      { status: 400 },
    );
  }

  const card = await prisma.idCard.findUnique({
    where: { qrRef },
    include: { user: true },
  });

  await writeAudit({
    action: "VERIFY",
    module: "ADMIN_SYSTEM",
    targetType: "ID_CARD",
    targetId: card?.id ?? qrRef,
    meta: { ip },
    after: { qrRef, found: Boolean(card), channel: "API" },
  });

  if (!card) {
    return NextResponse.json({ verified: false, qrRef }, { status: 404 });
  }
  if (card.revokedAt) {
    return NextResponse.json(
      { verified: false, qrRef, reason: "REVOKED" },
      { status: 410 },
    );
  }

  return NextResponse.json({
    verified: true,
    qrRef,
    kind: card.kind,
    holder: card.user.fullName,
    issuedAt: card.issuedAt.toISOString(),
  });
}
