import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { PageHeader, Card, Table, StatusBadge, EmptyState, SectionHeading, Badge } from "@/components/ui";
import { BookVenueForm } from "./book-venue-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Timetabling & Venue" };

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};
const PURPOSE_LABEL: Record<string, string> = {
  LECTURE: "Lecture",
  EXAM: "Exam",
  EVENT: "Event",
};

function equipmentItems(equipment: unknown): string[] {
  if (!equipment || typeof equipment !== "object" || Array.isArray(equipment)) return [];
  return Object.entries(equipment as Record<string, unknown>)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase())
    .map((label) => label.charAt(0).toUpperCase() + label.slice(1));
}

type VenueRow = {
  id: string;
  name: string;
  building: string;
  capacity: number;
  equipment: unknown;
};

function VenueCards({ venues }: { venues: VenueRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {venues.map((v) => (
        <Card key={v.id} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-head font-bold text-slate">{v.name}</h3>
            <Badge tone="brand">{v.capacity} seats</Badge>
          </div>
          <p className="text-sm text-slate/70">{v.building}</p>
          {equipmentItems(v.equipment).length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {equipmentItems(v.equipment).map((e) => (
                <Badge key={e} tone="slate">
                  {e}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate/70">No equipment listed</p>
          )}
        </Card>
      ))}
    </div>
  );
}

type TimetableRow = {
  id: string;
  kind: string;
  day: string;
  startTime: string;
  endTime: string;
  course: { code: string } | null;
  venue: { name: string } | null;
};

function TimetableTable({ entries }: { entries: TimetableRow[] }) {
  const sorted = [...entries].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
      a.startTime.localeCompare(b.startTime),
  );
  return (
    <Table headers={["Course", "Kind", "Day", "Time", "Venue"]}>
      {sorted.map((e) => (
        <tr key={e.id}>
          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate">{e.course?.code ?? "—"}</td>
          <td className="px-4 py-3 text-slate">{e.kind === "EXAM" ? "Exam" : "Lecture"}</td>
          <td className="px-4 py-3 text-slate/70">{DAY_LABEL[e.day] ?? e.day}</td>
          <td className="px-4 py-3 text-slate/70">
            {e.startTime} – {e.endTime}
          </td>
          <td className="px-4 py-3 text-slate/70">{e.venue?.name ?? "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export default async function TimetablingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const readRoles = ["STUDENT", "LECTURER", "HOD_DEAN", "EXAMS_RECORDS", "DVC_OVERSIGHT", "VC"];
  if (session.user.role === "TIMETABLE") {
    const [venues, bookings, entries, courses] = await Promise.all([
      prisma.venue.findMany({ orderBy: { name: "asc" } }),
      prisma.venueBooking.findMany({
        include: { venue: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.timetableEntry.findMany({
        where: { academicSession: "2025/2026", semester: 1, status: "PUBLISHED" },
        include: { course: true, venue: true },
      }),
      prisma.course.findMany({ orderBy: { code: "asc" }, take: 200 }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 16 · Timetabling & Venue"
          title="Timetabling & Venue"
          description="Venue inventory, clash-checked bookings and the published timetable for the current session."
        />
        <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-8">
          <section aria-label="Venue inventory">
            <SectionHeading
              title="Venue inventory"
              subtitle={`${venues.length} venues across campus with their installed equipment.`}
            />
            {venues.length === 0 ? (
              <EmptyState title="No venues on record" />
            ) : (
              <VenueCards venues={venues} />
            )}
          </section>

          <section aria-label="Book a venue">
            <SectionHeading
              title="Book a venue"
              subtitle="Bookings are clash-checked against existing confirmed bookings automatically."
            />
            <Card>
              <BookVenueForm venues={venues} courses={courses} />
            </Card>
          </section>

          <section aria-label="Venue bookings">
            <SectionHeading
              title="Active bookings"
              subtitle={`${bookings.length} recent bookings for lectures, exams and events.`}
            />
            {bookings.length === 0 ? (
              <EmptyState title="No bookings yet" />
            ) : (
              <Table headers={["Venue", "Purpose", "Day", "Time", "Status"]}>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium text-slate">{b.venue.name}</td>
                    <td className="px-4 py-3 text-slate">{PURPOSE_LABEL[b.purpose] ?? b.purpose}</td>
                    <td className="px-4 py-3 text-slate/70">{DAY_LABEL[b.day] ?? b.day}</td>
                    <td className="px-4 py-3 text-slate/70">
                      {b.startTime} – {b.endTime}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section aria-label="Published timetable">
            <SectionHeading
              title="Published timetable"
              subtitle="First semester, 2025/2026 — published entries for lectures and examinations."
            />
            {entries.length === 0 ? (
              <EmptyState title="No published entries" />
            ) : (
              <TimetableTable entries={entries} />
            )}
          </section>
        </div>
      </div>
    );
  }

  if (readRoles.includes(session.user.role)) {
    const [venues, entries] = await Promise.all([
      prisma.venue.findMany({ orderBy: { name: "asc" } }),
      prisma.timetableEntry.findMany({
        where: { academicSession: "2025/2026", semester: 1, status: "PUBLISHED" },
        include: { course: true, venue: true },
      }),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Module 16 · Timetabling & Venue"
          title="Timetable & Venues"
          description="Your published timetable for the current session and the venues available across campus."
        />
        <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-8">
          <section aria-label="Published timetable">
            <SectionHeading
              title="Published timetable"
              subtitle="First semester, 2025/2026 — lectures and examinations."
            />
            {entries.length === 0 ? (
              <EmptyState title="No published entries" />
            ) : (
              <TimetableTable entries={entries} />
            )}
          </section>

          <section aria-label="Venues">
            <SectionHeading
              title="Venues"
              subtitle={`${venues.length} venues with capacity and installed equipment.`}
            />
            {venues.length === 0 ? (
              <EmptyState title="No venues on record" />
            ) : (
              <VenueCards venues={venues} />
            )}
          </section>
        </div>
      </div>
    );
  }

  redirect("/portal/dashboard");
}
