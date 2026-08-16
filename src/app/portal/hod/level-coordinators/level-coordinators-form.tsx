"use client";

import { useState } from "react";
import { useActionState } from "react";
import { assignLevelCoordinator, unassignLevelCoordinator } from "@/lib/module-actions";
import { SectionHeading, PillButton, EmptyState, Table, Badge } from "@/components/ui";

type Lecturer = { id: string; fullName: string; staffNo: string | null };
type Coordinator = {
  id: string;
  level: number;
  academicSession: string;
  coordinatorId: string;
  coordinatorName: string;
  staffNo: string | null;
};

const coordinatorKey = (level: number, session: string) => `${level}|${session}`;

export function LevelCoordinatorsForm({
  department,
  maxLevel,
  sessions,
  lecturers,
  coordinators,
}: {
  department: string;
  maxLevel: number;
  sessions: string[];
  lecturers: Lecturer[];
  coordinators: Coordinator[];
}) {
  const [session, setSession] = useState(sessions[sessions.length - 1] ?? "");

  const byKey = new Map(coordinators.map((c) => [coordinatorKey(c.level, c.academicSession), c]));
  const visible = coordinators.filter((c) => c.academicSession === session);
  const levelOptions: number[] = [];
  for (let l = 100; l <= maxLevel; l += 100) levelOptions.push(l);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="New assignment"
          subtitle="Pick the session and the level, then the lecturer who should coordinate it."
        />
        <AssignForm
          sessions={sessions}
          levelOptions={levelOptions}
          lecturers={lecturers}
          byKey={byKey}
          defaultSession={session}
          onSessionChange={setSession}
        />
      </section>

      <section>
        <SectionHeading title="Current coordinators" subtitle={`${session} · ${department || "your department"}`} />
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
          <EmptyState title="No coordinators" body="Assign a level above to see it listed here." />
        ) : (
          <Table headers={["Level", "Coordinator", "Session", "Action"]}>
            {visible.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <Badge tone="brand">{c.level} Level</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate">{c.coordinatorName}</span>
                  {c.staffNo ? <span className="block text-xs text-slate/60">{c.staffNo}</span> : null}
                </td>
                <td className="px-4 py-3">{c.academicSession}</td>
                <td className="px-4 py-3">
                  <UnassignButton id={c.id} />
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
  byKey,
  defaultSession,
  onSessionChange,
}: {
  sessions: string[];
  levelOptions: number[];
  lecturers: Lecturer[];
  byKey: Map<string, Coordinator>;
  defaultSession: string;
  onSessionChange: (s: string) => void;
}) {
  const [state, action, pending] = useActionState(assignLevelCoordinator, null);
  const [session, setSession] = useState(defaultSession);
  const [level, setLevel] = useState(100);
  const [coordinatorId, setCoordinatorId] = useState("");

  const current = byKey.get(coordinatorKey(level, session));

  const changeSession = (s: string) => {
    setSession(s);
    onSessionChange(s);
    const holder = byKey.get(coordinatorKey(level, s));
    setCoordinatorId(
      holder && lecturers.some((l) => l.id === holder.coordinatorId) ? holder.coordinatorId : "",
    );
  };
  const changeLevel = (l: number) => {
    setLevel(l);
    const holder = byKey.get(coordinatorKey(l, session));
    setCoordinatorId(
      holder && lecturers.some((x) => x.id === holder.coordinatorId) ? holder.coordinatorId : "",
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

      <div className="mt-4">
        <label className="text-sm font-semibold text-slate">
          Coordinator
          <select
            value={coordinatorId}
            onChange={(e) => setCoordinatorId(e.target.value)}
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
        {current ? (
          <p className="mt-1 text-xs font-medium text-brand-dark">
            Currently coordinated by {current.coordinatorName} for {session}.
          </p>
        ) : null}
      </div>

      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="academicSession" value={session} />
      <input type="hidden" name="coordinatorId" value={coordinatorId} />

      <div className="mt-5 flex items-center gap-3">
        <PillButton type="submit" variant="primary" disabled={pending || !coordinatorId}>
          {pending ? "Assigning…" : "Assign coordinator"}
        </PillButton>
        {!coordinatorId ? (
          <p className="text-xs text-slate/50">Pick a lecturer to assign.</p>
        ) : null}
      </div>
      {state?.ok ? <p role="status" className="mt-3 text-sm font-medium text-brand-dark">Assigned.</p> : null}
      {state?.error ? <p role="alert" className="mt-3 text-sm font-medium text-red-600">{state.error}</p> : null}
    </form>
  );
}

function UnassignButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unassignLevelCoordinator, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <PillButton type="submit" variant="outline" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </PillButton>
      {state?.error ? <span role="alert" className="text-xs font-medium text-red-600">{state.error}</span> : null}
    </form>
  );
}
