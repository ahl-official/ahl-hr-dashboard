"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  ExternalLink,
  ChevronDown,
  Paperclip,
} from "lucide-react";
import { MeetingRecord } from "@/types";
import { formatDisplayDate, daysBetween, startOfDay, parseIsoDate } from "@/lib/date-utils";

interface HRRecordsSectionProps {
  meetings: MeetingRecord[];
  onOpenAddMeeting: () => void;
}

export function HRRecordsSection({ meetings, onOpenAddMeeting }: HRRecordsSectionProps) {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [displayCount, setDisplayCount] = useState<number>(20);

  // Compute Meeting Summary Metrics
  const today = startOfDay(new Date());
  const openCount = useMemo(() => meetings.filter((m) => m.recordStatus === "Open").length, [meetings]);
  const warningCount = useMemo(() => meetings.filter((m) => m.warningGiven === "Yes").length, [meetings]);
  const followUpsDueCount = useMemo(() => {
    return meetings.filter((m) => {
      if (m.recordStatus === "Cancelled") return false;
      const fDate = parseIsoDate(m.nextFollowUpDate);
      if (!fDate) return false;
      const days = daysBetween(today, fDate);
      return days >= 0 && days <= 7;
    }).length;
  }, [meetings, today]);

  // Filtered list
  const filteredMeetings = useMemo(() => {
    if (statusFilter === "All") return meetings;
    return meetings.filter((m) => m.recordStatus === statusFilter);
  }, [meetings, statusFilter]);

  const visibleList = filteredMeetings.slice(0, displayCount);

  return (
    <section id="records" className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Operational Documentation
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-DEFAULT tracking-tight">
            HR Records & Meetings
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Discussions, quarterly milestones, warning logs, and follow-ups.
          </p>
        </div>

        <button
          onClick={onOpenAddMeeting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Record Meeting</span>
        </button>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-surface p-4 rounded-2xl border border-borderline shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">All Meetings</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-navy-DEFAULT">{meetings.length}</div>
          <span className="text-[11px] text-muted font-medium">Logged in HR registry</span>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-borderline shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Open Records</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-600">{openCount}</div>
          <span className="text-[11px] text-muted font-medium">Action items pending</span>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-borderline shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Follow-Ups (7D)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{followUpsDueCount}</div>
          <span className="text-[11px] text-muted font-medium">Due in next 7 days</span>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-borderline shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Warnings Logged</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{warningCount}</div>
          <span className="text-[11px] text-muted font-medium">Disciplinary records</span>
        </div>
      </div>

      {/* Meeting List with Filter */}
      <div className="bg-surface rounded-card p-5 sm:p-6 border border-borderline shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-borderline">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-navy-DEFAULT">Meeting Activity Log</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {filteredMeetings.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 focus:bg-white focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open Only</option>
              <option value="Completed">Completed Only</option>
              <option value="Cancelled">Cancelled Only</option>
            </select>
          </div>
        </div>

        {visibleList.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No meeting records found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Add the first review, warning or follow-up record.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleList.map((m) => {
              const recordDate = m.meetingDate || m.scheduledDate;
              return (
                <div
                  key={m.meetingId}
                  className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Employee info & type */}
                  <div className="min-w-0 md:w-1/4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-navy-DEFAULT truncate">
                        {m.employeeName}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        {m.employeeId || "No ID"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {m.meetingType}
                      </span>
                      {m.milestone && (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {m.milestone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Discussion notes */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                      {m.discussionNotes || "No discussion notes recorded."}
                    </p>
                    {m.actionTaken && (
                      <p className="text-[11px] text-muted mt-1 truncate">
                        <strong className="text-slate-700">Action:</strong> {m.actionTaken}
                      </p>
                    )}
                  </div>

                  {/* Right: Dates, Status, & Attachment */}
                  <div className="flex flex-wrap md:flex-col items-start md:items-end justify-between md:justify-center gap-2 shrink-0 md:w-48 text-right">
                    <div className="flex items-center gap-1.5">
                      {m.warningGiven === "Yes" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Warning
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          m.recordStatus === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.recordStatus === "Cancelled"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {m.recordStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted">
                      <span>Date: <strong>{formatDisplayDate(recordDate)}</strong></span>
                      {m.nextFollowUpDate && (
                        <span className="block text-amber-700 font-medium">
                          Follow-up: {formatDisplayDate(m.nextFollowUpDate)}
                        </span>
                      )}
                    </div>

                    {m.attachmentLink && (
                      <a
                        href={m.attachmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                      >
                        <Paperclip className="w-3 h-3" /> Attachment
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredMeetings.length > displayCount && (
          <div className="mt-5 text-center">
            <button
              onClick={() => setDisplayCount((prev) => prev + 20)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
            >
              Load More Records ({filteredMeetings.length - displayCount} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
