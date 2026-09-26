"use client";

import React from "react";
import {
  Users,
  UserPlus,
  Clock,
  Briefcase,
  Cake,
  CalendarCheck2,
} from "lucide-react";

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
  const cards = [
    {
      id: "total",
      label: "Employee Records",
      value: totalEmployees,
      subtext: `Across ${companyCount} ${companyCount === 1 ? "company" : "companies"}`,
      icon: Users,
      accentBorder: "border-indigo-500",
      accentBg: "bg-indigo-50 text-indigo-700",
      iconColor: "text-indigo-600",
    },
    {
      id: "new",
      label: "New This Month",
      value: newThisMonth,
      subtext: "Joined in current calendar month",
      icon: UserPlus,
      accentBorder: "border-emerald-500",
      accentBg: "bg-emerald-50 text-emerald-700",
      iconColor: "text-emerald-600",
    },
    {
      id: "tenure",
      label: "Average Tenure",
      value: averageTenure,
      subtext: "DOJ to today for filtered staff",
      icon: Clock,
      accentBorder: "border-sky-500",
      accentBg: "bg-sky-50 text-sky-700",
      iconColor: "text-sky-600",
    },
    {
      id: "departments",
      label: "Departments",
      value: departmentCount,
      subtext: "Active functional divisions",
      icon: Briefcase,
      accentBorder: "border-violet-500",
      accentBg: "bg-violet-50 text-violet-700",
      iconColor: "text-violet-600",
    },
    {
      id: "birthdays",
      label: "Birthdays (30 Days)",
      value: birthdayCount,
      subtext: "Celebrations in next 30 days",
      icon: Cake,
      accentBorder: "border-rose-500",
      accentBg: "bg-rose-50 text-rose-700",
      iconColor: "text-rose-600",
    },
    {
      id: "reviews",
      label: "Reviews (30 Days)",
      value: milestoneCount,
      subtext: "Onboarding & tenure milestones",
      icon: CalendarCheck2,
      accentBorder: "border-amber-500",
      accentBg: "bg-amber-50 text-amber-700",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`bg-surface rounded-card p-5 sm:p-6 border border-borderline border-l-4 ${card.accentBorder} shadow-card hover:shadow-cardHover transition duration-200 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {card.label}
              </span>
              <div className={`p-2.5 rounded-xl ${card.accentBg}`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-navy-DEFAULT tracking-tight mb-1">
                {card.value}
              </div>
              <p className="text-xs text-muted font-medium">{card.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
