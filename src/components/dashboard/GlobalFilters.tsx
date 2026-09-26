"use client";

import React from "react";
import { Search, Filter, RotateCcw, X } from "lucide-react";
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

  return (
    <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-borderline shadow-card mb-6">
      {/* Top Filter Bar: Search + Filter status */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by name, ID, role, department, company, mobile..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Summary Badge */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filtered:</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
              {filteredCount === totalCount ? "All records" : `${filteredCount} of ${totalCount}`}
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Company Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Company
          </label>
          <select
            value={filters.company}
            onChange={(e) => onChange({ ...filters, company: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 transition"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Department
          </label>
          <select
            value={filters.department}
            onChange={(e) => onChange({ ...filters, department: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 transition"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Gender Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Gender
          </label>
          <select
            value={filters.gender}
            onChange={(e) => onChange({ ...filters, gender: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 transition"
          >
            <option value="">All Genders</option>
            {genders.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Employment Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Employment Status
          </label>
          <select
            value={filters.employmentStatus}
            onChange={(e) => onChange({ ...filters, employmentStatus: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 transition font-semibold"
          >
            <option value="Active">Active Only (Default)</option>
            <option value="Left">Left / Relieved</option>
            <option value="">All Statuses</option>
          </select>
        </div>
      </div>
    </div>
  );
}
