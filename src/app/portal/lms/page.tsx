import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  PageHeader,
  Card,
  Table,
  StatCard,
  StatusBadge,
  Badge,
  EmptyState,
  SectionHeading,
} from "@/components/ui";
import { RegisterCourseButton, DropCourseButton } from "./course-forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Learning Management" };

const SEMESTER_LABEL: Record<number, string> = { 1: "Semester 1", 2: "Semester 2" };

function semesterLabel(semester: number): string {
  return SEMESTER_LABEL[semester] ?? `Semester ${semester}`;
}

type CourseRow = {
  id: string;
  code: string;
  title: string;
  units: number;
  level: number;
  semester: number;
  capacity: number;
  enrolled: number;
  waitlist: number;
};

async function courseRows(): Promise<CourseRow[]> {
  const [courses, regs] = await Promise.all([
    prisma.course.findMany({
      orderBy: { code: "asc" },
    }),
    prisma.courseRegistration.findMany({
      select: { courseId: true, status: true },
    }),
  ]);
  const counts = new Map<string, { enrolled: number; waitlist: number }>();
  for (const r of regs) {
    const c = counts.get(r.courseId) ?? { enrolled: 0, waitlist: 0 };
    if (r.status === "ACTIVE") c.enrolled += 1;
    else if (r.status === "WAITLISTED") c.waitlist += 1;
    counts.set(r.courseId, c);
  }
  return courses.map((course) => ({
    ...course,
    enrolled: counts.get(course.id)?.enrolled ?? 0,
    waitlist: counts.get(course.id)?.waitlist ?? 0,
  }));
}

