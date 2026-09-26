"use client";

import React, { useState } from "react";
import { Cake, CalendarCheck2, ChevronRight, UserPlus, Check } from "lucide-react";
import { BirthdayEvent, ReviewEvent } from "@/types";
import { formatEventDate, humanCountdown, birthdayAgeText, initials, formatExactTenure } from "@/lib/date-utils";

interface CelebrationsAndReviewsProps {
  birthdays: BirthdayEvent[];
  milestones7: ReviewEvent[];
  milestones15: ReviewEvent[];
  milestones30: ReviewEvent[];
  milestonesAll: ReviewEvent[];
  onOpenRecordMeeting: (prefill: {
    employeeKey: string;
    milestone: string;
    scheduledDate: string;
    meetingType: "Onboarding Feedback" | "Quarterly Review";
  }) => void;
  onOpenAllBirthdays: () => void;
}

export function CelebrationsAndReviews({
  birthdays,
  milestones7,
  milestones15,
  milestones30,
  milestonesAll,
  onOpenRecordMeeting,
  onOpenAllBirthdays,
}: CelebrationsAndReviewsProps) {
  const [activeTab, setActiveTab] = useState<"7" | "15" | "30" | "all">("7");

  const activeMilestones =
    activeTab === "7"
      ? milestones7
      : activeTab === "15"
      ? milestones15
      : activeTab === "30"
      ? milestones30
      : milestonesAll;

  const visibleBirthdays = birthdays.slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* 1. Upcoming Birthdays Card */}
      <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-borderline">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-DEFAULT">Upcoming Birthdays</h3>
                <p className="text-xs text-muted">Next 30 calendar days</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
              {birthdays.length} {birthdays.length === 1 ? "birthday" : "birthdays"}
            </span>
          </div>

          {visibleBirthdays.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">
                ✓
              </div>
              <p className="text-sm font-bold text-slate-700">All clear</p>
              <p className="text-xs text-slate-400 mt-0.5">No birthdays in the next 30 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleBirthdays.map((item) => {
                const dateText = formatEventDate(item.dateObj);
                const parts = dateText.split(" ");
                return (
                  <div
                    key={item.employeeKey}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex flex-col items-center justify-center shrink-0 border border-rose-100">
                        <span className="text-[13px] leading-tight font-extrabold">{parts[0]}</span>
                        <span className="text-[10px] leading-tight uppercase font-medium">{parts[1]}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-navy-DEFAULT truncate">
                          {item.employeeName}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {item.department} {item.age > 0 && `· ${birthdayAgeText(item.age)}`}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          item.daysUntil === 0
                            ? "bg-rose-100 text-rose-800 font-bold animate-pulse"
                            : item.daysUntil <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {humanCountdown(item.daysUntil)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {birthdays.length > 8 && (
          <div className="mt-4 pt-3 border-t border-borderline text-center">
            <button
              onClick={onOpenAllBirthdays}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition"
            >
              View all {birthdays.length} birthdays <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Feedback & Tenure Reviews Card */}
      <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-borderline">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-DEFAULT">Feedback & Reviews</h3>
                <p className="text-xs text-muted">Onboarding (7D, 15D, 1M) & Quarterly Reviews</p>
              </div>
            </div>

            {/* Range Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 self-start sm:self-center">
              {[
                { id: "7", label: "7 Days" },
                { id: "15", label: "15 Days" },
                { id: "30", label: "30 Days" },
                { id: "all", label: "All Upcoming" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    activeTab === tab.id
                      ? "bg-white text-navy-DEFAULT shadow-sm font-bold"
                      : "hover:text-navy-DEFAULT"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeMilestones.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-sm font-bold">
                ✓
              </div>
              <p className="text-sm font-bold text-slate-700">All caught up</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === "all"
                  ? "No eligible review milestones found."
                  : `No feedback or reviews due in the next ${activeTab} days.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
              {activeMilestones.map((item) => {
                const dateText = formatEventDate(item.dateObj);
                const parts = dateText.split(" ");
                return (
                  <div
                    key={`${item.employeeKey}-${item.label}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs flex flex-col items-center justify-center shrink-0 border border-amber-100">
                        <span className="text-[13px] leading-tight font-extrabold">{parts[0]}</span>
                        <span className="text-[10px] leading-tight uppercase font-medium">{parts[1]}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-navy-DEFAULT truncate">
                            {item.employeeName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                            {item.shortLabel}
                          </span>
                        </div>
                        <div className="text-xs text-muted truncate mt-0.5">
                          Tenure: {formatExactTenure(item.employee.doj)} · Next: {item.label} · {item.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 hidden sm:inline-block">
                        {humanCountdown(item.daysUntil)}
                      </span>
                      <button
                        onClick={() =>
                          onOpenRecordMeeting({
                            employeeKey: item.employeeKey,
                            milestone: item.label,
                            scheduledDate: item.date,
                            meetingType: item.meetingType,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 transition shadow-sm"
                        title="Record review meeting"
                      >
                        Record
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
