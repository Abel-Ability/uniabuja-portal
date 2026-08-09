"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, metaFromHeaders } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/constants";
import type { ModuleActionResult } from "@/lib/module-actions";

const LOAN_DAYS = 14;

export async function borrowHolding(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "LIBRARY", "W")) {
    return { error: "Your role cannot borrow library holdings." };
  }

  const holdingId = String(formData.get("holdingId") ?? "");
  if (!holdingId) return { error: "Missing holding." };

  const holding = await prisma.libraryHolding.findUnique({
    where: { id: holdingId },
  });
  if (!holding) return { error: "Holding not found." };
  if (holding.resourceType === "E_RESOURCE") {
    return { error: "E-resources are streamed, not borrowed." };
  }
  if (holding.availableCopies <= 0) return { error: "No copies available." };

  const now = new Date();
  const dueAt = new Date(now.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);

  const [loan] = await prisma.$transaction([
    prisma.libraryLoan.create({
      data: {
        userId: session.userId,
        holdingId: holding.id,
        borrowedAt: now,
        dueAt,
        status: "OUT",
      },
    }),
    prisma.libraryHolding.update({
      where: { id: holding.id },
      data: { availableCopies: { decrement: 1 } },
    }),
  ]);

  await writeAudit({
    action: "CREATE",
    module: "LIBRARY",
    targetType: "LIBRARY_LOAN",
    targetId: loan.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    after: { holdingId: holding.id, title: holding.title, dueAt: dueAt.toISOString() },
  });

  return { ok: true };
}

export async function returnHolding(
  _prev: ModuleActionResult | null,
  formData: FormData,
): Promise<ModuleActionResult> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!can(session.user.role, "LIBRARY", "W")) {
    return { error: "Your role cannot return library holdings." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing loan." };

  const loan = await prisma.libraryLoan.findUnique({
    where: { id },
    include: { holding: true },
  });
  if (!loan) return { error: "Loan not found." };
  if (loan.userId !== session.userId) {
    return { error: "This loan belongs to another user." };
  }
  if (loan.status === "RETURNED") return { error: "This item has already been returned." };

  await prisma.$transaction([
    prisma.libraryLoan.update({
      where: { id: loan.id },
      data: { returnedAt: new Date(), status: "RETURNED" },
    }),
    prisma.libraryHolding.update({
      where: { id: loan.holdingId },
      data: { availableCopies: { increment: 1 } },
    }),
  ]);

  await writeAudit({
    action: "UPDATE",
    module: "LIBRARY",
    targetType: "LIBRARY_LOAN",
    targetId: loan.id,
    meta: metaFromHeaders(await headers()),
    actorUserId: session.userId,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
    before: { status: loan.status },
    after: { status: "RETURNED", holdingId: loan.holdingId, title: loan.holding.title },
  });

  return { ok: true };
}
