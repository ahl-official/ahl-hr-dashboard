"use client";

import React, { useMemo } from "react";
import { CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { EmployeeSummary, DataQualityMetric } from "@/types";

interface DataReadinessPanelProps {
  employees: EmployeeSummary[];
  allEmployees: EmployeeSummary[];
}

export function DataReadinessPanel({ employees, allEmployees }: DataReadinessPanelProps) {
  // Count frequency of employee IDs across the whole master database
  const idCounts = useMemo(() => {
    return allEmployees.reduce((acc: Record<string, number>, emp) => {
      const id = String(emp.employeeId || "").trim();
      if (id && id !== "0") {
        acc[id] = (acc[id] || 0) + 1;
      }
      return acc;
    }, {});
  }, [allEmployees]);

  const metrics: DataQualityMetric[] = useMemo(() => {
    const fields = [
      { key: "employeeId", label: "Unique Employee ID", uniqueCheck: true },
      { key: "doj", label: "Date of Joining" },
      { key: "dob", label: "Date of Birth" },
      { key: "department", label: "Department" },
      { key: "manager", label: "Reporting Manager" },
      { key: "gender", label: "Gender" },
      { key: "companyEmail", label: "Company Email" },
    ];

    if (!employees.length) {
      return fields.map((f) => ({
        key: f.key,
        label: f.label,
        complete: 0,
        missing: 0,
        percent: 100,
      }));
    }

    return fields.map((field) => {
      const complete = employees.filter((emp) => {
        if (field.uniqueCheck) {
          const id = String(emp.employeeId || "").trim();
          return Boolean(id) && id !== "0" && idCounts[id] === 1;
        }
        return Boolean(emp[field.key as keyof EmployeeSummary]);
      }).length;

      const percent = Math.round((complete / employees.length) * 100);
      return {
        key: field.key,
        label: field.label,
        complete,
        missing: employees.length - complete,
        percent,
      };
    });
  }, [employees, idCounts]);

  const overallScore = useMemo(() => {
    if (!metrics.length) return 100;
    const sum = metrics.reduce((acc, m) => acc + m.percent, 0);
    return Math.round(sum / metrics.length);
  }, [metrics]);

  return (
    <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-borderline">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Audit & Compliance
          </span>
          <h3 className="text-base sm:text-lg font-bold text-navy-DEFAULT">
            Master Data Quality & Readiness
          </h3>
          <p className="text-xs text-muted">
            Field completion across currently active and filtered records.
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200 self-start sm:self-center">
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Readiness Score
            </span>
            <span className="text-xs text-muted">7 Critical Fields</span>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base ${
              overallScore >= 90
                ? "bg-emerald-100 text-emerald-800"
                : overallScore >= 75
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {overallScore}%
          </div>
        </div>
      </div>

      {/* Progress Bars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((item) => (
          <div
            key={item.key}
            className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-navy-DEFAULT truncate pr-1">{item.label}</span>
              <span className="font-bold text-slate-700 shrink-0">{item.percent}%</span>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.percent === 100
                    ? "bg-emerald-500"
                    : item.percent >= 80
                    ? "bg-indigo-600"
                    : item.percent >= 60
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${item.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>{item.complete} complete</span>
              {item.missing > 0 ? (
                <span className="text-rose-600 font-semibold">{item.missing} missing</span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
