"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Mail,
  Phone,
  AlertTriangle,
  MessageCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { EmployeeSummary, MeetingRecord } from "@/types";
import { initials, formatTenure, formatDisplayDate, getTodayLocalIsoDate } from "@/lib/date-utils";
import { getCheckInWhatsAppUrl } from "@/lib/whatsapp";

interface EmployeeDirectoryProps {
  employees: EmployeeSummary[];
  meetings?: MeetingRecord[];
  onSelectEmployee: (employee: EmployeeSummary) => void;
}

export function EmployeeDirectory({
  employees,
  meetings = [],
  onSelectEmployee,
}: EmployeeDirectoryProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "red_flags" | "action_pending">("all");
  const pageSize = 12;

  const todayStr = getTodayLocalIsoDate();

  // Map employeeKey -> red flag meetings
  const redFlagsMap = useMemo(() => {
    const map = new Map<string, MeetingRecord[]>();
    meetings
      .filter((m) => m.warningGiven === "Yes" || m.meetingType === "Warning")
      .forEach((m) => {
        const list = map.get(m.employeeKey) || [];
        list.push(m);
        map.set(m.employeeKey, list);
      });
    return map;
  }, [meetings]);

  // Map employeeKey -> open action items
  const actionItemsMap = useMemo(() => {
    const map = new Map<string, MeetingRecord[]>();
    meetings
      .filter((m) => m.nextFollowUpDate && m.recordStatus === "Open")
      .forEach((m) => {
        const list = map.get(m.employeeKey) || [];
        list.push(m);
        map.set(m.employeeKey, list);
      });
    return map;
  }, [meetings]);

  // Filter employees according to quick filter
  const filteredEmployees = useMemo(() => {
    if (directoryFilter === "red_flags") {
      return employees.filter((e) => redFlagsMap.has(e.employeeKey));
    }
    if (directoryFilter === "action_pending") {
      return employees.filter((e) => actionItemsMap.has(e.employeeKey));
    }
    return employees;
  }, [employees, directoryFilter, redFlagsMap, actionItemsMap]);

  // Default sort: employee name ascending
  const sortedEmployees = useMemo(() => {
    return filteredEmployees.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [filteredEmployees]);

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

  const handleWhatsAppChat = (e: React.MouseEvent, emp: EmployeeSummary) => {
    e.stopPropagation();
    const url = getCheckInWhatsAppUrl(emp.mobile, emp.fullName);
    window.open(url, "_blank");
  };

  const redFlagTotalCount = Array.from(redFlagsMap.keys()).length;
  const actionPendingTotalCount = Array.from(actionItemsMap.keys()).length;

  return (
    <section id="directory" className="mb-12 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Personnel Directory
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-DEFAULT tracking-tight">
            Employee Directory
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Searchable workforce roster with conduct red flags and master sheet profiles.
          </p>
        </div>

        {/* Directory Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setDirectoryFilter("all");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              directoryFilter === "all"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All ({employees.length})</span>
          </button>

          <button
            onClick={() => {
              setDirectoryFilter("red_flags");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              directoryFilter === "red_flags"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-inherit" />
            <span>🚩 Red Flags ({redFlagTotalCount})</span>
          </button>

          <button
            onClick={() => {
              setDirectoryFilter("action_pending");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              directoryFilter === "action_pending"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-inherit" />
            <span>Pending Actions ({actionPendingTotalCount})</span>
          </button>
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
                <th className="py-3.5 px-4">Tenure / Alerts</th>
                <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
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
                currentBatch.map((emp) => {
                  const empRedFlags = redFlagsMap.get(emp.employeeKey) || [];
                  const empActions = actionItemsMap.get(emp.employeeKey) || [];
                  const activeWarning = empRedFlags.find((m) => m.recordStatus === "Open") || empRedFlags[0];
                  const hasOverdueAction = empActions.some(
                    (m) => m.nextFollowUpDate && m.nextFollowUpDate < todayStr
                  );

                  return (
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
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-navy-DEFAULT block truncate">
                                {emp.fullName}
                              </span>
                              {activeWarning && (
                                <span
                                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shrink-0"
                                  title={`Red Flag: ${activeWarning.discussionNotes}`}
                                >
                                  🚩 Red Flag
                                </span>
                              )}
                              {hasOverdueAction && (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5 shrink-0"
                                  title="Overdue Action Follow-up"
                                >
                                  ⏰ Action Due
                                </span>
                              )}
                            </div>
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

                      {/* Tenure / Alert details */}
                      <td className="py-3.5 px-4">
                        <strong className="font-semibold text-navy-DEFAULT block">
                          {formatTenure(emp.doj)}
                        </strong>
                        {activeWarning ? (
                          <span className="text-[11px] font-semibold text-rose-700 block truncate max-w-[180px]">
                            {activeWarning.discussionNotes || "Conduct Warning Recorded"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted block">
                            {formatDisplayDate(emp.doj)}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons: WhatsApp & Profile */}
                      <td className="py-3.5 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click WhatsApp Direct Chat */}
                          <button
                            onClick={(e) => handleWhatsAppChat(e, emp)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition shadow-sm"
                            title={`Chat with ${emp.fullName} on WhatsApp (${emp.mobile || "no mobile"})`}
                            aria-label={`WhatsApp ${emp.fullName}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* Profile Button */}
                          <button
                            onClick={() => onSelectEmployee(emp)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition shadow-sm group-hover:scale-105"
                            aria-label={`View profile for ${emp.fullName}`}
                            title="View complete profile"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            currentBatch.map((emp) => {
              const empRedFlags = redFlagsMap.get(emp.employeeKey) || [];
              const empActions = actionItemsMap.get(emp.employeeKey) || [];
              const activeWarning = empRedFlags.find((m) => m.recordStatus === "Open") || empRedFlags[0];
              const hasOverdueAction = empActions.some(
                (m) => m.nextFollowUpDate && m.nextFollowUpDate < todayStr
              );

              return (
                <div key={emp.employeeKey} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {initials(emp.fullName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-navy-DEFAULT">{emp.fullName}</h4>
                          {activeWarning && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                              🚩 Red Flag
                            </span>
                          )}
                          {hasOverdueAction && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              ⏰ Action Due
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted">{emp.designation}</p>
                      </div>
                    </div>

                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                      {emp.employeeId || "—"}
                    </span>
                  </div>

                  {/* Red flag notice if present */}
                  {activeWarning && (
                    <div className="mb-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      <strong className="font-bold">🚩 Conduct Note:</strong>{" "}
                      {activeWarning.discussionNotes}
                    </div>
                  )}

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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleWhatsAppChat(e, emp)}
                      className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-xs transition border border-emerald-300 flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => onSelectEmployee(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition"
                    >
                      <span>View Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
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
