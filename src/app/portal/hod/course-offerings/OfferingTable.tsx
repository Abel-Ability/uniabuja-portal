"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { setCourseOfferingStatus } from "@/lib/module-actions";
import { Table, StatusBadge, PillButton, Select, Input, EmptyState } from "@/components/ui";
import { SEMESTER_LABELS } from "@/lib/constants";

export type OfferingRow = {
  id: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  programmeId: string | null;
  programmeName: string | null;
  level: number;
  academicSession: string;
  semester: number;
  status: string;
  createdAt: string;
};

type ProgrammeOption = { id: string; name: string };

export function OfferingTable({
  offerings,
  sessions,
  programmes,
  levels,
}: {
  offerings: OfferingRow[];
  sessions: string[];
  programmes: ProgrammeOption[];
  levels: number[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [session, setSession] = useState("");
  const [programme, setProgramme] = useState("");
  const [level, setLevel] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offerings.filter((o) => {
      if (status && o.status !== status) return false;
      if (session && o.academicSession !== session) return false;
      if (programme && o.programmeId !== programme) return false;
      if (level && o.level !== Number(level)) return false;
      if (q && !`${o.courseCode} ${o.courseTitle}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [offerings, search, status, session, programme, level]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          aria-label="Search offerings"
          placeholder="Search course code or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Filter by status"
          placeholder="All statuses"
          value={status}
          onValueChange={setStatus}
          options={[
            { label: "ACTIVE", value: "ACTIVE" },
            { label: "INACTIVE", value: "INACTIVE" },
          ]}
        />
        <Select
          aria-label="Filter by session"
          placeholder="All sessions"
          value={session}
          onValueChange={setSession}
          options={sessions.map((s) => ({ label: s, value: s }))}
        />
        <Select
          aria-label="Filter by programme"
          placeholder="All programmes"
          value={programme}
          onValueChange={setProgramme}
          options={programmes.map((p) => ({ label: p.name, value: p.id }))}
        />
        <Select
          aria-label="Filter by level"
          placeholder="All levels"
          value={level}
          onValueChange={setLevel}
          options={levels.map((l) => ({ label: `${l} Level`, value: String(l) }))}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching offerings"
          body="Try adjusting the filters, or create a new offering above."
        />
      ) : (
        <Table headers={["Course", "Programme", "Level", "Session", "Semester", "Status", "Created", "Actions"]}>
          {filtered.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3">
                <span className="font-medium text-slate">{o.courseCode}</span>
                <span className="block text-xs text-slate/60">{o.courseTitle}</span>
                <span className="block text-xs text-slate/50">{o.units} units</span>
              </td>
              <td className="px-4 py-3">{o.programmeName ?? "All programmes"}</td>
              <td className="px-4 py-3">{o.level}</td>
              <td className="px-4 py-3">{o.academicSession}</td>
              <td className="px-4 py-3">{SEMESTER_LABELS[o.semester] ?? o.semester}</td>
              <td className="px-4 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-4 py-3 text-sm text-slate/70">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/portal/hod/course-offerings/${o.id}/detail`}
                    className="inline-flex items-center rounded-full border-2 border-brand-strong px-4 py-1.5 font-head text-xs font-semibold text-brand-strong transition-all hover:bg-brand-strong hover:text-white"
                  >
                    View
                  </Link>
                  <OfferingStatusButton id={o.id} currentStatus={o.status} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

export function OfferingStatusButton({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState(setCourseOfferingStatus, null);
  const target = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <form
      action={action}
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        if (
          target === "INACTIVE" &&
          !window.confirm(
            "Deactivate this offering? It will no longer be eligible for student registration, but its history is kept.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={target} />
      <PillButton
        type="submit"
        variant="outline"
        className="px-4 py-1.5 text-xs"
        disabled={pending}
      >
        {pending ? "…" : currentStatus === "ACTIVE" ? "Deactivate" : "Activate"}
      </PillButton>
      {state?.error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
