"use client";

import { useRouter } from "next/navigation";
import type { ActiveStudentFilters } from "@/lib/student-stats";

export interface StudentFilterOption {
  value: string;
  label: string;
}

export interface StudentFilterOptions {
  sessions: string[];
  levels: number[];
  programmes: string[];
  categories: StudentFilterOption[];
  sexes: StudentFilterOption[];
  statuses: StudentFilterOption[];
  ageBrackets: string[];
}

export type { ActiveStudentFilters };

export function StudentFilters({
  options,
  active,
  basePath,
  department,
  departments,
  showDepartment = false,
}: {
  options: StudentFilterOptions;
  active: ActiveStudentFilters;
  basePath: string;
  department?: string;
  departments?: string[];
  showDepartment?: boolean;
}) {
  const router = useRouter();

  function apply(patch: Record<string, string | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string> = { ...active };
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") delete merged[k];
      else merged[k] = v;
    }
    delete merged.page; // a filter change always resets to page 1
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const select = (
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    options: StudentFilterOption[],
  ) => (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate/70">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate/25 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate dark:bg-slate-900"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const selectRaw = (
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    options: string[],
  ) => (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate/70">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate/25 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate dark:bg-slate-900"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      className="rounded-2xl border border-slate/10 bg-white p-4 shadow-sm dark:border-slate-200/15 dark:bg-slate-900"
      onSubmit={(e) => {
        e.preventDefault();
        const input = new FormData(e.currentTarget).get("q")?.toString() ?? "";
        apply({ q: input.trim() || null });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {showDepartment
          ? selectRaw(
              "Department",
              department,
              (v) => apply({ department: v || null }),
              departments ?? [],
            )
          : null}
        {selectRaw("Session", active.session, (v) => apply({ session: v || null }), options.sessions)}
        {selectRaw(
          "Level",
          active.level,
          (v) => apply({ level: v || null }),
          options.levels.map((l) => String(l)),
        )}
        {selectRaw("Programme", active.programme, (v) => apply({ programme: v || null }), options.programmes)}
        {select("Category", active.category, (v) => apply({ category: v || null }), options.categories)}
        {select("Sex", active.sex, (v) => apply({ sex: v || null }), options.sexes)}
        {select("Status", active.status, (v) => apply({ status: v || null }), options.statuses)}
        {selectRaw("Age", active.age, (v) => apply({ age: v || null }), options.ageBrackets)}
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate/70">
          Search
          <input
            name="q"
            key={active.q ?? ""}
            defaultValue={active.q ?? ""}
            placeholder="Reg No / name / programme"
            className="rounded-lg border border-slate/25 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate dark:bg-slate-900"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-full bg-brand-strong px-4 py-1.5 font-head text-xs font-semibold text-white hover:bg-brand-dark"
        >
          Search
        </button>
        <a
          href={basePath}
          className="rounded-full border border-slate/25 px-4 py-1.5 font-head text-xs font-semibold text-slate hover:border-brand/40 hover:text-brand-strong"
        >
          Clear filters
        </a>
      </div>
    </form>
  );
}
