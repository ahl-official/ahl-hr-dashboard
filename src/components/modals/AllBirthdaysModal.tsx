"use client";

import React from "react";
import { X, Cake } from "lucide-react";
import { BirthdayEvent } from "@/types";
import { formatEventDate, humanCountdown, birthdayAgeText, initials } from "@/lib/date-utils";

interface AllBirthdaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  birthdays: BirthdayEvent[];
}

export function AllBirthdaysModal({ isOpen, onClose, birthdays }: AllBirthdaysModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-navy-900/60" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl max-w-xl w-full p-6 shadow-md border border-borderline z-10 my-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderline">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-DEFAULT">Upcoming Birthdays</h3>
              <p className="text-xs text-muted">All celebrations occurring in the next 30 calendar days.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto pr-1">
          {birthdays.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No birthdays in the next 30 days.
            </div>
          ) : (
            birthdays.map((item) => {
              const dateText = formatEventDate(item.dateObj);
              const parts = dateText.split(" ");
              return (
                <div
                  key={item.employeeKey}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex flex-col items-center justify-center shrink-0 border border-rose-100">
                      <span className="text-[13px] leading-tight font-semibold">{parts[0]}</span>
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
