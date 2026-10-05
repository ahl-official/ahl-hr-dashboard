"use client";

import React from "react";
import { Search, RotateCcw, X } from "lucide-react";
import { GlobalFiltersState } from "@/types";

interface GlobalFiltersProps {
  filters: GlobalFiltersState;
  onChange: (newFilters: GlobalFiltersState) => void;
  onClear: () => void;
  companies: string[];
  departments: string[];
  genders: string[];
  filteredCount: number;
  totalCount: number;
}

export function GlobalFilters({
  filters,
  onChange,
  onClear,
  companies,
  departments,
  genders,
  filteredCount,
  totalCount,
}: GlobalFiltersProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.company) ||
    Boolean(filters.department) ||
    Boolean(filters.gender) ||
    filters.employmentStatus !== "Active";

  const selectCls =
    "h-9 px-2.5 bg-surface border border-borderline rounded-md text-sm text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-w-0";

  return (
    <div className="bg-surface rounded-card p-3 border border-borderline flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search name, ID, role, department, mobile"
          aria-label="Search employees"
          className="w-full h-9 pl-9 pr-8 bg-slate-50 border border-borderline rounded-md text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
        <select aria-label="Company" value={filters.company} onChange={(e) => onChange({ ...filters, company: e.target.value })} className={selectCls}>
          <option value="">All companies</option>
          {companies.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select aria-label="Department" value={filters.department} onChange={(e) => onChange({ ...filters, department: e.target.value })} className={selectCls}>
          <option value="">All departments</option>
          {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
        <select aria-label="Gender" value={filters.gender} onChange={(e) => onChange({ ...filters, gender: e.target.value })} className={selectCls}>
          <option value="">All genders</option>
          {genders.map((g) => (<option key={g} value={g}>{g}</option>))}
        </select>
        <select aria-label="Employment status" value={filters.employmentStatus} onChange={(e) => onChange({ ...filters, employmentStatus: e.target.value })} className={selectCls}>
          <option value="Active">Active</option>
          <option value="Left">Left / Relieved</option>
          <option value="">All statuses</option>
        </select>
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 text-xs text-muted">
        <span className="font-mono tabular-nums">
          {filteredCount === totalCount ? `${totalCount} records` : `${filteredCount} / ${totalCount}`}
        </span>
        {hasActiveFilters && (
          <button onClick={onClear} className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
