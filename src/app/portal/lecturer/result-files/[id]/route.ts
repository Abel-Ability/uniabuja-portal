import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { landingForRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", _req.url));
  if (session.user.role !== "LECTURER") {
    return NextResponse.redirect(new URL(landingForRole(session.user.role), _req.url));
  }

  const { id } = await params;
  const file = await prisma.resultFile.findFirst({
    where: { id, lecturerId: session.user.id },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safeName = file.fileName.replace(/[^\w.\- ]/g, "_");
  return new Response(file.rawCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