function CoursesTable({
  courses,
  registeredCourseIds,
}: {
  courses: CourseRow[];
  registeredCourseIds: Set<string>;
}) {
  return (
    <Table
      headers={["Code", "Course", "Units", "Semester", "Capacity", "Enrolled", "Waitlist", "Action"]}
    >
      {courses.map((c) => (
        <tr key={c.id}>
          <td className="px-4 py-3 font-mono text-xs text-slate">{c.code}</td>
          <td className="px-4 py-3 text-slate">
            <p className="font-medium">{c.title}</p>
          </td>
          <td className="px-4 py-3 text-slate/70">{c.units}</td>
          <td className="px-4 py-3 text-slate/70">{semesterLabel(c.semester)}</td>
          <td className="px-4 py-3 text-slate/70">{c.capacity}</td>
          <td className="px-4 py-3 text-slate/70">{c.enrolled}</td>
          <td className="px-4 py-3 text-slate/70">{c.waitlist}</td>
          <td className="px-4 py-3">
            {registeredCourseIds.has(c.id) ? (
              <Badge tone="brand">Registered</Badge>
            ) : (
              <RegisterCourseButton courseId={c.id} />
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default async function LmsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { user } = session;

  if (user.role === "STUDENT") {
    const [courses, myRegs] = await Promise.all([
      courseRows(),
      prisma.courseRegistration.findMany({
        where: { userId: user.id },
        orderBy: [{ semester: "asc" }, { course: { code: "asc" } }],
        include: { course: true },
      }),
    ]);
    const registered = new Set(
      myRegs
        .filter((r) => ["ACTIVE", "WAITLISTED"].includes(r.status))
        .map((r) => r.courseId),
    );

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 6 · Student"
          title="Learning Management"
          description="Register for courses, view your active enrolments and drop courses before the deadline."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Active courses"
              value={myRegs.filter((r) => r.status === "ACTIVE").length}
              hint="Current semester enrolment"
            />
            <StatCard
              label="Waitlisted"
              value={myRegs.filter((r) => r.status === "WAITLISTED").length}
              hint="Awaiting a free seat"
            />
            <StatCard
              label="LMS synced"
              value={myRegs.filter((r) => r.lmsSynced).length}
              hint="Enrolments pushed to Moodle"
            />
          </section>

          <section aria-label="Course registration">
            <SectionHeading
              title="Course registration"
              subtitle="Courses offered this session. Fee clearance and prerequisites are checked automatically when you register."
            />
            <CoursesTable courses={courses} registeredCourseIds={registered} />
          </section>

          <Card className="border-brand/20 bg-brand-light/40">
            <h3 className="mb-2 font-head text-lg font-bold text-slate">Before you register</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate/80">
              <li>Your fee account must be cleared — unpaid tuition or acceptance fees block registration.</li>
              <li>Prerequisites are enforced: for example, CSC301 (Database Systems) requires a pass in CSC201.</li>
              <li>When a course is at capacity you are placed on the waitlist automatically.</li>
              <li>Every successful registration and drop is written to the LMS sync log.</li>
            </ul>
          </Card>

          <section aria-label="My registrations">
            <SectionHeading
              title="My registrations"
              subtitle="Courses you are enrolled for in 2025/2026."
            />
            {myRegs.length === 0 ? (
              <EmptyState
                title="No registrations yet"
                body="Register for courses above to see them here."
              />
            ) : (
              <Table headers={["Course", "Semester", "Status", "LMS sync", "Action"]}>
                {myRegs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-slate">
                      <p className="font-medium">{r.course.code} · {r.course.title}</p>
                      <p className="text-xs text-slate/70">{r.academicSession}</p>
                    </td>
                    <td className="px-4 py-3 text-slate/70">{semesterLabel(r.semester)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={r.lmsSynced ? "brand" : "neutral"}>
                        {r.lmsSynced ? "Synced" : "Not synced"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "ACTIVE" ? <DropCourseButton id={r.id} /> : null}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (user.role === "LECTURER") {
    const [courses, roster, syncLogs] = await Promise.all([
      courseRows(),
      prisma.courseRegistration.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ course: { code: "asc" } }, { createdAt: "asc" }],
        include: { course: true, user: true },
      }),
      prisma.lmsSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const rosterByCourse = new Map<string, typeof roster>();
    for (const reg of roster) {
      const list = rosterByCourse.get(reg.courseId) ?? [];
      list.push(reg);
      rosterByCourse.set(reg.courseId, list);
    }

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 6 · Lecturer"
          title="Learning Management"
          description="Your course catalogue, active rosters and LMS synchronisation activity."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Courses">
            <SectionHeading
              title="Courses"
              subtitle="Catalogue with current enrolment and waitlist numbers."
            />
            <CoursesTable courses={courses} registeredCourseIds={new Set()} />
          </section>

          <section aria-label="Rosters">
            <SectionHeading
              title="Course rosters"
              subtitle="Active registrations per course, with LMS sync status."
            />
            {roster.length === 0 ? (
              <EmptyState title="No active registrations" body="Rosters populate once students register for courses." />
            ) : (
              <div className="space-y-6">
                {[...rosterByCourse.entries()].map(([courseId, regs]) => {
                  const course = regs[0].course;
                  return (
                    <Card key={courseId}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-head text-lg font-bold text-slate">
                          {course.code} · {course.title}
                        </h3>
                        <Badge tone="slate">{regs.length} enrolled</Badge>
                      </div>
                      <Table headers={["Student", "Semester", "Status", "LMS sync"]}>
                        {regs.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-medium text-slate">{r.user.fullName}</td>
                            <td className="px-4 py-3 text-slate/70">{semesterLabel(r.semester)}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={r.status} />
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={r.lmsSynced ? "brand" : "neutral"}>
                                {r.lmsSynced ? "Synced" : "Not synced"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="Sync log">
            <SectionHeading
              title="LMS sync log"
              subtitle="Enrolment pushes and grade passbacks reported to the LMS."
            />
            {syncLogs.length === 0 ? (
              <EmptyState title="No sync activity" />
            ) : (
              <Table headers={["Kind", "Reference", "Reference ID", "Status", "Ran at"]}>
                {syncLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate">{l.kind.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate/70">{l.refType.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{l.refId}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {l.ranAt
                        ? l.ranAt.toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (["HOD", "EXAMS_RECORDS", "DVC_OVERSIGHT", "VC"].includes(user.role)) {
    const [courses, syncLogs] = await Promise.all([
      courseRows(),
      prisma.lmsSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 6 · Read-only"
          title="Learning Management"
          description="Read-only overview of the course catalogue and LMS synchronisation activity."
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-8">
          <section aria-label="Courses">
            <SectionHeading title="Courses" subtitle="Catalogue with enrolment and waitlist numbers." />
            <CoursesTable courses={courses} registeredCourseIds={new Set()} />
          </section>

          <section aria-label="Sync log">
            <SectionHeading title="LMS sync log" subtitle="Enrolment and grade passback activity." />
            {syncLogs.length === 0 ? (
              <EmptyState title="No sync activity" />
            ) : (
              <Table headers={["Kind", "Reference", "Reference ID", "Status", "Ran at"]}>
                {syncLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate">{l.kind.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate/70">{l.refType.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate/70">{l.refId}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-slate/70">
                      {l.ranAt
                        ? l.ranAt.toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
