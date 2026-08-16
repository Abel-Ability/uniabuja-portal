import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { metaFromRequest } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { requireVC } from "../../guard";
import { buildGovernanceReport, governanceCsv } from "@/lib/governance";

export const dynamic = "force-dynamic";

// CSV export for a governance report from the VC's Executive Management area.
// The report slug is validated against the catalogued reports (unknown slugs
// 404), access is restricted to the VC role, and every export is written to
// the audit trail.
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireVC();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const slug = req.nextUrl.searchParams.get("report");
  const report = slug ? await buildGovernanceReport(slug) : null;
  if (!report) {
    return NextResponse.json({ error: "UNKNOWN_REPORT" }, { status: 404 });
  }

  const csv = governanceCsv(report.columns, report.rows);

  await writeAudit({
    action: "EXPORT",
    module: "GOVERNANCE",
    targetType: "REPORT",
    targetId: report.slug,
    after: { title: report.title, rows: report.rows.length },
    meta: await metaFromRequest(req),
    actorUserId: session.user.id,
    actorUsername: session.user.username,
    actorRole: session.user.role,
    sessionId: session.id,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
