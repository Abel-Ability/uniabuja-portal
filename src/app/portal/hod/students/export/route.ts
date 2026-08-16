import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentSession, metaFromRequest } from "@/lib/session";
import { departmentMaxLevel } from "@/lib/constants";
import { isHodRole } from "@/lib/hod";
import { writeAudit } from "@/lib/audit";
import {
  fetchDepartmentStudents,
  buildFilterOptions,
  applyStudentFilters,
  parseStudentFilters,
  studentRowsToCsv,
} from "@/lib/student-stats";

export const dynamic = "force-dynamic";

// The export is a read-only CSV of the department roster filtered exactly as
// the register is. The department comes from the authenticated session, never
// from the request, so a hand-edited query string cannot widen the scope.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isHodRole(session.user.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const dept = session.user.department;
  if (!dept) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const maxLevel = departmentMaxLevel(dept);
  const rows = await fetchDepartmentStudents(dept, maxLevel);
  const options = buildFilterOptions(rows);

  // searchParams is a plain iterator in route handlers; normalise it before
  // the shared filter parser sees it.
  const params: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    const existing = params[k];
    if (existing == null) params[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else params[k] = [existing, v];
  }

  const { filters } = parseStudentFilters(params, options);
  const filtered = applyStudentFilters(rows, filters);
  const csv = studentRowsToCsv(filtered);

  await writeAudit({
    action: "EXPORT",
    module: "STUDENTS",
    targetType: "STUDENT",
    targetId: dept,
    after: { count: filtered.length, filters: { ...filters } },
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
      "Content-Disposition": 'attachment; filename="department-students.csv"',
      "Cache-Control": "no-store",
    },
  });
}
