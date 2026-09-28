"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Cake,
  AlertTriangle,
  FileText,
  User,
  Plus,
  CheckCircle2,
  CalendarDays,
  ListFilter,
  Eye,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { EmployeeSummary, MeetingRecord, BirthdayEvent, ReviewEvent } from "@/types";
import {
  formatDisplayDate,
  initials,
  parseIsoDate,
  toYearMonthDay,
  formatLocalIsoDate,
  getTodayLocalIsoDate,
} from "@/lib/date-utils";
import {
  getActionFollowUpWhatsAppUrl,
  getMilestoneWhatsAppUrl,
  getBirthdayWhatsAppUrl,
  getCheckInWhatsAppUrl,
} from "@/lib/whatsapp";

export type CalendarEventType = "review" | "meeting" | "followup" | "warning" | "birthday";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle: string;
  dateStr: string; // YYYY-MM-DD
  timeStr?: string;
  badgeLabel: string;
  colorClass: {
    chip: string;
    dot: string;
    border: string;
    badge: string;
  };
  rawEmployee?: EmployeeSummary;
  rawMeeting?: MeetingRecord;
}

interface HRCalendarViewProps {
  employees: EmployeeSummary[];
  meetings: MeetingRecord[];
  birthdays: BirthdayEvent[];
  milestones: ReviewEvent[];
  onOpenRecordMeeting: (prefill?: {
    employeeKey?: string;
    milestone?: string;
    scheduledDate?: string;
    meetingType?: any;
    warningGiven?: "Yes" | "No";
    discussionNotes?: string;
  }) => void;
  onSelectEmployee: (employee: EmployeeSummary) => void;
}

