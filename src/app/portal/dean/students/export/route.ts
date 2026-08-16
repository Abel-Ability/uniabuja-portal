import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentSession, metaFromRequest } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { facultyDepartments } from "@/lib/faculty";
import {
  fetchFacultyStudents,
  buildFilterOptions,
  applyStudentFilters,
  parseStudentFilters,
  studentRowsToCsv,
} from "@/lib/student-stats";

export const dynamic = "force-dynamic";

// The export is a read-only CSV of the faculty roster filtered exactly as the
// register is. The faculty comes from the authenticated session, never from the
// request; the optional department filter is validated against the faculty's
// departments, so a hand-edited query string cannot widen the scope.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (session.user.role !== "DEAN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const faculty = session.user.faculty;
  if (!faculty) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const departments = await facultyDepartments(faculty);
  const rows = await fetchFacultyStudents(departments);

  // searchParams is a plain iterator in route handlers; normalise it before
  // the shared filter parser sees it.
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
    targetId: faculty,
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
      "Content-Disposition": 'attachment; filename="faculty-students.csv"',
      "Cache-Control": "no-store",
    },
  });
}
