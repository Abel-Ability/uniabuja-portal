import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { metaFromRequest } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { requireGovernanceOversight } from "../../guard";
import {
  fetchUniversityStudents,
  buildFilterOptions,
  applyStudentFilters,
  parseStudentFilters,
  studentRowsToCsv,
} from "@/lib/student-stats";

export const dynamic = "force-dynamic";

// Read-only CSV export of the university-wide student register, filtered
// exactly as the register page is. Access is granted by the committee
// membership boundary (the same guard every DVC page uses); the optional
// department filter is validated against the roster so a hand-edited query
// string cannot widen the scope. Every export is written to the audit trail.
export async function GET(req: NextRequest) {
  let guarded;
  try {
    guarded = await requireGovernanceOversight();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { session } = guarded;

  const rows = await fetchUniversityStudents();
  const departments = [...new Set(rows.map((r) => r.department).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b),
  );

  const params: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    const existing = params[k];
    if (existing == null) params[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else params[k] = [existing, v];
  }

  const requestedDept = typeof params.department === "string" ? params.department : undefined;
  const activeDepartment = requestedDept && departments.includes(requestedDept) ? requestedDept : undefined;
  const scopedRows = activeDepartment ? rows.filter((r) => r.department === activeDepartment) : rows;

  const options = buildFilterOptions(scopedRows);
  const { filters } = parseStudentFilters(params, options);
  const filtered = applyStudentFilters(scopedRows, filters);
  const csv = studentRowsToCsv(filtered);

  await writeAudit({
    action: "EXPORT",
    module: "STUDENTS",
    targetType: "STUDENT",
    targetId: "GOVERNANCE_OVERSIGHT",
    after: { count: filtered.length, filters: { ...filters }, department: activeDepartment ?? null },
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
      "Content-Disposition": 'attachment; filename="university-students.csv"',
      "Cache-Control": "no-store",
    },
  });
}