export function HRCalendarView({
  employees,
  meetings,
  birthdays,
  milestones,
  onOpenRecordMeeting,
  onSelectEmployee,
}: HRCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month");
  const [activeFilter, setActiveFilter] = useState<"all" | CalendarEventType>("all");
  const [selectedDayStr, setSelectedDayStr] = useState<string>(
    () => getTodayLocalIsoDate()
  );
  const [isDayAgendaOpen, setIsDayAgendaOpen] = useState<boolean>(true);
  const [inspectedEvent, setInspectedEvent] = useState<CalendarEvent | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Navigation handlers: when navigating months, sync selected date to match
  const prevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDayStr(getTodayLocalIsoDate());
    } else {
      setSelectedDayStr(toYearMonthDay(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  };

  const nextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    setCurrentDate(newDate);
    const today = new Date();
    if (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() === today.getMonth()) {
      setSelectedDayStr(getTodayLocalIsoDate());
    } else {
      setSelectedDayStr(toYearMonthDay(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDayStr(getTodayLocalIsoDate());
    setIsDayAgendaOpen(true);
  };

  const handleDayClick = (day: {
    dateStr: string;
    year: number;
    month: number;
    isCurrentMonth: boolean;
  }) => {
    setSelectedDayStr(day.dateStr);
    setIsDayAgendaOpen(true);
    if (!day.isCurrentMonth) {
      setCurrentDate(new Date(day.year, day.month, 1));
    }
  };

  const monthName = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Aggregate all events into unified CalendarEvent list
  const allEvents: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];

    // 1. HR Meetings (Scheduled or Held)
    meetings.forEach((m) => {
      const targetDate = m.meetingDate || m.scheduledDate;
      if (!targetDate) return;

      const isWarning = m.warningGiven === "Yes";
      const emp = employees.find((e) => e.employeeKey === m.employeeKey);

      list.push({
        id: `mtg-${m.meetingId}`,
        type: isWarning ? "warning" : "meeting",
        title: `${m.employeeName} · ${m.meetingType}`,
        subtitle: m.discussionNotes || "HR Meeting Record",
        dateStr: targetDate,
        badgeLabel: isWarning ? "Warning" : m.recordStatus,
        colorClass: isWarning
          ? {
              chip: "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100",
              dot: "bg-rose-500",
              border: "border-l-4 border-l-rose-500",
              badge: "bg-rose-100 text-rose-800",
            }
          : {
              chip: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
              dot: "bg-sky-500",
              border: "border-l-4 border-l-sky-500",
              badge: "bg-sky-100 text-sky-800",
            },
        rawEmployee: emp,
        rawMeeting: m,
      });

      // 2. Action Notes & Follow-ups due
      if (m.nextFollowUpDate && m.recordStatus !== "Cancelled") {
        const todayStr = getTodayLocalIsoDate();
        const isOverdue = m.nextFollowUpDate < todayStr && m.recordStatus === "Open";

        list.push({
          id: `fup-${m.meetingId}`,
          type: isOverdue ? "warning" : "followup",
          title: `${isOverdue ? "⚠️ Overdue: " : "Action: "}${m.employeeName}`,
          subtitle: m.actionTaken || m.discussionNotes || `Follow-up on ${m.meetingType}`,
          dateStr: m.nextFollowUpDate,
          badgeLabel: isOverdue ? "⚠️ Overdue Action" : "Action Due",
          colorClass: isOverdue
            ? {
                chip: "bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200 font-bold",
                dot: "bg-rose-600",
                border: "border-l-4 border-l-rose-600",
                badge: "bg-rose-200 text-rose-900 font-extrabold",
              }
            : {
                chip: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
                dot: "bg-amber-500",
                border: "border-l-4 border-l-amber-500",
                badge: "bg-amber-100 text-amber-800",
              },
          rawEmployee: emp,
          rawMeeting: m,
        });
      }
    });

    // 3. Milestone reviews (7D, 15D, 1M, Quarterly)
    milestones.forEach((rev) => {
      list.push({
        id: `rev-${rev.employeeKey}-${rev.date}`,
        type: "review",
        title: `${rev.employeeName} · ${rev.shortLabel}`,
        subtitle: `${rev.label} (${rev.department})`,
        dateStr: rev.date,
        badgeLabel: rev.shortLabel,
        colorClass: {
          chip: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100",
          dot: "bg-indigo-500",
          border: "border-l-4 border-l-indigo-500",
          badge: "bg-indigo-100 text-indigo-800",
        },
        rawEmployee: rev.employee,
      });
    });

    // 4. Birthdays
    birthdays.forEach((b) => {
      list.push({
        id: `bday-${b.employeeKey}-${b.date}`,
        type: "birthday",
        title: `🎂 ${b.employeeName}`,
        subtitle: `Turning ${b.age} (${b.department})`,
        dateStr: b.date,
        badgeLabel: "Birthday",
        colorClass: {
          chip: "bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100",
          dot: "bg-pink-500",
          border: "border-l-4 border-l-pink-500",
          badge: "bg-pink-100 text-pink-800",
        },
        rawEmployee: b.employee,
      });
    });

    return list;
  }, [meetings, employees, milestones, birthdays]);

  // Apply Event Type Filter
  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return allEvents;
    return allEvents.filter((ev) => ev.type === activeFilter);
  }, [allEvents, activeFilter]);

  // Map events by dateStr for O(1) lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((ev) => {
      if (!map[ev.dateStr]) map[ev.dateStr] = [];
      map[ev.dateStr].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Calendar Grid Math (Mon - Sun standard business grid)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Monday as index 0: (day + 6) % 7
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const daysInCurrentMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const todayIso = getTodayLocalIsoDate();
    const days = [];

    // Previous month padding
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonthIndex = prevMonthDate.getMonth();

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = toYearMonthDay(prevYear, prevMonthIndex, d);
      days.push({
        dayNumber: d,
        dateStr,
        year: prevYear,
        month: prevMonthIndex,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = toYearMonthDay(currentYear, currentMonth, d);
      days.push({
        dayNumber: d,
        dateStr,
        year: currentYear,
        month: currentMonth,
        isCurrentMonth: true,
        isToday: dateStr === todayIso,
      });
    }

    // Next month padding to round up to complete weeks (multiple of 7)
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonthIndex = nextMonthDate.getMonth();

    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = toYearMonthDay(nextYear, nextMonthIndex, d);
      days.push({
        dayNumber: d,
        dateStr,
        year: nextYear,
        month: nextMonthIndex,
        isCurrentMonth: false,
        isToday: dateStr === todayIso,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Selected Day Events for mobile agenda drawer & list
  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDayStr] || [];
  }, [eventsByDate, selectedDayStr]);

  // Agenda items for currently viewed month
  const monthAgendaEvents = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return filteredEvents
      .filter((ev) => ev.dateStr.startsWith(prefix))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredEvents, currentYear, currentMonth]);

  return (
    <section id="calendar" className="mb-12">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            Interactive Timeline
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-DEFAULT tracking-tight flex items-center gap-2.5">
            <span>HR Calendar & Schedule</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Live Agenda
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Google Calendar-style schedule of reviews, meetings, follow-ups, and workforce celebrations.
          </p>
        </div>

        <button
          onClick={() =>
            onOpenRecordMeeting({
              scheduledDate: getTodayLocalIsoDate(),
            })
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-surface rounded-card border border-borderline shadow-card overflow-hidden">
        {/* Navigation & Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-borderline flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70">
          {/* Left: Month Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-base sm:text-lg font-black text-navy-DEFAULT w-44 sm:w-52">
              {monthName}
            </h3>

            <div className="flex items-center rounded-xl bg-white border border-slate-200 shadow-sm p-0.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-navy-DEFAULT hover:bg-slate-100 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={jumpToToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:text-navy-DEFAULT hover:bg-slate-100 transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Filters & View Switcher */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Filter Pills */}
            <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-xl text-xs font-semibold text-slate-600 shadow-sm overflow-x-auto max-w-full">
              {[
                { id: "all", label: "All" },
                { id: "review", label: "Reviews" },
                { id: "meeting", label: "Meetings" },
                { id: "followup", label: "Follow-ups" },
                { id: "birthday", label: "Birthdays" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    activeFilter === f.id
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : "hover:text-navy-DEFAULT"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* View Switcher (Month / Agenda) */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                  viewMode === "month"
                    ? "bg-white text-navy-DEFAULT shadow-xs"
                    : "text-slate-600 hover:text-navy-DEFAULT"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Month</span>
              </button>
              <button
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                  viewMode === "agenda"
                    ? "bg-white text-navy-DEFAULT shadow-xs"
                    : "text-slate-600 hover:text-navy-DEFAULT"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. MONTH VIEW (Responsive Google Calendar Grid) */}
        {viewMode === "month" && (
          <div>
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-borderline bg-slate-50/90 text-center py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-indigo-600">Sat</span>
              <span className="text-indigo-600">Sun</span>
            </div>

            {/* 7-Column Calendar Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-borderline border-b border-borderline">
              {calendarDays.map((day, idx) => {
                const dayEvents = eventsByDate[day.dateStr] || [];
                const isSelected = selectedDayStr === day.dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[75px] sm:min-h-[110px] lg:min-h-[125px] p-1 sm:p-2 flex flex-col justify-between transition group relative cursor-pointer ${
                      !day.isCurrentMonth ? "bg-slate-50/40 text-slate-400" : "bg-white"
                    } ${isSelected ? "ring-2 ring-indigo-500 ring-inset z-10" : "hover:bg-slate-50/60"}`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center transition ${
                          day.isToday
                            ? "bg-indigo-600 text-white shadow-xs"
                            : isSelected
                            ? "bg-indigo-100 text-indigo-900 font-extrabold"
                            : day.isCurrentMonth
                            ? "text-slate-700 group-hover:bg-slate-200"
                            : "text-slate-400"
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {/* Quick "+ Meeting" button on date hover (Desktop) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRecordMeeting({ scheduledDate: day.dateStr });
                        }}
                        className="hidden md:group-hover:flex items-center justify-center w-5 h-5 rounded hover:bg-indigo-100 text-indigo-600 transition"
                        title={`Schedule meeting on ${day.dateStr}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Desktop Event Chips (Visible on md+) */}
                    <div className="hidden md:flex flex-col gap-1 overflow-hidden flex-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedEvent(ev);
                          }}
                          className={`w-full text-left px-2 py-0.5 rounded text-[11px] font-semibold border truncate transition ${ev.colorClass.chip}`}
                          title={`${ev.title} (${ev.subtitle})`}
                        >
                          {ev.title}
                        </button>
                      ))}

                      {dayEvents.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-500 px-1 hover:text-indigo-600 transition">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Mobile Dot Indicators (Visible on mobile screens) */}
                    <div className="flex md:hidden flex-wrap gap-1 mt-auto items-center justify-center">
                      {dayEvents.slice(0, 4).map((ev) => (
                        <span
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${ev.colorClass.dot}`}
                        />
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="text-[9px] text-slate-400 font-bold leading-none">+</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Day Agenda Strip (Collapsible & Dismissible) */}
            {isDayAgendaOpen ? (
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-borderline animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs sm:text-sm font-bold text-navy-DEFAULT">
                      Schedule for {formatDisplayDate(selectedDayStr)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                      {selectedDayEvents.length} items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenRecordMeeting({ scheduledDate: selectedDayStr })}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add for this date</span>
                    </button>
                    <button
                      onClick={() => setIsDayAgendaOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                      title="Hide day schedule"
                      aria-label="Hide day schedule"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-white border border-slate-200/80 text-xs text-muted">
                    No meetings or milestones scheduled on this date. Click{" "}
                    <button
                      onClick={() => onOpenRecordMeeting({ scheduledDate: selectedDayStr })}
                      className="text-indigo-600 font-bold underline"
                    >
                      Add for this date
                    </button>{" "}
                    to schedule one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setInspectedEvent(ev)}
                        className={`p-3 rounded-xl bg-white border shadow-xs hover:shadow-sm transition cursor-pointer flex flex-col justify-between ${ev.colorClass.border}`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${ev.colorClass.badge}`}>
                              {ev.badgeLabel}
                            </span>
                            <span className="text-[11px] text-muted font-medium">{ev.dateStr}</span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-navy-DEFAULT truncate">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-muted line-clamp-1 mt-0.5">{ev.subtitle}</p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
                          <span>View Details</span>
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-borderline flex items-center justify-between text-xs text-muted">
                <span className="font-medium text-slate-500">
                  Viewing {monthName} · Click any day cell to inspect its schedule
                </span>
                <button
                  onClick={() => setIsDayAgendaOpen(true)}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Show Schedule ({selectedDayEvents.length} items)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. AGENDA VIEW (Chronological Timeline) */}
        {viewMode === "agenda" && (
          <div className="p-4 sm:p-6 divide-y divide-borderline">
            {monthAgendaEvents.length === 0 ? (
              <div className="py-16 text-center text-muted">
                <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No events found for {monthName}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust active filter or schedule a new meeting.
                </p>
              </div>
            ) : (
              monthAgendaEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setInspectedEvent(ev)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-3 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 font-extrabold text-xs flex flex-col items-center justify-center shrink-0 border border-slate-200">
                      <span className="text-sm leading-tight text-navy-DEFAULT">
                        {ev.dateStr.slice(8, 10)}
                      </span>
                      <span className="text-[10px] leading-tight text-slate-500 uppercase">
                        {new Date(ev.dateStr).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-navy-DEFAULT truncate">
                          {ev.title}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ev.colorClass.badge}`}>
                          {ev.badgeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted truncate mt-0.5">{ev.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                      {formatDisplayDate(ev.dateStr)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedEvent(ev);
                      }}
                      className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition"
                      aria-label="Inspect event"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Event Details Quick Popover / Modal */}
      {inspectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setInspectedEvent(null)}
          />

          <div className="relative bg-surface rounded-2xl max-w-md w-full p-6 shadow-2xl border border-borderline z-10">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-borderline">
              <span className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${inspectedEvent.colorClass.badge}`}>
                {inspectedEvent.badgeLabel}
              </span>
              <button
                onClick={() => setInspectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-navy-DEFAULT">
                  {inspectedEvent.title}
                </h3>
                <p className="text-xs text-muted">{inspectedEvent.subtitle}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-bold text-navy-DEFAULT">
                    {formatDisplayDate(inspectedEvent.dateStr)}
                  </span>
                </div>

                {inspectedEvent.rawMeeting && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Meeting Status:</span>
                      <span className="font-bold">{inspectedEvent.rawMeeting.recordStatus}</span>
                    </div>
                    {inspectedEvent.rawMeeting.recordedBy && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recorded By:</span>
                        <span className="font-medium text-slate-700">
                          {inspectedEvent.rawMeeting.recordedBy}
                        </span>
                      </div>
                    )}
                    {inspectedEvent.rawMeeting.discussionNotes && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="block font-semibold text-slate-700 mb-0.5">Notes:</span>
                        <p className="text-slate-600 line-clamp-3">
                          {inspectedEvent.rawMeeting.discussionNotes}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {inspectedEvent.rawEmployee && (
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-bold">{inspectedEvent.rawEmployee.department}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2">
              {inspectedEvent.rawEmployee && (
                <button
                  onClick={() => {
                    const emp = inspectedEvent.rawEmployee!;
                    let url = "";
                    if (inspectedEvent.type === "birthday") {
                      url = getBirthdayWhatsAppUrl(emp.mobile, emp.fullName);
                    } else if (inspectedEvent.type === "review") {
                      url = getMilestoneWhatsAppUrl(
                        emp.mobile,
                        emp.fullName,
                        inspectedEvent.badgeLabel,
                        formatDisplayDate(inspectedEvent.dateStr)
                      );
                    } else if (inspectedEvent.rawMeeting) {
                      const todayStr = getTodayLocalIsoDate();
                      const isOverdue =
                        inspectedEvent.rawMeeting.nextFollowUpDate &&
                        inspectedEvent.rawMeeting.nextFollowUpDate < todayStr;
                      url = getActionFollowUpWhatsAppUrl(
                        emp.mobile,
                        emp.fullName,
                        inspectedEvent.rawMeeting.actionTaken ||
                          inspectedEvent.rawMeeting.discussionNotes ||
                          "HR Follow-up",
                        formatDisplayDate(inspectedEvent.dateStr),
                        Boolean(isOverdue)
                      );
                    } else {
                      url = getCheckInWhatsAppUrl(emp.mobile, emp.fullName);
                    }
                    window.open(url, "_blank");
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 transition flex items-center gap-1.5 shadow-sm"
                  title="Send WhatsApp Follow-up / Greeting"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}

              {inspectedEvent.rawEmployee && (
                <button
                  onClick={() => {
                    const emp = inspectedEvent.rawEmployee;
                    setInspectedEvent(null);
                    if (emp) onSelectEmployee(emp);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                >
                  View Profile
                </button>
              )}

              <button
                onClick={() => {
                  const dateStr = inspectedEvent.dateStr;
                  const empKey = inspectedEvent.rawEmployee?.employeeKey;
                  setInspectedEvent(null);
                  onOpenRecordMeeting({
                    employeeKey: empKey,
                    scheduledDate: dateStr,
                  });
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
              >
                Schedule Follow-Up
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
