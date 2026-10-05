"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { MeetingRecord, EmployeeSummary } from "@/types";
import { getActionFollowUpWhatsAppUrl } from "@/lib/whatsapp";
import { formatDisplayDate, daysBetween, parseIsoDate, getTodayLocalIsoDate } from "@/lib/date-utils";

interface ActionAlertsBannerProps {
  meetings: MeetingRecord[];
  employees: EmployeeSummary[];
  onUpdateMeetingStatus: (
    meetingId: string,
    status: "Open" | "Completed" | "Cancelled"
  ) => Promise<boolean>;
  onSelectEmployee: (employee: EmployeeSummary) => void;
}

export function ActionAlertsBanner({
  meetings,
  employees,
  onUpdateMeetingStatus,
  onSelectEmployee,
}: ActionAlertsBannerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const todayStr = getTodayLocalIsoDate();
  const todayDate = new Date();

  // 1. Identify all open meetings with action notes / follow-up dates
  const openActionMeetings = meetings.filter(
    (m) => (m.nextFollowUpDate || m.actionTaken) && m.recordStatus === "Open"
  );

  // Overdue actions: due date has passed
  const overdueActions = openActionMeetings
    .filter((m) => m.nextFollowUpDate && m.nextFollowUpDate < todayStr)
    .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

  // Due today
  const dueTodayActions = openActionMeetings.filter(
    (m) => m.nextFollowUpDate === todayStr
  );

  // Active Red Flag / Warning records
  const activeRedFlags = meetings.filter(
    (m) => (m.warningGiven === "Yes" || m.meetingType === "Warning") && m.recordStatus === "Open"
  );

  const totalUrgentCount = overdueActions.length + dueTodayActions.length;

  if (totalUrgentCount === 0 && activeRedFlags.length === 0) {
    return null; // All clear!
  }

  const handleMarkDone = async (meetingId: string) => {
    setProcessingId(meetingId);
    try {
      await onUpdateMeetingStatus(meetingId, "Completed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleWhatsApp = (meeting: MeetingRecord) => {
    const emp = employees.find((e) => e.employeeKey === meeting.employeeKey);
    const actionText = meeting.actionTaken || meeting.discussionNotes || "HR Follow-up Discussion";
    const dueDate = formatDisplayDate(meeting.nextFollowUpDate);
    const isOverdue = meeting.nextFollowUpDate < todayStr;
    const url = getActionFollowUpWhatsAppUrl(
      emp?.mobile || "",
      meeting.employeeName,
      actionText,
      dueDate,
      isOverdue
    );
    window.open(url, "_blank");
  };

  return (
    <section className="mb-8" aria-label="Urgent Action Items and Red Flag Alerts">
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-rose-950">
                  HR Action Reminders & Red Flag Alerts
                </h3>
                {overdueActions.length > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">
                    {overdueActions.length} Overdue
                  </span>
                )}
                {dueTodayActions.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                    {dueTodayActions.length} Due Today
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800/80 mt-0.5">
                Target deadlines planned by HR that require prompt follow-through or resolution.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-bold text-rose-900 border border-rose-200/60 transition shadow-sm"
          >
            <span>{isExpanded ? "Collapse" : `View ${totalUrgentCount} Items`}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Action Items List */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-rose-200/60 space-y-2.5">
            {/* 1. Overdue Items (Highest Urgency) */}
            {overdueActions.map((m) => {
              const emp = employees.find((e) => e.employeeKey === m.employeeKey);
              const dueD = parseIsoDate(m.nextFollowUpDate);
              const daysAgo = dueD ? Math.max(1, daysBetween(dueD, todayDate)) : 1;

              return (
                <div
                  key={`overdue-${m.meetingId}`}
                  className="bg-white rounded-xl p-3 sm:p-4 border border-rose-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                      !
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-navy-DEFAULT">
                          {m.employeeName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                          Overdue by {daysAgo} {daysAgo === 1 ? "day" : "days"} (Due:{" "}
                          {formatDisplayDate(m.nextFollowUpDate)})
                        </span>
                        {emp?.department && (
                          <span className="text-[10px] text-muted font-medium">
                            · {emp.department}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        <strong className="text-slate-900">Action Required:</strong>{" "}
                        {m.actionTaken || m.discussionNotes || "Action follow-up pending"}
                      </p>
                      {m.discussionNotes && m.actionTaken && (
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          Notes: {m.discussionNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {/* WhatsApp Trigger */}
                    <button
                      onClick={() => handleWhatsApp(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 font-bold text-xs transition shadow-sm"
                      title="Send WhatsApp Follow-up to employee"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    {/* View Profile */}
                    {emp && (
                      <button
                        onClick={() => onSelectEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                        title="View employee dossier"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Profile</span>
                      </button>
                    )}

                    {/* Mark Completed */}
                    <button
                      onClick={() => handleMarkDone(m.meetingId)}
                      disabled={processingId === m.meetingId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
                      title="Mark action item as resolved"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{processingId === m.meetingId ? "Resolving..." : "Mark Done"}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 2. Actions Due Today */}
            {dueTodayActions.map((m) => {
              const emp = employees.find((e) => e.employeeKey === m.employeeKey);

              return (
                <div
                  key={`today-${m.meetingId}`}
                  className="bg-white rounded-xl p-3 sm:p-4 border border-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                      ⏰
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-navy-DEFAULT">
                          {m.employeeName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          Due Today
                        </span>
                        {emp?.department && (
                          <span className="text-[10px] text-muted font-medium">
                            · {emp.department}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        <strong className="text-slate-900">Action:</strong>{" "}
                        {m.actionTaken || m.discussionNotes}
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleWhatsApp(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 font-bold text-xs transition shadow-sm"
                      title="Send WhatsApp Follow-up"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    {emp && (
                      <button
                        onClick={() => onSelectEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Profile</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleMarkDone(m.meetingId)}
                      disabled={processingId === m.meetingId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{processingId === m.meetingId ? "Resolving..." : "Mark Done"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
