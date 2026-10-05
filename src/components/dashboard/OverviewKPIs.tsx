"use client";

import React from "react";

interface OverviewKPIsProps {
  totalEmployees: number;
  newThisMonth: number;
  averageTenure: string;
  departmentCount: number;
  companyCount: number;
  birthdayCount: number;
  milestoneCount: number;
}

export function OverviewKPIs({
  totalEmployees,
  newThisMonth,
  averageTenure,
  departmentCount,
  companyCount,
  birthdayCount,
  milestoneCount,
}: OverviewKPIsProps) {
  const stats = [
    { id: "total", label: "Employees", value: totalEmployees, note: `${companyCount} ${companyCount === 1 ? "company" : "companies"}` },
    { id: "new", label: "New this month", value: newThisMonth, note: "Joined this calendar month" },
    { id: "tenure", label: "Avg. tenure", value: averageTenure, note: "From date of joining" },
    { id: "departments", label: "Departments", value: departmentCount, note: "In current filter" },
    { id: "birthdays", label: "Birthdays", value: birthdayCount, note: "Next 30 days" },
    { id: "reviews", label: "Reviews due", value: milestoneCount, note: "Next 30 days" },
  ];

  return (
    <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px mb-6 bg-borderline border border-borderline rounded-card overflow-hidden">
      {stats.map((s) => (
        <div key={s.id} className="bg-surface px-4 py-4 sm:px-5">
          <dt className="text-xs font-medium text-muted">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-navy-DEFAULT tracking-tight tabular-nums">{s.value}</dd>
          <p className="mt-0.5 text-[11px] text-slate-400 truncate">{s.note}</p>
        </div>
      ))}
    </dl>
  );
}
