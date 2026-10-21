"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Phone,
  Video,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Star,
  Plus,
  Search,
  Filter,
  ExternalLink,
  User,
  Sparkles,
  ChevronRight,
  Loader2,
  Briefcase,
  X,
  Share2,
  BrainCircuit,
  Building,
  RefreshCw,
} from "lucide-react";
import type { FmsCandidate, FmsInterviewRecord } from "@/types/fms";
import type { EnrichedInterview, ScheduleInterviewInput } from "@/lib/fms-candidates-store";
import { normalizeFmsPhone } from "@/lib/fms-rules";

interface TodayInterviewsTabProps {
  onNavigateToCandidate?: (candidateId: string) => void;
  onNavigateToPipeline?: () => void;
}

export default function TodayInterviewsTab({
  onNavigateToCandidate,
  onNavigateToPipeline,
}: TodayInterviewsTabProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // States
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(todayStr);
  const [interviews, setInterviews] = useState<EnrichedInterview[]>([]);
  const [candidatesList, setCandidatesList] = useState<FmsCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");

  // Evaluation Modal
  const [evalTarget, setEvalTarget] = useState<EnrichedInterview | null>(null);
  const [evalOutcome, setEvalOutcome] = useState<"Passed" | "Failed" | "On Hold" | "Rescheduled">("Passed");
  const [evalRating, setEvalRating] = useState<number>(5);
  const [evalFeedback, setEvalFeedback] = useState<string>("");
  const [evalAutoAdvance, setEvalAutoAdvance] = useState<boolean>(true);
  const [evalSubmitting, setEvalSubmitting] = useState<boolean>(false);

  // Schedule Interview Modal
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [schedCandidateId, setSchedCandidateId] = useState<string>("");
  const [schedRoundName, setSchedRoundName] = useState<string>("Salon Practical Trial");
  const [schedDate, setSchedDate] = useState<string>(todayStr);
  const [schedTime, setSchedTime] = useState<string>("11:00 AM");
  const [schedMode, setSchedMode] = useState<"In-Person" | "Video Call" | "Phone Call">("In-Person");
  const [schedLocation, setSchedLocation] = useState<string>("Bandra Flagship Salon - Station 2");
  const [schedInterviewer, setSchedInterviewer] = useState<string>("Vikram Mehta (Creative Director)");
  const [schedDuration, setSchedDuration] = useState<number>(45);
  const [schedSubmitting, setSchedSubmitting] = useState<boolean>(false);

  // HireOS & DISC Modal
  const [discTarget, setDiscTarget] = useState<EnrichedInterview | null>(null);

  // Fetch interviews
  const loadInterviews = async (dateParam: string) => {
    try {
      setError(null);
      const url =
        dateParam === "all"
          ? "/api/recruitment/candidates-fms?interviewsDate=all"
          : `/api/recruitment/candidates-fms?interviewsDate=${dateParam}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setInterviews(json.data.interviews || []);
      } else {
        throw new Error(json.message || "Failed to load interviews");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load interviews");
    }
  };

  // Fetch active candidates for scheduling dropdown
  const loadActiveCandidates = async () => {
    try {
      const res = await fetch("/api/recruitment/candidates-fms?status=Active");
      const json = await res.json();
      if (json.success && json.data?.candidates) {
        setCandidatesList(json.data.candidates);
        if (json.data.candidates.length > 0 && !schedCandidateId) {
          setSchedCandidateId(json.data.candidates[0].id);
        }
      }
    } catch (e) {
      console.warn("Could not load candidates for dropdown", e);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadInterviews(selectedDateFilter), loadActiveCandidates()]).finally(() => {
      setLoading(false);
    });
  }, [selectedDateFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInterviews(selectedDateFilter);
    setRefreshing(false);
  };

  // Submit Evaluation
  const handleLogEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalTarget) return;

    try {
      setEvalSubmitting(true);
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log-interview-outcome",
          candidateId: evalTarget.candidateId,
          interviewId: evalTarget.id,
          outcome: {
            status: evalOutcome,
            rating: evalRating,
            feedback: evalFeedback,
            advanceToNextStage: evalOutcome === "Passed" ? evalAutoAdvance : false,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to log evaluation");
      }

      // Close modal and refresh list
      setEvalTarget(null);
      setEvalFeedback("");
      await loadInterviews(selectedDateFilter);
    } catch (err: any) {
      alert("Error logging evaluation: " + err.message);
    } finally {
      setEvalSubmitting(false);
    }
  };

  // Submit Schedule
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedCandidateId) {
      alert("Please select a candidate");
      return;
    }

    try {
      setSchedSubmitting(true);
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule-interview",
          candidateId: schedCandidateId,
          roundName: schedRoundName,
          scheduledDate: schedDate,
          scheduledTime: schedTime,
          mode: schedMode,
          locationOrLink: schedLocation,
          interviewerName: schedInterviewer,
          durationMinutes: schedDuration,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to schedule interview");
      }

      setIsScheduleOpen(false);
      // If scheduled date matches current view or is "all", reload
      if (selectedDateFilter === schedDate || selectedDateFilter === "all") {
        await loadInterviews(selectedDateFilter);
      } else {
        setSelectedDateFilter(schedDate);
      }
    } catch (err: any) {
      alert("Error scheduling interview: " + err.message);
    } finally {
      setSchedSubmitting(false);
    }
  };

  // WhatsApp Reminder Generator
  const generateWhatsAppReminder = (interview: EnrichedInterview) => {
    const cleanPhone = normalizeFmsPhone(interview.candidatePhone);
    const dateFormatted =
      interview.scheduledDate === todayStr
        ? "Today"
        : interview.scheduledDate === tomorrowStr
        ? "Tomorrow"
        : interview.scheduledDate;

    const brandName = interview.candidateBrand?.toLowerCase() === "alchamae" ? "Alchemane" : "American Hairline";
    const text = `Hi ${interview.candidateName}! This is a reminder from the HR Team for your ${interview.roundName} for the ${interview.candidatePosition || "Hair Specialist"} role at ${brandName}.\n\n📅 Date: ${dateFormatted}\n⏰ Time: ${interview.scheduledTime} (${interview.durationMinutes || 45} mins)\n📍 Mode: ${interview.mode} - ${interview.locationOrLink || "Salon"}\n👤 Interviewer: ${interview.interviewerName}\n\nPlease confirm your availability by replying to this message. We look forward to meeting you!`;

    const encoded = encodeURIComponent(text);
    return `https://wa.me/91${cleanPhone}?text=${encoded}`;
  };

  // Filtered interviews
  const filteredInterviews = interviews.filter((item) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        item.candidateName.toLowerCase().includes(q) ||
        (item.candidatePosition && item.candidatePosition.toLowerCase().includes(q)) ||
        item.interviewerName.toLowerCase().includes(q) ||
        item.roundName.toLowerCase().includes(q) ||
        item.candidateId.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter !== "All" && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (modeFilter !== "All" && item.mode.toLowerCase() !== modeFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Calculate live KPI stats
  const totalCount = filteredInterviews.length;
  const scheduledCount = filteredInterviews.filter((i) => i.status === "Scheduled").length;
  const passedCount = filteredInterviews.filter((i) => i.status === "Passed").length;
  const onHoldOrFailedCount = filteredInterviews.filter(
    (i) => i.status === "On Hold" || i.status === "Failed" || i.status === "Rescheduled"
  ).length;

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. DATE AGENDA SELECTOR & ACTIONS HEADER */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-xl border border-borderline p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
        {/* Date Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDateFilter(todayStr)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedDateFilter === todayStr
                ? "bg-primary text-white shadow-xs"
                : "bg-canvas border border-borderline text-muted hover:text-navy hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Today's Roster</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedDateFilter === todayStr ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {interviews.filter((i) => i.scheduledDate === todayStr).length}
            </span>
          </button>

          <button
            onClick={() => setSelectedDateFilter(tomorrowStr)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedDateFilter === tomorrowStr
                ? "bg-primary text-white shadow-xs"
                : "bg-canvas border border-borderline text-muted hover:text-navy hover:bg-slate-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Tomorrow</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedDateFilter === tomorrowStr ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {interviews.filter((i) => i.scheduledDate === tomorrowStr).length}
            </span>
          </button>

          <button
            onClick={() => setSelectedDateFilter("all")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              selectedDateFilter === "all"
                ? "bg-primary text-white shadow-xs"
                : "bg-canvas border border-borderline text-muted hover:text-navy hover:bg-slate-100"
            }`}
          >
            <span>All Upcoming & Past</span>
          </button>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-borderline">
            <span className="text-[11px] font-semibold text-muted">Pick Date:</span>
            <input
              type="date"
              value={selectedDateFilter === "all" ? "" : selectedDateFilter}
              onChange={(e) => {
                if (e.target.value) setSelectedDateFilter(e.target.value);
              }}
              className="text-xs bg-canvas border border-borderline rounded-lg px-2.5 py-1.5 text-navy font-medium focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg border border-borderline bg-canvas hover:bg-slate-100 text-muted hover:text-navy transition-colors cursor-pointer"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          <button
            onClick={() => setIsScheduleOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Interview</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 4-KPI SUMMARY WIDGET */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Total */}
        <div className="bg-surface rounded-xl p-4 border border-borderline shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {selectedDateFilter === todayStr
                ? "Today's Agenda"
                : selectedDateFilter === tomorrowStr
                ? "Tomorrow's Agenda"
                : "Filtered Total"}
            </p>
            <p className="text-2xl font-extrabold text-navy mt-1">{totalCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Candidates on schedule</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Scheduled */}
        <div className="bg-surface rounded-xl p-4 border border-borderline shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Scheduled / Ready</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{scheduledCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Pending evaluation</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Passed */}
        <div className="bg-surface rounded-xl p-4 border border-borderline shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Passed & Advanced</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{passedCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Cleared evaluation round</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: On Hold / Needs Review */}
        <div className="bg-surface rounded-xl p-4 border border-borderline shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">On Hold / Dropped</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{onHoldOrFailedCount}</p>
            <p className="text-[11px] text-muted mt-0.5">Under review or hold</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. SEARCH & FILTER BAR */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-xl border border-borderline p-3 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, position, interviewer, or round..."
            className="w-full pl-9 pr-3 py-1.5 bg-canvas border border-borderline rounded-lg text-xs text-navy placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-canvas border border-borderline rounded-lg px-2.5 py-1.5 text-navy font-medium focus:outline-hidden"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Passed">Passed</option>
              <option value="On Hold">On Hold</option>
              <option value="Failed">Failed</option>
              <option value="Rescheduled">Rescheduled</option>
            </select>
          </div>

          {/* Mode Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted">Mode:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="text-xs bg-canvas border border-borderline rounded-lg px-2.5 py-1.5 text-navy font-medium focus:outline-hidden"
            >
              <option value="All">All Modes</option>
              <option value="In-Person">In-Person (Salon)</option>
              <option value="Video Call">Video Call</option>
              <option value="Phone Call">Phone Call</option>
            </select>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. INTERVIEWS ROSTER LIST / CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-surface rounded-xl p-16 border border-borderline shadow-card text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs font-semibold text-muted">Loading today's interview agenda...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto" />
          <p className="text-xs font-bold text-red-800">{error}</p>
          <button
            onClick={() => loadInterviews(selectedDateFilter)}
            className="text-xs font-semibold text-red-700 underline"
          >
            Try Again
          </button>
        </div>
      ) : filteredInterviews.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 border border-borderline shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-navy">No interviews found for this date</h4>
            <p className="text-xs text-muted max-w-sm mx-auto mt-1">
              There are no interview sessions scheduled matching the selected filters. Click "+ Schedule Interview" to book a candidate slot.
            </p>
          </div>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
          >
            + Schedule New Interview
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterviews.map((item) => {
            const isToday = item.scheduledDate === todayStr;
            const waUrl = generateWhatsAppReminder(item);

            return (
              <div
                key={item.id}
                className="bg-surface rounded-xl border border-borderline p-5 shadow-card hover:shadow-md transition-all space-y-4"
              >
                {/* Top Row: Time Slot, Mode, Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderline/60">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Time Slot Pill */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{item.scheduledTime}</span>
                      <span className="text-[10px] text-blue-600 font-medium">
                        ({item.durationMinutes || 45} mins)
                      </span>
                    </div>

                    {/* Mode Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                      {item.mode === "In-Person" ? (
                        <MapPin className="w-3 h-3 text-red-500" />
                      ) : item.mode === "Video Call" ? (
                        <Video className="w-3 h-3 text-purple-500" />
                      ) : (
                        <Phone className="w-3 h-3 text-emerald-500" />
                      )}
                      <span>{item.mode}</span>
                    </div>

                    {/* Location or Meet Link */}
                    {item.locationOrLink && (
                      <span className="text-xs text-muted font-medium truncate max-w-[280px]">
                        📍 {item.locationOrLink}
                      </span>
                    )}

                    {/* Date badge if not viewing today */}
                    {item.scheduledDate !== todayStr && (
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                        {item.scheduledDate}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {item.status === "Scheduled" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3" />
                        <span>Scheduled</span>
                      </span>
                    )}
                    {item.status === "Passed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Passed</span>
                        {item.rating && (
                          <span className="text-amber-500 ml-1">{"★".repeat(item.rating)}</span>
                        )}
                      </span>
                    )}
                    {item.status === "On Hold" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <AlertCircle className="w-3 h-3" />
                        <span>On Hold</span>
                      </span>
                    )}
                    {item.status === "Failed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                    {item.status === "Rescheduled" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                        <RefreshCw className="w-3 h-3" />
                        <span>Rescheduled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Candidate Profile & Round Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Candidate Info (5 cols) */}
                  <div className="md:col-span-5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {item.candidateName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-navy truncate">
                          {item.candidateName}
                        </h4>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {item.candidateId}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                            item.candidateBrand === "alchamae"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.candidateBrand === "alchamae" ? "ALC" : "AHL"}
                        </span>
                      </div>
                      <p className="text-xs text-muted truncate mt-0.5">
                        {item.candidatePosition || "Hair Stylist"}
                        {item.requisitionId && (
                          <span className="ml-1 text-[11px] font-medium text-slate-500">
                            • {item.requisitionId}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{item.candidatePhone}</span>
                        </span>
                        {item.candidateEmail && (
                          <span className="truncate max-w-[150px]">{item.candidateEmail}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interviewer & Round Info (4 cols) */}
                  <div className="md:col-span-4 border-l border-borderline/60 pl-4 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Round:
                      </span>
                      <span className="text-xs font-bold text-navy">{item.roundName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Interviewer:
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {item.interviewerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Stage:
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {item.candidateCurrentStage}
                      </span>
                    </div>
                  </div>

                  {/* HireOS & DISC Psychometrics Widget (3 cols) */}
                  <div className="md:col-span-3 border-l border-borderline/60 pl-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3 text-purple-600" />
                        <span>HireOS & DISC</span>
                      </span>
                      <button
                        onClick={() => setDiscTarget(item)}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Details →
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted">AI Match:</span>
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {item.hireOsScore || 85}%
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-slate-700 truncate" title={item.discProfile}>
                      {item.discProfile || "High I - Influencer"}
                    </div>
                  </div>
                </div>

                {/* Feedback Note if present */}
                {item.feedback && (
                  <div className="bg-canvas rounded-lg p-3 border border-borderline text-xs text-slate-700 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Evaluator Notes & Feedback:
                    </span>
                    <p className="italic">"{item.feedback}"</p>
                  </div>
                )}

                {/* Bottom Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-borderline/60">
                  <div className="flex items-center gap-2">
                    {/* WhatsApp Reminder */}
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Reminder</span>
                    </a>

                    {/* Direct Call */}
                    <a
                      href={`tel:${item.candidatePhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas hover:bg-slate-100 text-slate-700 border border-borderline text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Direct Call</span>
                    </a>

                    {/* View in Pipeline */}
                    {onNavigateToPipeline && (
                      <button
                        onClick={onNavigateToPipeline}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas hover:bg-slate-100 text-slate-700 border border-borderline text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Building className="w-3.5 h-3.5 text-slate-500" />
                        <span>FMS Pipeline</span>
                      </button>
                    )}
                  </div>

                  {/* Log Evaluation Button */}
                  <button
                    onClick={() => {
                      setEvalTarget(item);
                      setEvalOutcome(item.status === "Passed" ? "Passed" : "Passed");
                      setEvalRating(item.rating || 5);
                      setEvalFeedback(item.feedback || "");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>{item.status === "Scheduled" ? "Log Interview Evaluation" : "Update Evaluation"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. LOG EVALUATION MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      {evalTarget && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full border border-borderline shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-borderline">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Evaluation Gate
                </span>
                <h3 className="text-base font-bold text-navy mt-0.5">
                  Interview Evaluation & Outcome
                </h3>
              </div>
              <button
                onClick={() => setEvalTarget(null)}
                className="p-1 rounded-lg hover:bg-canvas text-muted hover:text-navy cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate & Round Summary Card */}
            <div className="bg-canvas rounded-xl p-3 border border-borderline flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-navy">{evalTarget.candidateName}</p>
                <p className="text-muted mt-0.5">
                  {evalTarget.roundName} • Interviewer: {evalTarget.interviewerName}
                </p>
              </div>
              <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                {evalTarget.candidateCurrentStage}
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleLogEvaluationSubmit} className="space-y-4">
              {/* Outcome Selection */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">
                  Interview Decision / Outcome *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setEvalOutcome("Passed")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      evalOutcome === "Passed"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-canvas border-borderline text-muted hover:bg-slate-100"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Passed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalOutcome("On Hold")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      evalOutcome === "On Hold"
                        ? "bg-amber-50 border-amber-500 text-amber-800 shadow-xs"
                        : "bg-canvas border-borderline text-muted hover:bg-slate-100"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>On Hold</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalOutcome("Failed")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      evalOutcome === "Failed"
                        ? "bg-rose-50 border-rose-500 text-rose-800 shadow-xs"
                        : "bg-canvas border-borderline text-muted hover:bg-slate-100"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Failed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalOutcome("Rescheduled")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      evalOutcome === "Rescheduled"
                        ? "bg-purple-50 border-purple-500 text-purple-800 shadow-xs"
                        : "bg-canvas border-borderline text-muted hover:bg-slate-100"
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-purple-600" />
                    <span>Reschedule</span>
                  </button>
                </div>
              </div>

              {/* Star Rating */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">
                  Performance & Skill Rating (1 - 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setEvalRating(star)}
                      className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= evalRating
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-300 stroke-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">
                    {evalRating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Feedback Notes */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Interviewer Feedback & Notes
                </label>
                <textarea
                  rows={3}
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  placeholder="Detail candidate technical strengths, salon etiquette, scissor technique, salary discussions, or rejection reasons..."
                  className="w-full text-xs p-2.5 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Auto Advance Checkbox */}
              {evalOutcome === "Passed" && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoAdvance"
                    checked={evalAutoAdvance}
                    onChange={(e) => setEvalAutoAdvance(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="autoAdvance" className="text-xs font-semibold text-emerald-900 cursor-pointer">
                    Automatically advance candidate to next FMS Pipeline stage
                    <span className="block text-[11px] text-emerald-700 font-normal mt-0.5">
                      Advances candidate forward, stamps completion date, and schedules next stage SLA deadline.
                    </span>
                  </label>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvalTarget(null)}
                  className="px-4 py-2 rounded-lg border border-borderline bg-canvas text-xs font-semibold text-muted hover:text-navy cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={evalSubmitting}
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {evalSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Submit Evaluation & Update Stage</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 6. SCHEDULE INTERVIEW MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full border border-borderline shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-borderline">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Recruiter Cockpit
                </span>
                <h3 className="text-base font-bold text-navy mt-0.5">
                  Schedule New Candidate Interview
                </h3>
              </div>
              <button
                onClick={() => setIsScheduleOpen(false)}
                className="p-1 rounded-lg hover:bg-canvas text-muted hover:text-navy cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleScheduleSubmit} className="space-y-3.5">
              {/* Select Candidate */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Candidate *
                </label>
                <select
                  value={schedCandidateId}
                  onChange={(e) => setSchedCandidateId(e.target.value)}
                  className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-hidden"
                  required
                >
                  {candidatesList.length === 0 ? (
                    <option value="">No active candidates available</option>
                  ) : (
                    candidatesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.id}) — {c.position || "Stylist"} [{c.currentStage}]
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Round Name */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Interview Round *
                </label>
                <select
                  value={schedRoundName}
                  onChange={(e) => setSchedRoundName(e.target.value)}
                  className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-hidden"
                >
                  <option value="Initial Screening Call">Round 1: Initial Screening Call</option>
                  <option value="Salon Practical Demo & Cut Trial">Round 2: Salon Practical Demo & Cut Trial</option>
                  <option value="Technical Hair & Extensions Assessment">Round 3: Technical Hair & Extensions Assessment</option>
                  <option value="HR Culture & Values Alignment">Round 4: HR Culture & Values Alignment</option>
                  <option value="Founder Final Round">Round 5: Founder Final Round</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Time Slot *
                  </label>
                  <input
                    type="text"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Mode & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Interview Mode *
                  </label>
                  <select
                    value={schedMode}
                    onChange={(e) =>
                      setSchedMode(e.target.value as "In-Person" | "Video Call" | "Phone Call")
                    }
                    className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-hidden"
                  >
                    <option value="In-Person">In-Person (Salon Station)</option>
                    <option value="Video Call">Video Call (Google Meet)</option>
                    <option value="Phone Call">Phone Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Duration (Minutes)
                  </label>
                  <select
                    value={schedDuration}
                    onChange={(e) => setSchedDuration(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-hidden"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Interviewer Name */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Interviewer Name *
                </label>
                <input
                  type="text"
                  value={schedInterviewer}
                  onChange={(e) => setSchedInterviewer(e.target.value)}
                  placeholder="e.g. Vikram Mehta (Creative Director)"
                  className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-hidden"
                  required
                />
              </div>

              {/* Location or Meeting Link */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Location / Meeting Link
                </label>
                <input
                  type="text"
                  value={schedLocation}
                  onChange={(e) => setSchedLocation(e.target.value)}
                  placeholder="e.g. Bandra Flagship Salon - Station 2 or meet.google.com/..."
                  className="w-full text-xs p-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-hidden"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 rounded-lg border border-borderline bg-canvas text-xs font-semibold text-muted hover:text-navy cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedSubmitting}
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {schedSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Book Interview Slot</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 7. HIREOS AI & DISC PSYCHOMETRICS MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      {discTarget && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full border border-borderline shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-borderline">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy">HireOS & DISC Analysis</h3>
                  <p className="text-[11px] text-muted">{discTarget.candidateName}</p>
                </div>
              </div>
              <button
                onClick={() => setDiscTarget(null)}
                className="p-1 rounded-lg hover:bg-canvas text-muted hover:text-navy cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Fit Score */}
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                  AI Fit & Competency Score
                </p>
                <p className="text-2xl font-black text-purple-950 mt-1">
                  {discTarget.hireOsScore || 85} / 100
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Proctored assessment of hair craft, consultation, and salon etiquette
                </p>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-purple-600 flex items-center justify-center font-black text-purple-800 text-sm bg-white">
                {discTarget.hireOsScore || 85}%
              </div>
            </div>

            {/* DISC Profile Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Personality & Behavioral Alignment:
              </span>
              <div className="bg-canvas rounded-xl p-3 border border-borderline space-y-1.5">
                <p className="text-xs font-bold text-navy">
                  🎯 {discTarget.discProfile || "High I - Influencer / People-Centric"}
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {discTarget.discProfile?.includes("High D")
                    ? "Dominant & Results-Oriented: Thrives under high-volume appointments, decisive in client transformations, ideal for lead stylist or salon manager track."
                    : discTarget.discProfile?.includes("High I")
                    ? "High Influence & Charisma: Natural rapport builder, excels at client consultations, retail product upsells, and team camaraderie."
                    : discTarget.discProfile?.includes("High S")
                    ? "Steadiness & Patience: Extremely consistent technique, loyal team player, exceptional patient handling for intricate bridal and hair extension work."
                    : "Conscientious & Precise: Meticulous color formulation accuracy, strict hygiene compliance, and rigorous attention to styling perfection."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDiscTarget(null)}
              className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
