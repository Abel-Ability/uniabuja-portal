"use client";

import { useActionState } from "react";
import { bookVenue } from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const INPUT_CLASS =
  "w-full rounded-xl border border-slate/25 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30";

export function BookVenueForm({
  venues,
  courses,
}: {
  venues: { id: string; name: string; building: string }[];
  courses: { id: string; code: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(bookVenue, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.ok ? (
        <p role="status" className="text-sm font-medium text-brand-dark">
          Booking confirmed — it now appears in the bookings list.
        </p>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="venueId" className="mb-1 block text-sm font-semibold text-slate">
            Venue
          </label>
          <select id="venueId" name="venueId" required className={INPUT_CLASS}>
            <option value="">Select venue…</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.building}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="purpose" className="mb-1 block text-sm font-semibold text-slate">
            Purpose
          </label>
          <select id="purpose" name="purpose" required className={INPUT_CLASS}>
            <option value="">Select purpose…</option>
            <option value="LECTURE">Lecture</option>
            <option value="EXAM">Exam</option>
            <option value="EVENT">Event</option>
          </select>
        </div>
        <div>
          <label htmlFor="day" className="mb-1 block text-sm font-semibold text-slate">
            Day
          </label>
          <select id="day" name="day" required className={INPUT_CLASS}>
            <option value="">Select day…</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="courseId" className="mb-1 block text-sm font-semibold text-slate">
            Course (optional)
          </label>
          <select id="courseId" name="courseId" className={INPUT_CLASS}>
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="startTime" className="mb-1 block text-sm font-semibold text-slate">
            Start time
          </label>
          <input id="startTime" name="startTime" type="time" required className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="endTime" className="mb-1 block text-sm font-semibold text-slate">
            End time
          </label>
          <input id="endTime" name="endTime" type="time" required className={INPUT_CLASS} />
        </div>
      </div>
      <PillButton type="submit" disabled={pending}>
        {pending ? "Booking…" : "Book venue"}
      </PillButton>
    </form>
  );
}
