"use server";

import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { metaFromHeaders } from "@/lib/session";
import { headers } from "next/headers";

export type VerifyResult = {
  error?: string;
  verified?: boolean;
  status?: string;
  issuedAt?: string | null;
  graduate?: string;
  programme?: string | null;
  session?: string | null;
};

export async function verifyReference(
  _prev: VerifyResult | null,
  formData: FormData,
): Promise<VerifyResult> {
  const referenceNo = String(formData.get("referenceNo") ?? "")
    .trim()
    .toUpperCase();

  if (!referenceNo) return { error: "Enter a reference number." };

  const tr = await prisma.transcriptRequest.findUnique({
    where: { referenceNo },
    include: { user: { include: { programme: true } } },
  });

  await writeAudit({
    action: "VERIFY",
    module: "TRANSCRIPT",
    targetType: "TRANSCRIPT_REQUEST",
    targetId: tr?.id ?? referenceNo,
    meta: metaFromHeaders(await headers()),
    after: { referenceNo, found: Boolean(tr) },
  });

  if (!tr || tr.status === "SUBMITTED") {
    return { error: "No issued record matches that reference number." };
  }

  return {
    verified: true,
    status: tr.status,
    issuedAt: tr.issuedAt ? tr.issuedAt.toISOString() : null,
    graduate: tr.user.fullName,
    programme: tr.user.programme?.name ?? null,
    session: tr.user.registrationNo ?? null,
  };
}
