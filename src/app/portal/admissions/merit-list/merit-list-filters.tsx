"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input } from "@/components/ui";

type FilterProps = {
  faculties: string[];
  departments: string[];
  programmes: string[];
  currentParams: Record<string, string | undefined>;
};

export function MeritListFilters({
  faculties,
  departments,
  programmes,
  currentParams,
}: FilterProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentParams.search ?? "");

  function applyFilters(key: string, value: string) {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    router.push(url.pathname + url.search);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilters("search", search);
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by name, JAMB number, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-strong px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Search
          </button>
        </form>

        {/* Filter Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Faculty</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.faculty ?? ""}
              onChange={(e) => applyFilters("faculty", e.target.value)}
            >
              <option value="">All Faculties</option>
              {faculties.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Department</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.department ?? ""}
              onChange={(e) => applyFilters("department", e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Programme</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.programme ?? ""}
              onChange={(e) => applyFilters("programme", e.target.value)}
            >
              <option value="">All Programmes</option>
              {programmes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Eligibility</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.eligibility ?? ""}
              onChange={(e) => applyFilters("eligibility", e.target.value)}
            >
              <option value="">All</option>
              <option value="eligible">Eligible</option>
              <option value="ineligible">Ineligible</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Cut-off</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.cutoff ?? ""}
              onChange={(e) => applyFilters("cutoff", e.target.value)}
            >
              <option value="">All</option>
              <option value="met">Met</option>
              <option value="not_met">Not Met</option>
            </select>
          </div>
        </div>

        {/* Score Range */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Min Score</label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              max="100"
              value={currentParams.minScore ?? ""}
              onChange={(e) => applyFilters("minScore", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Max Score</label>
            <Input
              type="number"
              placeholder="100"
              min="0"
              max="100"
              value={currentParams.maxScore ?? ""}
              onChange={(e) => applyFilters("maxScore", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Status</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.status ?? ""}
              onChange={(e) => applyFilters("status", e.target.value)}
            >
              <option value="">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="SELECTED">Selected</option>
              <option value="CHAIRMAN_REVIEW">Chairman Review</option>
              <option value="ADMITTED">Admitted</option>
              <option value="NOT_ADMITTED">Not Admitted</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate/70">Category</label>
            <select
              className="w-full rounded-xl border border-slate/25 px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={currentParams.category ?? ""}
              onChange={(e) => applyFilters("category", e.target.value)}
            >
              <option value="">All</option>
              <option value="MERIT">Merit</option>
              <option value="STAFF_CHILD">Staff Child</option>
              <option value="VC_LIST">VC List</option>
              <option value="AUTHORITY_LIST">Authority List</option>
              <option value="OTHER_APPROVED_CATEGORY">Other Approved</option>
            </select>
          </div>
        </div>
      </div>
    </Card>
  );
}
