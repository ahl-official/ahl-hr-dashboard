"use client";

import React, { useState, useEffect } from "react";
import {
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  Eye,
  MessageCircle,
  FileText,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Send,
  X,
  Clock,
  UserCheck,
} from "lucide-react";
import { EmployeeBranch, BehaviourSignal, BirdsEyeSummary } from "@/types/behaviour-tracker";

export function BirdsEyeDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("2026-11");
  const [summary, setSummary] = useState<BirdsEyeSummary | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("hrms_birds_eye_2026-11");
        return cached ? JSON.parse(cached) : null;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "grey" | "red" | "green">("all");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Hazri Box sync state
  const [syncingHazri, setSyncingHazri] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [activeDossierBranch, setActiveDossierBranch] = useState<EmployeeBranch | null>(null);
  const [hrNotes, setHrNotes] = useState("");
  const [submittingHrTalk, setSubmittingHrTalk] = useState(false);

  const [activeWhatsAppBranch, setActiveWhatsAppBranch] = useState<EmployeeBranch | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Fetch Bird's Eye Data
  const loadSummary = async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/behaviour/birds-eye?month=${month}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`hrms_birds_eye_${month}`, JSON.stringify(json.data));
          } catch {}
        }
      }
    } catch (e) {
      console.error("Failed to load bird's-eye view", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`hrms_birds_eye_${selectedMonth}`);
        if (cached) {
          setSummary(JSON.parse(cached));
        }
      } catch {}
    }
    loadSummary(selectedMonth);
  }, [selectedMonth]);

  // Sync Hazri Box
  const handleSyncHazri = async () => {
    setSyncingHazri(true);
    setSyncMessage(null);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const res = await fetch("/api/hazri/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`Synced ${data.totalEmployees} employees from Hazri Box.`);
        await loadSummary(selectedMonth);
      } else {
        setSyncMessage(`Sync error: ${data.error}`);
      }
    } catch (e: any) {
      setSyncMessage(`Sync failed: ${e.message}`);
    } finally {
      setSyncingHazri(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Submit HR Talk notes
  const handleSaveHrTalk = async () => {
    if (!activeDossierBranch || !hrNotes.trim()) return;
    setSubmittingHrTalk(true);
    try {
      const res = await fetch(`/api/behaviour/branches/${activeDossierBranch.id}/hr-talk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: hrNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveDossierBranch(null);
        setHrNotes("");
        await loadSummary(selectedMonth);
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingHrTalk(false);
    }
  };

  // Send WhatsApp Monthly Report (Strict 1 msg/month)
  const handleSendWhatsApp = async () => {
    if (!activeWhatsAppBranch) return;
    setSendingWhatsApp(true);
    try {
      const res = await fetch(`/api/behaviour/branches/${activeWhatsAppBranch.id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setActiveWhatsAppBranch(null);
        await loadSummary(selectedMonth);
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const allBranches = summary
    ? [...summary.branches.red, ...summary.branches.grey, ...summary.branches.green]
    : [];

  const filteredBranches = allBranches.filter((b) => {
    if (activeTab === "grey" && b.color !== "grey") return false;
    if (activeTab === "red" && b.color !== "red") return false;
    if (activeTab === "green" && b.color !== "green") return false;
    if (departmentFilter !== "all" && b.department !== departmentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.employeeName.toLowerCase().includes(q) ||
        b.employeeId.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const departments = [...new Set(allBranches.map((b) => b.department))];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-surface rounded-2xl border border-borderline shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                <GitBranch className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
                Employee Behaviour-Pattern Tracker (Bird’s-Eye View)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
              Monitors attendance anomalies, late arrivals (≥ 6 late marks threshold), Monday/Friday leaves, and conduct red flags. Built for HR Operations and Vinitt sir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Picker */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="2026-11">November 2026</option>
                <option value="2026-10">October 2026</option>
                <option value="2026-09">September 2026</option>
              </select>
            </div>

            {/* Hazri Box Sync Button */}
            <button
              onClick={handleSyncHazri}
              disabled={syncingHazri}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingHazri ? "animate-spin" : ""}`} />
              <span>{syncingHazri ? "Syncing..." : "Sync Hazri Box"}</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
            {syncMessage}
          </div>
        )}

        {/* 3 Status KPI Cards (Bird's Eye Overview) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Monitored
              </span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {summary?.totalWatched || 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-200 text-slate-700">
              <GitBranch className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab("grey")}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeTab === "grey"
                ? "bg-slate-200/80 border-slate-400 ring-2 ring-slate-400 shadow-sm"
                : "bg-slate-100/70 border-slate-300 hover:bg-slate-200/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  Grey (Watching)
                </span>
                <div className="text-2xl font-black text-slate-800 mt-0.5">
                  {summary?.greyCount || 0}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-300 text-slate-700">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">New pattern detected · Under HR observation</p>
          </div>

          <div
            onClick={() => setActiveTab("red")}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeTab === "red"
                ? "bg-rose-100 border-rose-400 ring-2 ring-rose-400 shadow-sm"
                : "bg-rose-50 border-rose-200 hover:bg-rose-100/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  Red (Repeat / Critical)
                </span>
                <div className="text-2xl font-black text-rose-950 mt-0.5">
                  {summary?.redCount || 0}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-200 text-rose-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-rose-600 mt-2">Did not improve in Month 2 · Immediate talk required</p>
          </div>

          <div
            onClick={() => setActiveTab("green")}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeTab === "green"
                ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400 shadow-sm"
                : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Green (Improved / Closed)
                </span>
                <div className="text-2xl font-black text-emerald-950 mt-0.5">
                  {summary?.greenCount || 0}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[10px] text-emerald-600 mt-2">Punctuality improved · Branch closed</p>
          </div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-borderline shadow-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "all" ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All ({allBranches.length})
          </button>
          <button
            onClick={() => setActiveTab("grey")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "grey" ? "bg-slate-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Grey Watching ({summary?.greyCount || 0})
          </button>
          <button
            onClick={() => setActiveTab("red")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "red" ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-50"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Red Escalation ({summary?.redCount || 0})
          </button>
          <button
            onClick={() => setActiveTab("green")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "green" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Green Closed ({summary?.greenCount || 0})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-borderline bg-surface text-xs text-navy-DEFAULT focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-borderline bg-surface text-xs text-slate-700 font-medium outline-none cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branches List */}
      {loading && !summary ? (
        <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
          Loading behaviour branches & syncing live punches...
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-borderline p-10 text-center text-slate-500 text-xs">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Syncing live Hazri Box attendance...
            </div>
          ) : (
            `No employee branches found matching the current filters for ${selectedMonth}.`
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => {
            const isGrey = branch.color === "grey";
            const isRed = branch.color === "red";
            const isGreen = branch.color === "green";

            const cardBorder = isRed
              ? "border-rose-300 bg-rose-50/30"
              : isGreen
              ? "border-emerald-300 bg-emerald-50/30"
              : "border-slate-300 bg-slate-50/50";

            const badgeStyle = isRed
              ? "bg-rose-100 text-rose-800 border-rose-300"
              : isGreen
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-slate-200 text-slate-800 border-slate-300";

            return (
              <div
                key={branch.id}
                className={`rounded-2xl border ${cardBorder} p-5 bg-surface shadow-xs flex flex-col justify-between transition hover:shadow-md space-y-4`}
              >
                <div>
                  {/* Top Bar: Name & Branch Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-navy-950 tracking-tight">
                        {branch.employeeName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {branch.employeeId} · {branch.department}
                      </p>
                      <p className="text-[11px] text-indigo-600 font-medium">{branch.company}</p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${badgeStyle}`}
                    >
                      {isRed && <AlertTriangle className="w-3 h-3 text-rose-700" />}
                      {isGreen && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                      {isGrey && <Eye className="w-3 h-3 text-slate-700" />}
                      {branch.color} · {branch.status}
                    </span>
                  </div>

                  {/* Signals List */}
                  <div className="mt-3.5 space-y-2">
                    {branch.signals.length === 0 ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>All attendance & conduct goals met. Branch closed.</span>
                      </div>
                    ) : (
                      branch.signals.map((sig, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                            <span className="flex items-center gap-1">
                              {sig.type === "late_marks" && "⏰"}
                              {sig.type === "mon_fri_leave" && "🏖️"}
                              {sig.type === "holiday_bridge_leave" && "🗓️"}
                              {sig.type === "hr_conduct_issue" && "🚩"}
                              {sig.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              {sig.occurrences}x
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{sig.description}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* HR Talk Status */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">HR Talk Status:</span>
                    {branch.hrTalkCompleted ? (
                      <span className="font-semibold text-emerald-700 flex items-center gap-1 text-[11px]">
                        <UserCheck className="w-3.5 h-3.5" />
                        Done on {branch.hrTalkDate || "Yes"}
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-700 flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Follow-Up
                      </span>
                    )}
                  </div>

                  {/* WhatsApp Status (Strict 1 msg/month) */}
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">Monthly WhatsApp:</span>
                    {branch.whatsappSentAt ? (
                      <span className="font-semibold text-indigo-700 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        Sent {branch.whatsappSentAt.slice(0, 10)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Not Dispatched</span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setActiveDossierBranch(branch);
                      setHrNotes(branch.hrTalkNotes || "");
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>HR Dossier</span>
                  </button>

                  <button
                    onClick={() => setActiveWhatsAppBranch(branch)}
                    disabled={Boolean(branch.whatsappSentAt)}
                    title={
                      branch.whatsappSentAt
                        ? "Already dispatched for this month (1 message/month policy)."
                        : "Send Monthly WhatsApp Report"
                    }
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${
                      branch.whatsappSentAt
                        ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{branch.whatsappSentAt ? "Report Sent" : "Send WhatsApp"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: HR Dossier & Discussion Notes Modal */}
      {activeDossierBranch && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-borderline shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-borderline pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-navy-950">
                  HR Dossier: {activeDossierBranch.employeeName}
                </h3>
              </div>
              <button
                onClick={() => setActiveDossierBranch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">Branch Status:</div>
                <div className="text-slate-700">
                  {activeDossierBranch.color.toUpperCase()} (
                  {activeDossierBranch.status.toUpperCase()}) — {activeDossierBranch.month}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  HR 1-on-1 Conversation Notes:
                </label>
                <textarea
                  rows={4}
                  value={hrNotes}
                  onChange={(e) => setHrNotes(e.target.value)}
                  placeholder="Record what was discussed with the employee, reasons for late punches, and agreed commitments..."
                  className="w-full p-3 rounded-xl border border-borderline bg-surface text-xs text-navy-DEFAULT focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-borderline">
              <button
                onClick={() => setActiveDossierBranch(null)}
                className="px-3.5 py-1.5 rounded-xl border border-borderline text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHrTalk}
                disabled={submittingHrTalk || !hrNotes.trim()}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {submittingHrTalk ? "Saving..." : "Save & Complete HR Talk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirm Send Monthly WhatsApp Modal */}
      {activeWhatsAppBranch && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-borderline shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-borderline pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-navy-950">Confirm WhatsApp Dispatch</h3>
              </div>
              <button
                onClick={() => setActiveWhatsAppBranch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are about to dispatch the <strong>Monthly Behaviour Report</strong> to{" "}
              <strong>{activeWhatsAppBranch.employeeName}</strong> ({activeWhatsAppBranch.phone}).
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              ⚠️ <strong>Strict Policy Guard</strong>: Per Task 3 requirements, only{" "}
              <strong>ONE WhatsApp message</strong> may be sent per employee per month. Once sent, no second message can be triggered.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-borderline">
              <button
                onClick={() => setActiveWhatsAppBranch(null)}
                className="px-3.5 py-1.5 rounded-xl border border-borderline text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingWhatsApp ? "Sending..." : "Confirm & Send"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
