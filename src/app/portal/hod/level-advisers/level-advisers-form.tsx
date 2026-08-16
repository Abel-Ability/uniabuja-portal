"use client";

import { useState } from "react";
import { useActionState } from "react";
import { assignLevelAdviser, deactivateLevelAdviser } from "@/lib/module-actions";
import { SectionHeading, PillButton, EmptyState, Table, Badge, StatusBadge } from "@/components/ui";

type Lecturer = { id: string; fullName: string; staffNo: string | null };
type Programme = { id: string; name: string; code: string };
type Assignment = {
  id: string;
  level: number;
  academicSession: string;
  status: string;
  programmeId: string | null;
  programmeName: string | null;
  adviserId: string;
  adviserName: string;
  staffNo: string | null;
  notes: string | null;
};

const scopeKey = (level: number, session: string, programmeId: string | null) =>
  `${level}|${session}|${programmeId ?? ""}`;

export function LevelAdvisersForm({
  department,
  maxLevel,
  sessions,
  lecturers,
  programmes,
  assignments,
}: {
  department: string;
  maxLevel: number;
  sessions: string[];
  lecturers: Lecturer[];
  programmes: Programme[];
  assignments: Assignment[];
}) {
  const [session, setSession] = useState(sessions[sessions.length - 1] ?? "");

  const byKey = new Map(assignments.map((a) => [scopeKey(a.level, a.academicSession, a.programmeId), a]));
  const visible = assignments.filter((a) => a.academicSession === session);
  const levelOptions: number[] = [];
  for (let l = 100; l <= maxLevel; l += 100) levelOptions.push(l);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="New assignment"
          subtitle="Pick the session, level and scope, then the lecturer who acts as level adviser."
        />
        <AssignForm
          sessions={sessions}
          levelOptions={levelOptions}
          lecturers={lecturers}
          programmes={programmes}
          byKey={byKey}
          defaultSession={session}
          onSessionChange={setSession}
        />
      </section>

      <section>
        <SectionHeading
          title="Assignments"
          subtitle={`${session} · ${department || "your department"} · history is kept for every session`}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate">
            Session
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="rounded-xl border border-slate/25 px-4 py-2.5 text-sm"
            >
              {sessions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No assignments" body="Assign a level adviser above to see it listed here." />
        ) : (
          <Table headers={["Level", "Adviser", "Scope", "Status", "Action"]}>
            {visible.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <Badge tone="brand">{a.level} Level</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate">{a.adviserName}</span>
                  {a.staffNo ? <span className="block text-xs text-slate/60">{a.staffNo}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate/75">{a.programmeName ?? "Whole department"}</span>
                  {a.notes ? <span className="block text-xs text-slate/60">{a.notes}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3">
                  {a.status === "ACTIVE" ? <DeactivateButton id={a.id} /> : <span className="text-xs text-slate/50">—</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}

function AssignForm({
  sessions,
  levelOptions,
  lecturers,
  programmes,
  byKey,
  defaultSession,
  onSessionChange,
}: {
  sessions: string[];
  levelOptions: number[];
  lecturers: Lecturer[];
  programmes: Programme[];
  byKey: Map<string, Assignment>;
  defaultSession: string;
  onSessionChange: (s: string) => void;
}) {
  const [state, action, pending] = useActionState(assignLevelAdviser, null);
  const [session, setSession] = useState(defaultSession);
  const [level, setLevel] = useState(levelOptions[0] ?? 100);
  const [programmeId, setProgrammeId] = useState("");
  const [adviserId, setAdviserId] = useState("");

  const current = byKey.get(scopeKey(level, session, programmeId || null));
  const currentlyHeld = current && current.status === "ACTIVE" ? current : null;

  const changeSession = (s: string) => {
    setSession(s);
    onSessionChange(s);
    const holder = byKey.get(scopeKey(level, s, programmeId || null));
    setAdviserId(
      holder && lecturers.some((l) => l.id === holder.adviserId) ? holder.adviserId : "",
    );
  };
  const changeLevel = (l: number) => {
    setLevel(l);
    const holder = byKey.get(scopeKey(l, session, programmeId || null));
    setAdviserId(
      holder && lecturers.some((x) => x.id === holder.adviserId) ? holder.adviserId : "",
    );
  };
  const changeProgramme = (p: string) => {
    setProgrammeId(p);
    const holder = byKey.get(scopeKey(level, session, p || null));
    setAdviserId(
      holder && lecturers.some((x) => x.id === holder.adviserId) ? holder.adviserId : "",
    );
  };

  return (
    <form
      action={action}
      className="max-w-3xl rounded-2xl border border-slate/10 bg-white p-6 shadow-sm dark:border-slate-200/15 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Academic session
          <select
            value={session}
            onChange={(e) => changeSession(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate">
          Level
          <select
            value={level}
            onChange={(e) => changeLevel(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            {levelOptions.map((l) => (
              <option key={l} value={l}>
                {l} Level
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Scope
          <select
            value={programmeId}
            onChange={(e) => changeProgramme(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Whole department</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate">
          Adviser
          <select
            value={adviserId}
            onChange={(e) => setAdviserId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select a lecturer…</option>
            {lecturers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName}
                {l.staffNo ? ` (${l.staffNo})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate">
          Start date (optional)
          <input
            type="date"
            name="startDate"
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <label className="text-sm font-semibold text-slate">
          Notes (optional)
          <input
            name="notes"
            placeholder="e.g. 2026/2027 session lead"
            className="mt-1 w-full rounded-xl border border-slate/25 px-4 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>
      </div>

      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="academicSession" value={session} />
      <input type="hidden" name="programmeId" value={programmeId} />
      <input type="hidden" name="adviserId" value={adviserId} />

      {currentlyHeld ? (
        <p className="mt-3 text-xs font-medium text-brand-dark">
          {currentlyHeld.programmeName ? `${currentlyHeld.programmeName} — ` : ""}
          {session} · {level} level is currently held by {currentlyHeld.adviserName}. Assigning will
          deactivate that record and create a new one.
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <PillButton type="submit" variant="primary" disabled={pending || !adviserId}>
          {pending ? "Assigning…" : "Assign level adviser"}
        </PillButton>
        {!adviserId ? <p className="text-xs text-slate/50">Pick a lecturer to assign.</p> : null}
      </div>
      {state?.ok ? <p role="status" className="mt-3 text-sm font-medium text-brand-dark">Assigned.</p> : null}
      {state?.error ? <p role="alert" className="mt-3 text-sm font-medium text-red-600">{state.error}</p> : null}
    </form>
  );
}

function DeactivateButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deactivateLevelAdviser, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <PillButton type="submit" variant="outline" disabled={pending}>
        {pending ? "Deactivating…" : "Deactivate"}
      </PillButton>
      {state?.error ? <span role="alert" className="text-xs font-medium text-red-600">{state.error}</span> : null}
    </form>
  );
}
