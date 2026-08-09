"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function markAllRead(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
}
