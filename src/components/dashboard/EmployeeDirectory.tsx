"use client";

import React, { useState, useMemo } from "react";
import { Users, ChevronLeft, ChevronRight, ArrowRight, Mail, Phone } from "lucide-react";
import { EmployeeSummary } from "@/types";
import { initials, formatTenure, formatDisplayDate } from "@/lib/date-utils";

interface EmployeeDirectoryProps {
  employees: EmployeeSummary[];
  onSelectEmployee: (employee: EmployeeSummary) => void;
}

export function EmployeeDirectory({ employees, onSelectEmployee }: EmployeeDirectoryProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Default sort: employee name ascending
  const sortedEmployees = useMemo(() => {
    return employees.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees]);

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const currentBatch = sortedEmployees.slice(start, start + pageSize);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const directoryEl = document.getElementById("directory");
    if (directoryEl) {
      directoryEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section id="directory" className="mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Personnel Directory
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-DEFAULT tracking-tight">
            Employee Directory
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Searchable workforce roster with complete master sheet profiles.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 self-start sm:self-center">
          <Users className="w-4 h-4 text-indigo-600" />
          <span>
            {sortedEmployees.length} {sortedEmployees.length === 1 ? "Employee" : "Employees"}
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-borderline shadow-card overflow-hidden">
        {/* Desktop View: Responsive Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-borderline text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10">
              <tr>
                <th className="py-3.5 px-4 pl-6">Employee</th>
                <th className="py-3.5 px-4">Employee ID</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Designation</th>
                <th className="py-3.5 px-4">Tenure / DOJ</th>
                <th className="py-3.5 px-4 pr-6 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderline">
              {currentBatch.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                currentBatch.map((emp) => (
                  <tr
                    key={emp.employeeKey}
                    className="hover:bg-slate-50/80 transition duration-150 group"
                  >
                    {/* Employee avatar + name + email */}
                    <td className="py-3.5 px-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {initials(emp.fullName)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-navy-DEFAULT block truncate">
                            {emp.fullName}
                          </span>
                          <span className="text-xs text-muted block truncate">
                            {emp.companyEmail || emp.personalEmail || "No email"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {emp.employeeId || "—"}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">{emp.company}</td>

                    {/* Department */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">{emp.department}</td>

                    {/* Designation */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{emp.designation}</td>

                    {/* Tenure */}
                    <td className="py-3.5 px-4">
                      <strong className="font-semibold text-navy-DEFAULT block">
                        {formatTenure(emp.doj)}
                      </strong>
                      <span className="text-xs text-muted block">
                        {formatDisplayDate(emp.doj)}
                      </span>
                    </td>

                    {/* Profile Button */}
                    <td className="py-3.5 px-4 pr-6 text-right">
                      <button
                        onClick={() => onSelectEmployee(emp)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition shadow-sm group-hover:scale-105"
                        aria-label={`View profile for ${emp.fullName}`}
                        title="View complete profile"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Stacked Employee Cards */}
        <div className="md:hidden divide-y divide-borderline">
          {currentBatch.length === 0 ? (
            <div className="py-12 text-center text-muted">
              No employees match the current filters.
            </div>
          ) : (
            currentBatch.map((emp) => (
              <div key={emp.employeeKey} className="p-4 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {initials(emp.fullName)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-navy-DEFAULT">{emp.fullName}</h4>
                      <p className="text-xs text-muted">{emp.designation}</p>
                    </div>
                  </div>

                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {emp.employeeId || "—"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted mb-3 bg-slate-50 p-2.5 rounded-xl">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Department</span>
                    <span className="font-medium text-slate-700">{emp.department}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Company</span>
                    <span className="font-medium text-slate-700">{emp.company}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Tenure</span>
                    <span className="font-semibold text-navy-DEFAULT">{formatTenure(emp.doj)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Joined</span>
                    <span className="font-medium text-slate-700">{formatDisplayDate(emp.doj)}</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectEmployee(emp)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition"
                >
                  <span>View Complete Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-4 sm:px-6 bg-slate-50/70 border-t border-borderline flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div>
            Showing{" "}
            <strong className="text-slate-700">
              {sortedEmployees.length ? start + 1 : 0}–
              {Math.min(start + pageSize, sortedEmployees.length)}
            </strong>{" "}
            of <strong className="text-slate-700">{sortedEmployees.length}</strong> records
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-borderline bg-surface hover:bg-slate-100 disabled:opacity-40 transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-borderline bg-surface hover:bg-slate-100 disabled:opacity-40 transition"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
