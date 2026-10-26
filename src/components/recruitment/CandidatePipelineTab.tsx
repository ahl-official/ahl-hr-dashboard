"use client";

import React, { useState, useEffect } from "react";
import {
  GitFork,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
  Users,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  MessageSquare,
  Phone,
  ArrowRight,
  UserCheck,
  UserX,
  FileCheck,
  Award,
  AlertTriangle,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  Edit3,
  Send,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import type { FmsCandidate, FmsRequisition, FmsStageMeta } from "@/types/fms";
import { FMS_CANDIDATE_STAGES } from "@/types/fms";
import { calculateFmsDelay, getNextStagePlannedDate, normalizeFmsPhone } from "@/lib/fms-rules";
import Link from "next/navigation";

interface CandidatePipelineTabProps {
  initialRequisitionId?: string;
  onNavigateToApplications?: () => void;
  onNavigateToRequisitions?: () => void;
}

export default function CandidatePipelineTab({
  initialRequisitionId,
  onNavigateToApplications,
  onNavigateToRequisitions,
}: CandidatePipelineTabProps) {
  const [candidates, setCandidates] = useState<FmsCandidate[]>([]);
  const [requisitions, setRequisitions] = useState<FmsRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Views
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [reqFilter, setReqFilter] = useState<string>(initialRequisitionId || "All");
  const [slaFilter, setSlaFilter] = useState<"All" | "Delayed" | "DueToday" | "OnTrack" | "Dropped">("All");
  const [brandFilter, setBrandFilter] = useState<string>("All");

  // Selected Candidate for Stage Drawer
  const [selectedCand, setSelectedCand] = useState<FmsCandidate | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const [customTargetDate, setCustomTargetDate] = useState("");
  const [fieldFormValues, setFieldFormValues] = useState<Record<string, any>>({});
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState("");

  // Drop Modal
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const [dropReason, setDropReason] = useState("Salary expectations mismatch");
  const [dropping, setDropping] = useState(false);

  // Edit Candidate Modal State (in each stage)
  const [editingCandidate, setEditingCandidate] = useState<FmsCandidate | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Direct Add to Employees Modal State (from last stage)
  const [onboardCand, setOnboardCand] = useState<FmsCandidate | null>(null);
  const [onboardForm, setOnboardForm] = useState({
    name: "",
    mobile: "",
    company: "American Hairlines",
    department: "Operations",
    designation: "",
    manager: "HR Operations",
    doj: new Date().toISOString().slice(0, 10),
    mode: "link" as "link" | "device",
  });
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardResult, setOnboardResult] = useState<{
    url: string;
    token?: string;
    sent: boolean;
    sendError?: string;
  } | null>(null);
  const [onboardCopied, setOnboardCopied] = useState(false);
  const [departments, setDepartments] = useState<string[]>([
    "Hair Styling & Technical",
    "Trichology & Clinical",
    "Sales & Consultation",
    "Front Desk & Client Relations",
    "Operations",
    "Finance & Admin",
    "Marketing",
  ]);

  // Fetch candidates and requisitions
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [candRes, reqRes] = await Promise.all([
        fetch(isRefresh ? "/api/recruitment/candidates-fms?refresh=true" : "/api/recruitment/candidates-fms"),
        fetch("/api/recruitment/requisitions"),
      ]);

      const candJson = await candRes.json();
      const reqJson = await reqRes.json();

      if (candJson.success && candJson.data) {
        setCandidates(candJson.data.candidates || []);
      } else {
        setError(candJson.message || "Failed to load candidates");
      }

      if (reqJson.success && reqJson.data) {
        setRequisitions(reqJson.data.requisitions || []);
      }
    } catch (err: any) {
      setError("Network error loading pipeline data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync initialRequisitionId
  useEffect(() => {
    if (initialRequisitionId) {
      setReqFilter(initialRequisitionId);
    }
  }, [initialRequisitionId]);

  // Helper: map candidate currentStage name or id to StageMeta
  const getStageMeta = (stageNameOrId: string): FmsStageMeta => {
    const raw = (stageNameOrId || "").toLowerCase().trim();
    if (raw === "pre-screening" || raw === "interview updates" || raw === "ps") {
      const ps = FMS_CANDIDATE_STAGES.find((s) => s.id === "ps");
      if (ps) return ps;
    }
    const found = FMS_CANDIDATE_STAGES.find(
      (s) =>
        s.name.toLowerCase() === raw ||
        s.id.toLowerCase() === raw
    );
    return found || FMS_CANDIDATE_STAGES[0];
  };

  // Helper: get delay info for candidate's current stage
  const getCandidateDelay = (c: FmsCandidate) => {
    const meta = getStageMeta(c.currentStage);
    const stageTrack = c.stages?.[meta.id];
    const planned = stageTrack?.plannedDate || c.stageData?.[meta.id]?.plannedDate;
    const actual = stageTrack?.actualDate || c.stageData?.[meta.id]?.actualDate;
    return calculateFmsDelay(planned, actual);
  };

  // Open Stage Drawer
  const handleOpenDrawer = (cand: FmsCandidate) => {
    setSelectedCand(cand);
    setAdvanceError("");
    const meta = getStageMeta(cand.currentStage);
    const curIdx = FMS_CANDIDATE_STAGES.findIndex((s) => s.id === meta.id);
    const nextMeta = FMS_CANDIDATE_STAGES[curIdx + 1];

    if (nextMeta) {
      setCustomTargetDate(getNextStagePlannedDate(new Date(), nextMeta.weeks));
    } else {
      setCustomTargetDate("");
    }

    // Prepopulate existing field values
    const existing = cand.stages?.[meta.id]?.fieldValues || cand.stageData?.[meta.id] || {};
    setFieldFormValues({ ...existing });
  };

  // Update Application Status for Stage 1 (Application Received) candidates
  const handleUpdateApplicationStatus = async (candidateId: string, newStatus: string) => {
    try {
      const updates: any = { applicationStatus: newStatus };
      if (newStatus === "Dropped") {
        updates.status = "Dropped";
        updates.interviewStatus = "Dropped";
        updates.archived = true;
        updates.archiveReason = "Dropped at Application Received stage";
      } else if (newStatus === "Interview Scheduled") {
        updates.interviewStatus = "Scheduled";
      }

      // Optimistic UI update
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, ...updates, updatedAt: new Date().toISOString().slice(0, 10) }
            : c
        )
      );
      if (selectedCand && selectedCand.id === candidateId) {
        setSelectedCand((prev) => (prev ? { ...prev, ...updates } : null));
      }

      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidateId,
          updates,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update application status");
      }
    } catch (err: any) {
      console.error("Status update error:", err);
      alert("Error updating status: " + err.message);
      loadData(false);
    }
  };

  // Update Interview Update Status & Rescheduling info for Stage 2 (Interview Updates) candidates
  const handleUpdateInterviewUpdate = async (
    candidateId: string,
    fields: {
      interviewUpdateStatus?: string;
      rescheduledDate?: string;
      rescheduledStatus?: string;
    }
  ) => {
    try {
      const updates: any = { ...fields };
      if (fields.interviewUpdateStatus === "Hired" || fields.rescheduledStatus === "Hired") {
        updates.interviewStatus = "Passed";
      } else if (fields.interviewUpdateStatus === "Not Hired" || fields.rescheduledStatus === "Not Hired") {
        updates.interviewStatus = "Failed";
      } else if (fields.interviewUpdateStatus === "Didn't Come for Interview" || fields.rescheduledStatus === "Didn't Come for Interview") {
        updates.interviewStatus = "Cancelled";
      } else if (fields.interviewUpdateStatus === "Rescheduled") {
        updates.interviewStatus = "Rescheduled";
      }

      // Optimistic UI update
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, ...updates, updatedAt: new Date().toISOString().slice(0, 10) }
            : c
        )
      );
      if (selectedCand && selectedCand.id === candidateId) {
        setSelectedCand((prev) => (prev ? { ...prev, ...updates } : null));
      }

      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidateId,
          updates,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update interview update");
      }
    } catch (err: any) {
      console.error("Interview update error:", err);
      alert("Error updating interview update: " + err.message);
      loadData(false);
    }
  };

  // Advance Candidate Stage
  const handleAdvanceStage = async () => {
    if (!selectedCand) return;
    setAdvancing(true);
    setAdvanceError("");

    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advance",
          id: selectedCand.id,
          fieldUpdates: fieldFormValues,
          customNextPlannedDate: customTargetDate || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCandidates((prev) => prev.map((c) => (c.id === selectedCand.id ? json.data : c)));
        setSelectedCand(json.data);
        handleOpenDrawer(json.data);
      } else {
        setAdvanceError(json.message || "Failed to advance stage");
      }
    } catch (err: any) {
      setAdvanceError(err.message || "Network error advancing candidate");
    } finally {
      setAdvancing(false);
    }
  };

  // Revert Candidate to Previous Stage
  const handleRevertStage = async (candidateId?: string) => {
    const cand = candidateId ? candidates.find((c) => c.id === candidateId) : selectedCand;
    if (!cand) return;
    const meta = getStageMeta(cand.currentStage);
    const curIdx = FMS_CANDIDATE_STAGES.findIndex((s) => s.id === meta.id);
    if (curIdx <= 0) {
      alert("Candidate is already at the first stage (Application Review).");
      return;
    }
    const prevMeta = FMS_CANDIDATE_STAGES[curIdx - 1];

    if (!window.confirm(`Revert ${cand.fullName} back to "${prevMeta.name}"?`)) {
      return;
    }

    setReverting(true);
    setRevertError("");
    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revert",
          id: cand.id,
          reason: "Reverted by user",
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCandidates((prev) => prev.map((c) => (c.id === cand.id ? json.data : c)));
        if (selectedCand?.id === cand.id) {
          setSelectedCand(json.data);
          handleOpenDrawer(json.data);
        }
      } else {
        const msg = json.message || "Failed to revert candidate";
        setRevertError(msg);
        alert(msg);
      }
    } catch (err: any) {
      const msg = err.message || "Network error reverting candidate";
      setRevertError(msg);
      alert(msg);
    } finally {
      setReverting(false);
    }
  };

  // Drop Candidate
  const handleDropCandidate = async () => {
    if (!selectedCand) return;
    setDropping(true);

    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "drop",
          id: selectedCand.id,
          reason: dropReason,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCandidates((prev) => prev.map((c) => (c.id === selectedCand.id ? json.data : c)));
        setSelectedCand(json.data);
        setIsDropModalOpen(false);
      }
    } catch (err) {
      console.error("Drop failed:", err);
    } finally {
      setDropping(false);
    }
  };

  // Restore Candidate
  const handleRestoreCandidate = async () => {
    if (!selectedCand) return;
    setDropping(true);

    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          id: selectedCand.id,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCandidates((prev) => prev.map((c) => (c.id === selectedCand.id ? json.data : c)));
        setSelectedCand(json.data);
      }
    } catch (err) {
      console.error("Restore failed:", err);
    } finally {
      setDropping(false);
    }
  };

  // Open Direct Add to Employees Modal (Stage 6)
  const handleOpenAddEmployee = (cand: FmsCandidate) => {
    setOnboardCand(cand);
    setOnboardError("");
    setOnboardResult(null);
    setOnboardCopied(false);

    const req = requisitions.find((r) => r.id === cand.requisitionId);
    const brandCompany =
      cand.brand === "alchamae" ? "Alchamae" : "American Hairlines";
    const joDate =
      cand.stageData?.jo?.joiningDate ||
      new Date().toISOString().slice(0, 10);

    setOnboardForm({
      name: cand.fullName || "",
      mobile: normalizeFmsPhone(cand.phone || ""),
      company: brandCompany,
      department: req?.department || "Operations",
      designation: cand.position || req?.jobTitle || "Senior Hair Stylist",
      manager: req?.hiringManager || "HR Operations",
      doj: joDate,
      mode: "link",
    });
  };

  // Submit Direct Add to Employees
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardCand) return;
    setOnboardSubmitting(true);
    setOnboardError("");

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardForm),
      });

      const d = await res.json();
      if (!res.ok || !d.success) {
        throw new Error(d.error || "Failed to create employee onboarding invitation");
      }

      if (onboardForm.mode === "device") {
        window.location.href = `/join/${d.data.token}?device=1`;
        return;
      }

      // Mark candidate as Onboarded / Hired
      await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: onboardCand.id,
          updates: {
            status: "Onboarded",
            interviewStatus: "Passed",
            currentStage: "Onboarding",
          },
        }),
      });

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === onboardCand.id
            ? { ...c, status: "Onboarded", interviewStatus: "Passed", currentStage: "Onboarding" }
            : c
        )
      );
      if (selectedCand && selectedCand.id === onboardCand.id) {
        setSelectedCand((prev) =>
          prev ? { ...prev, status: "Onboarded", interviewStatus: "Passed", currentStage: "Onboarding" } : null
        );
      }

      setOnboardResult(d.data);
    } catch (err: any) {
      setOnboardError(err.message || "Failed to add employee");
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Open Edit Candidate Modal (in each stage)
  const handleOpenEditCandidate = (cand: FmsCandidate) => {
    setEditingCandidate(cand);
    setEditError("");
    setEditForm({
      fullName: cand.fullName || "",
      phone: cand.phone || "",
      email: cand.email || "",
      position: cand.position || "",
      brand: cand.brand || "ahl",
      requisitionId: cand.requisitionId || "",
      currentStage: cand.currentStage || "Application Received",
      status: cand.status || "Active",
      experience: cand.experience || "",
      currentCompany: cand.currentCompany || "",
      currentSalary: cand.currentSalary || "",
      expectedSalary: cand.expectedSalary || "",
      noticePeriod: cand.noticePeriod || "",
      source: cand.source || "Direct Intake",
      skills: cand.skills || "",
      resumeLink: cand.resumeLink || "",
      notes: cand.notes || "",
    });
  };

  // Save Edit Candidate
  const handleSaveEditCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;
    setEditSubmitting(true);
    setEditError("");

    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCandidate.id,
          updates: editForm,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update candidate details");
      }

      setCandidates((prev) =>
        prev.map((c) => (c.id === editingCandidate.id ? json.data : c))
      );
      if (selectedCand && selectedCand.id === editingCandidate.id) {
        setSelectedCand(json.data);
      }
      setEditingCandidate(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to save candidate changes");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Filter candidates
  const filtered = candidates.filter((c) => {
    const isDropped = c.status.toLowerCase() === "dropped" || c.archived;
    if (slaFilter === "Dropped") {
      if (!isDropped) return false;
    } else {
      // Don't show dropped in normal filters unless chosen
      if (isDropped) return false;

      const delay = getCandidateDelay(c);
      if (slaFilter === "Delayed" && delay <= 0) return false;
      if (slaFilter === "DueToday" && delay !== 0) return false;
      if (slaFilter === "OnTrack" && delay > 0) return false;
    }

    if (reqFilter !== "All" && c.requisitionId !== reqFilter) return false;
    if (brandFilter !== "All") {
      const b = (c.brand || "ahl").toLowerCase();
      if (brandFilter === "ahl" && b !== "ahl") return false;
      if (brandFilter === "alchamae" && b !== "alchamae") return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        c.fullName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.position && c.position.toLowerCase().includes(q)) ||
        (c.requisitionId && c.requisitionId.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // KPI Calculations
  const activeCandidates = candidates.filter((c) => !c.archived && c.status.toLowerCase() !== "dropped");
  const delayedCount = activeCandidates.filter((c) => getCandidateDelay(c) > 0).length;
  const dueTodayCount = activeCandidates.filter((c) => getCandidateDelay(c) === 0).length;
  const onTrackCount = activeCandidates.filter((c) => getCandidateDelay(c) <= 0).length;
  const hiredCount = candidates.filter(
    (c) => c.status.toLowerCase() === "hired" || c.status.toLowerCase() === "onboarded"
  ).length;

  return (
    <div className="space-y-3.5">
      {/* ────────────────────────────────────────────────────────── */}
      {/* REQUISITION FILTER BANNER */}
      {/* ────────────────────────────────────────────────────────── */}
      {reqFilter !== "All" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary shrink-0" />
            <span>
              Pipeline focused on requisition{" "}
              <strong className="font-mono font-bold text-primary">{reqFilter}</strong>
              {requisitions.find((r) => r.id === reqFilter) && (
                <span> ({requisitions.find((r) => r.id === reqFilter)?.jobTitle})</span>
              )}
            </span>
          </div>
          <button
            onClick={() => setReqFilter("All")}
            className="text-primary hover:text-navy font-semibold underline text-xs cursor-pointer"
          >
            Show All Requisitions
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP KPI CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Active Pipeline */}
        <div className="bg-surface rounded-xl p-3 px-4 border border-borderline shadow-2xs hover:border-primary/40 transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              Active Pipeline
            </span>
            <div className="text-xl font-bold text-navy mt-0.5">{activeCandidates.length}</div>
            <span className="text-[10px] text-muted block mt-0.5">In 6 FMS stages</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-primary flex items-center justify-center shrink-0">
            <GitFork className="w-4 h-4" />
          </div>
        </div>

        {/* SLA Overdue / Delayed */}
        <div className="bg-surface rounded-xl p-3 px-4 border border-borderline shadow-2xs hover:border-primary/40 transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              SLA Overdue
            </span>
            <div className="text-xl font-bold text-rose-600 mt-0.5">{delayedCount}</div>
            <span className="text-[10px] text-muted block mt-0.5">Past target SLA date</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Due Today */}
        <div className="bg-surface rounded-xl p-3 px-4 border border-borderline shadow-2xs hover:border-primary/40 transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              Due Today
            </span>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{dueTodayCount}</div>
            <span className="text-[10px] text-muted block mt-0.5">Scheduled for today</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Onboarded / Hired */}
        <div className="bg-surface rounded-xl p-3 px-4 border border-borderline shadow-2xs hover:border-primary/40 transition-all flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              Hired & Onboarded
            </span>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{hiredCount}</div>
            <span className="text-[10px] text-muted block mt-0.5">Completed lifecycle</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* FILTER & ACTIONS BAR */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-xl p-4 border border-borderline shadow-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, phone, role, req ID..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns & Views */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Requisition Filter */}
          <select
            value={reqFilter}
            onChange={(e) => setReqFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px] truncate"
          >
            <option value="All">All Requisitions</option>
            {requisitions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}: {r.jobTitle}
              </option>
            ))}
          </select>

          {/* SLA Health Filter */}
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value as any)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All SLA Statuses</option>
            <option value="Delayed">🔴 Delayed / Overdue</option>
            <option value="DueToday">🟡 Due Today</option>
            <option value="OnTrack">🟢 On Track</option>
            <option value="Dropped">⚪ Dropped / Archived</option>
          </select>

          {/* Brand Filter */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Brands</option>
            <option value="ahl">American Hairline</option>
            <option value="alchamae">Alchemane</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-canvas p-1 rounded-lg border border-borderline">
            <button
              onClick={() => setViewMode("kanban")}
              title="Kanban Board View"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-surface text-primary shadow-xs font-semibold"
                  : "text-muted hover:text-navy"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-surface text-primary shadow-xs font-semibold"
                  : "text-muted hover:text-navy"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh Pipeline"
            className="p-2 text-muted hover:text-primary hover:bg-canvas rounded-lg border border-borderline transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Intake New Candidate */}
          {onNavigateToApplications && (
            <button
              onClick={onNavigateToApplications}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 transition-all cursor-pointer"
            >
              <span>+ Add Candidate</span>
            </button>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* LOADING & ERROR STATES */}
      {/* ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-surface rounded-xl p-12 border border-borderline shadow-card flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-semibold text-navy">Loading Candidate FMS Pipeline...</p>
          <p className="text-xs text-muted mt-1">Calculating SLA turnaround delays and stage gates</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => loadData(false)}
            className="mt-3 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* KANBAN BOARD VIEW (3 STAGES PER ROW × 2 ROWS, FIXED SIZE) */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full">
          {FMS_CANDIDATE_STAGES.map((stage) => {
            const stageCandidates = filtered.filter((c) => {
              const meta = getStageMeta(c.currentStage);
              return meta.id === stage.id;
            });

            return (
              <div
                key={stage.id}
                className="bg-slate-50/80 rounded-xl border border-borderline flex flex-col shadow-2xs overflow-hidden"
                style={{
                  height: "360px",
                  minHeight: "360px",
                  maxHeight: "360px",
                }}
              >
                {/* Column Header (Pinned) */}
                <div className="p-2.5 pb-2 border-b border-borderline bg-white/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    ></span>
                    <h4 className="font-bold text-navy text-xs truncate" title={stage.name}>
                      {stage.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted font-mono">{stage.weeks * 7}d target</span>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-borderline text-navy shadow-2xs">
                      {stageCandidates.length}
                    </span>
                  </div>
                </div>

                {/* Candidate Cards (Scrollable!) */}
                <div
                  className="p-2.5 space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1.5 scrollbar-thin"
                  style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto" }}
                >
                  {stageCandidates.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-center p-3 text-muted text-xs">
                      No candidates in this stage
                    </div>
                  ) : (
                    stageCandidates.map((cand) => {
                      const delay = getCandidateDelay(cand);
                      const curAppStatus = cand.applicationStatus || "Under Review";

                      return (
                        <div
                          key={cand.id}
                          onClick={() => handleOpenDrawer(cand)}
                          className="bg-white rounded-lg border border-borderline p-2.5 shadow-2xs hover:shadow-card hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Header: ID, Brand, Requisition */}
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[9px] font-mono font-bold text-primary bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 truncate">
                                {cand.id}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  cand.brand === "alchamae"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {cand.brand === "alchamae" ? "ALC" : "AHL"}
                              </span>
                            </div>

                            {/* Candidate Name & Role */}
                            <div className="font-bold text-navy text-xs group-hover:text-primary transition-colors leading-tight truncate">
                              {cand.fullName}
                            </div>
                            <div className="text-[10px] text-slate-600 truncate mt-0.5">
                              {cand.position || "Applicant"}
                            </div>

                            {/* Requisition Link */}
                            {cand.requisitionId && (
                              <div className="text-[9px] text-muted font-mono mt-0.5 truncate">
                                Req: {cand.requisitionId}
                              </div>
                            )}

                            {/* SLA Delay Badge */}
                            <div className="mt-2.5 flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  delay > 0
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : delay === 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>
                                  {delay > 0 ? `+${delay}d Overdue` : delay === 0 ? "Due Today" : "On Track"}
                                </span>
                              </span>
                            </div>

                            {/* Stage 1: Application Status Dropdown */}
                            {stage.id === "ar" && (
                              <div
                                className="mt-2.5 pt-2 border-t border-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                    App Status
                                  </label>
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      curAppStatus === "Under Review"
                                        ? "bg-amber-500"
                                        : curAppStatus === "Interview Scheduled"
                                        ? "bg-blue-500"
                                        : curAppStatus === "No Response"
                                        ? "bg-slate-400"
                                        : "bg-rose-500"
                                    }`}
                                  />
                                </div>
                                <select
                                  value={curAppStatus}
                                  onChange={(e) =>
                                    handleUpdateApplicationStatus(cand.id, e.target.value)
                                  }
                                  className={`w-full text-xs font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer focus:outline-hidden ${
                                    curAppStatus === "Under Review"
                                      ? "bg-amber-50 text-amber-900 border-amber-200"
                                      : curAppStatus === "Interview Scheduled"
                                      ? "bg-blue-50 text-blue-900 border-blue-200"
                                      : curAppStatus === "No Response"
                                      ? "bg-slate-100 text-slate-700 border-slate-300"
                                      : "bg-rose-50 text-rose-900 border-rose-200"
                                  }`}
                                >
                                  <option value="Under Review">Under Review</option>
                                  <option value="Interview Scheduled">Interview Scheduled</option>
                                  <option value="No Response">No Response</option>
                                  <option value="Dropped">Dropped</option>
                                </select>
                              </div>
                            )}

                            {/* Stage 2: Interview Updates Dropdown & Reschedule Section */}
                            {stage.id === "ps" && (
                              <div
                                className="mt-2.5 pt-2 border-t border-slate-100 space-y-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                    Interview Status
                                  </label>
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      cand.interviewUpdateStatus === "Hired"
                                        ? "bg-emerald-500"
                                        : cand.interviewUpdateStatus === "Not Hired"
                                        ? "bg-rose-500"
                                        : cand.interviewUpdateStatus === "Didn't Come for Interview"
                                        ? "bg-slate-500"
                                        : cand.interviewUpdateStatus === "Rescheduled"
                                        ? "bg-purple-500"
                                        : "bg-amber-400"
                                    }`}
                                  />
                                </div>
                                <select
                                  value={cand.interviewUpdateStatus || ""}
                                  onChange={(e) =>
                                    handleUpdateInterviewUpdate(cand.id, {
                                      interviewUpdateStatus: e.target.value,
                                      ...(e.target.value === "Rescheduled" && !cand.rescheduledDate
                                        ? {
                                            rescheduledDate: new Date().toISOString().slice(0, 10),
                                            rescheduledStatus: cand.rescheduledStatus || "Pending",
                                          }
                                        : {}),
                                    })
                                  }
                                  className={`w-full text-xs font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer focus:outline-hidden ${
                                    cand.interviewUpdateStatus === "Hired"
                                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                      : cand.interviewUpdateStatus === "Not Hired"
                                      ? "bg-rose-50 text-rose-900 border-rose-200"
                                      : cand.interviewUpdateStatus === "Didn't Come for Interview"
                                      ? "bg-slate-100 text-slate-800 border-slate-300"
                                      : cand.interviewUpdateStatus === "Rescheduled"
                                      ? "bg-purple-50 text-purple-900 border-purple-200"
                                      : "bg-amber-50 text-amber-900 border-amber-200"
                                  }`}
                                >
                                  <option value="" disabled>Select Status…</option>
                                  <option value="Hired">Hired</option>
                                  <option value="Not Hired">Not Hired</option>
                                  <option value="Didn't Come for Interview">Didn't Come for Interview</option>
                                  <option value="Rescheduled">Rescheduled</option>
                                </select>

                                {/* Rescheduled details: date & follow-up status */}
                                {cand.interviewUpdateStatus === "Rescheduled" && (
                                  <div className="bg-purple-50/70 p-2 rounded-lg border border-purple-200 space-y-1.5 animate-in fade-in duration-150">
                                    <div>
                                      <label className="text-[9px] font-bold text-purple-900 block mb-0.5">
                                        Rescheduled Date
                                      </label>
                                      <input
                                        type="date"
                                        value={cand.rescheduledDate || ""}
                                        onChange={(e) =>
                                          handleUpdateInterviewUpdate(cand.id, {
                                            rescheduledDate: e.target.value,
                                          })
                                        }
                                        className="w-full text-xs bg-white border border-purple-200 rounded px-2 py-1 text-slate-800 font-mono focus:outline-hidden focus:border-purple-400"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-purple-900 block mb-0.5">
                                        Status
                                      </label>
                                      <select
                                        value={cand.rescheduledStatus || "Pending"}
                                        onChange={(e) =>
                                          handleUpdateInterviewUpdate(cand.id, {
                                            rescheduledStatus: e.target.value,
                                          })
                                        }
                                        className="w-full text-xs font-semibold bg-white border border-purple-200 rounded px-2 py-1 text-slate-800 cursor-pointer focus:outline-hidden focus:border-purple-400"
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="Hired">Hired</option>
                                        <option value="Not Hired">Not Hired</option>
                                        <option value="Didn't Come for Interview">Didn't Come for Interview</option>
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Stage 6: Direct Add to Employees action */}
                            {stage.id === "ob" && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleOpenAddEmployee(cand)}
                                  className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>ADD to Employees ➔</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick Bottom Action */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-primary font-semibold group-hover:underline">
                                Manage →
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditCandidate(cand);
                                }}
                                title="Edit Candidate Details"
                                className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-primary transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-slate-100"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              {stage.id !== "ar" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevertStage(cand.id);
                                  }}
                                  disabled={reverting}
                                  title="Revert back to previous stage"
                                  className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 hover:text-amber-800 transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-amber-50"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Revert</span>
                                </button>
                              )}
                            </div>
                            {cand.phone && (
                              <a
                                href={`https://wa.me/91${normalizeFmsPhone(cand.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="WhatsApp"
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TABLE VIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === "table" && (
        <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-borderline text-[11px] font-bold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate ID</th>
                  <th className="py-3 px-4">Name & Contact</th>
                  <th className="py-3 px-4">Position & Req</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">SLA Delay</th>
                  <th className="py-3 px-4">Stage Details / Status</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {filtered.map((cand) => {
                  const meta = getStageMeta(cand.currentStage);
                  const delay = getCandidateDelay(cand);
                  const stageTrack = cand.stages?.[meta.id];

                  return (
                    <tr key={cand.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">{cand.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-navy">{cand.fullName}</div>
                        <div className="text-[10px] text-muted">{cand.phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{cand.position || "Applicant"}</div>
                        <div className="text-[10px] font-mono text-muted">{cand.requisitionId || "Unassigned"}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className="px-2 py-0.5 rounded font-semibold text-[10px] border"
                          style={{
                            backgroundColor: meta.bg,
                            color: meta.textColor,
                            borderColor: meta.color + "44",
                          }}
                        >
                          {meta.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                            delay > 0
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : delay === 0
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {delay > 0 ? `+${delay}d Delay` : delay === 0 ? "Due Today" : "On Track"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {meta.id === "ar" ? (
                          <select
                            value={cand.applicationStatus || "Under Review"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleUpdateApplicationStatus(cand.id, e.target.value)}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-hidden ${
                              (cand.applicationStatus || "Under Review") === "Under Review"
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : cand.applicationStatus === "Interview Scheduled"
                                ? "bg-blue-50 text-blue-900 border-blue-200"
                                : cand.applicationStatus === "No Response"
                                ? "bg-slate-100 text-slate-700 border-slate-300"
                                : "bg-rose-50 text-rose-900 border-rose-200"
                            }`}
                          >
                            <option value="Under Review">Under Review</option>
                            <option value="Interview Scheduled">Interview Scheduled</option>
                            <option value="No Response">No Response</option>
                            <option value="Dropped">Dropped</option>
                          </select>
                        ) : meta.id === "ps" ? (
                          <div className="flex flex-col gap-1 min-w-[130px]" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={cand.interviewUpdateStatus || ""}
                              onChange={(e) =>
                                handleUpdateInterviewUpdate(cand.id, {
                                  interviewUpdateStatus: e.target.value,
                                  ...(e.target.value === "Rescheduled" && !cand.rescheduledDate
                                    ? {
                                        rescheduledDate: new Date().toISOString().slice(0, 10),
                                        rescheduledStatus: cand.rescheduledStatus || "Pending",
                                      }
                                    : {}),
                                })
                              }
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-hidden ${
                                cand.interviewUpdateStatus === "Hired"
                                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                  : cand.interviewUpdateStatus === "Not Hired"
                                  ? "bg-rose-50 text-rose-900 border-rose-200"
                                  : cand.interviewUpdateStatus === "Didn't Come for Interview"
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : cand.interviewUpdateStatus === "Rescheduled"
                                  ? "bg-purple-50 text-purple-900 border-purple-200"
                                  : "bg-amber-50 text-amber-900 border-amber-200"
                              }`}
                            >
                              <option value="" disabled>Status…</option>
                              <option value="Hired">Hired</option>
                              <option value="Not Hired">Not Hired</option>
                              <option value="Didn't Come for Interview">Didn't Come</option>
                              <option value="Rescheduled">Rescheduled</option>
                            </select>
                            {cand.interviewUpdateStatus === "Rescheduled" && (
                              <div className="flex items-center gap-1 text-[9px] text-purple-700 font-mono">
                                <span>{cand.rescheduledDate || "—"}</span>
                                <span>•</span>
                                <span className="font-sans font-semibold text-purple-900">{cand.rescheduledStatus || "Pending"}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-600">
                            {stageTrack?.status || "In Progress"}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {cand.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {meta.id === "ob" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAddEmployee(cand);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>ADD to Employees</span>
                            </button>
                          )}
                          {meta.id !== "ar" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevertStage(cand.id);
                              }}
                              disabled={reverting}
                              title="Revert to previous stage"
                              className="text-xs text-amber-700 hover:text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revert</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCandidate(cand);
                            }}
                            className="text-xs text-slate-600 hover:text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenDrawer(cand)}
                            className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* INTERACTIVE STAGE ACTION DRAWER */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedCand && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-xl h-full shadow-2xl border-l border-borderline flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {selectedCand.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      selectedCand.brand === "alchamae"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {selectedCand.brand === "alchamae" ? "ALC" : "AHL"}
                  </span>
                  {selectedCand.status.toLowerCase() === "dropped" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      Dropped
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-navy mt-1">{selectedCand.fullName}</h3>
                <p className="text-xs text-muted">
                  {selectedCand.position || "Applicant"} · Req: {selectedCand.requisitionId || "Unassigned"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditCandidate(selectedCand)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-borderline text-navy hover:text-primary hover:border-primary/40 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                  title="Edit Candidate Information"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  <span>Edit Candidate</span>
                </button>
                <button
                  onClick={() => setSelectedCand(null)}
                  className="text-muted hover:text-navy p-1.5 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* 6-Stage Visual Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="font-semibold text-navy">Pipeline Journey</span>
                  <span>
                    Stage{" "}
                    {FMS_CANDIDATE_STAGES.findIndex(
                      (s) => s.id === getStageMeta(selectedCand.currentStage).id
                    ) + 1}{" "}
                    of {FMS_CANDIDATE_STAGES.length}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {FMS_CANDIDATE_STAGES.map((s, idx) => {
                    const currentIdx = FMS_CANDIDATE_STAGES.findIndex(
                      (stage) => stage.id === getStageMeta(selectedCand.currentStage).id
                    );
                    const isDone = idx < currentIdx || selectedCand.status === "Hired";
                    const isCurrent = idx === currentIdx && selectedCand.status !== "Hired";

                    return (
                      <div
                        key={s.id}
                        title={s.name}
                        className={`flex-1 h-2 rounded-full transition-all ${
                          isDone
                            ? "bg-emerald-500"
                            : isCurrent
                            ? "bg-primary ring-2 ring-primary/30"
                            : "bg-slate-200"
                        }`}
                      ></div>
                    );
                  })}
                </div>
              </div>

              {/* Current Stage Overview Banner */}
              {(() => {
                const meta = getStageMeta(selectedCand.currentStage);
                const delay = getCandidateDelay(selectedCand);
                const stageTrack = selectedCand.stages?.[meta.id];

                return (
                  <div
                    className="p-4 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: meta.bg,
                      borderColor: meta.color + "44",
                    }}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Active Stage
                      </span>
                      <h4 className="text-sm font-bold mt-0.5" style={{ color: meta.textColor }}>
                        {meta.name}
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Planned Date: <strong>{stageTrack?.plannedDate || "Today"}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          delay > 0
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : delay === 0
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{delay > 0 ? `+${delay}d Delay` : delay === 0 ? "Due Today" : "On Track"}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Stage 1: Application Status Selector */}
              {(() => {
                const meta = getStageMeta(selectedCand.currentStage);
                if (meta.id !== "ar") return null;

                const curAppStatus = selectedCand.applicationStatus || "Under Review";

                return (
                  <div className="bg-canvas p-4 rounded-xl border border-borderline space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>Stage 1 Application Status</span>
                      </label>
                      <span className="text-[11px] text-muted">
                        Select applicant current status
                      </span>
                    </div>

                    <select
                      value={curAppStatus}
                      onChange={(e) => handleUpdateApplicationStatus(selectedCand.id, e.target.value)}
                      className={`w-full text-xs font-bold px-3 py-2.5 rounded-lg border transition-all cursor-pointer focus:outline-hidden ${
                        curAppStatus === "Under Review"
                          ? "bg-amber-50 text-amber-900 border-amber-300"
                          : curAppStatus === "Interview Scheduled"
                          ? "bg-blue-50 text-blue-900 border-blue-300"
                          : curAppStatus === "No Response"
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : "bg-rose-50 text-rose-900 border-rose-300"
                      }`}
                    >
                      <option value="Under Review">Under Review</option>
                      <option value="Interview Scheduled">Interview Scheduled</option>
                      <option value="No Response">No Response</option>
                      <option value="Dropped">Dropped</option>
                    </select>
                  </div>
                );
              })()}

              {/* Stage 2: Interview Updates Panel */}
              {(() => {
                const meta = getStageMeta(selectedCand.currentStage);
                if (meta.id !== "ps") return null;

                const curStatus = selectedCand.interviewUpdateStatus || "";
                const resDate = selectedCand.rescheduledDate || "";
                const resStatus = selectedCand.rescheduledStatus || "Pending";

                return (
                  <div className="bg-canvas p-4 rounded-xl border border-borderline space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Stage 2 Interview Updates</span>
                      </label>
                      <span className="text-[11px] text-muted">
                        Outcome & scheduling status
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-navy">Interview Status</label>
                      <select
                        value={curStatus}
                        onChange={(e) =>
                          handleUpdateInterviewUpdate(selectedCand.id, {
                            interviewUpdateStatus: e.target.value,
                            ...(e.target.value === "Rescheduled" && !resDate
                              ? {
                                  rescheduledDate: new Date().toISOString().slice(0, 10),
                                  rescheduledStatus: resStatus,
                                }
                              : {}),
                          })
                        }
                        className={`w-full text-xs font-bold px-3 py-2.5 rounded-lg border transition-all cursor-pointer focus:outline-hidden ${
                          curStatus === "Hired"
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                            : curStatus === "Not Hired"
                            ? "bg-rose-50 text-rose-900 border-rose-300"
                            : curStatus === "Didn't Come for Interview"
                            ? "bg-slate-100 text-slate-800 border-slate-300"
                            : curStatus === "Rescheduled"
                            ? "bg-purple-50 text-purple-900 border-purple-300"
                            : "bg-amber-50 text-amber-900 border-amber-300"
                        }`}
                      >
                        <option value="" disabled>-- Select Interview Status --</option>
                        <option value="Hired">Hired</option>
                        <option value="Not Hired">Not Hired</option>
                        <option value="Didn't Come for Interview">Didn't Come for Interview</option>
                        <option value="Rescheduled">Rescheduled</option>
                      </select>
                    </div>

                    {/* Rescheduled Options */}
                    {curStatus === "Rescheduled" && (
                      <div className="bg-purple-50/70 p-3 rounded-lg border border-purple-200 space-y-3 animate-in fade-in duration-150">
                        <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-700" />
                          <span>Rescheduling Details</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-purple-950">
                              Rescheduled Date
                            </label>
                            <input
                              type="date"
                              value={resDate}
                              onChange={(e) =>
                                handleUpdateInterviewUpdate(selectedCand.id, {
                                  rescheduledDate: e.target.value,
                                })
                              }
                              className="w-full text-xs bg-white border border-purple-200 rounded-lg px-2.5 py-2 text-slate-800 font-mono focus:ring-1 focus:ring-purple-400 focus:outline-hidden"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-purple-950">
                              Rescheduled Status
                            </label>
                            <select
                              value={resStatus}
                              onChange={(e) =>
                                handleUpdateInterviewUpdate(selectedCand.id, {
                                  rescheduledStatus: e.target.value,
                                })
                              }
                              className="w-full text-xs font-bold bg-white border border-purple-200 rounded-lg px-2.5 py-2 text-slate-800 cursor-pointer focus:ring-1 focus:ring-purple-400 focus:outline-hidden"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Hired">Hired</option>
                              <option value="Not Hired">Not Hired</option>
                              <option value="Didn't Come for Interview">Didn't Come for Interview</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stage Specific Fields */}
              {(() => {
                const meta = getStageMeta(selectedCand.currentStage);
                const visibleFields = meta.id === "ps"
                  ? (meta.fields || []).filter(
                      (f) => !["interviewUpdateStatus", "rescheduledDate", "rescheduledStatus"].includes(f.key)
                    )
                  : (meta.fields || []);
                if (visibleFields.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <h4 className="font-bold text-navy text-xs uppercase tracking-wider">
                      Stage Specific Field Data
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-canvas p-3.5 rounded-xl border border-borderline">
                      {visibleFields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="font-semibold text-navy text-[11px]">{field.label}</label>
                          {field.type === "select" ? (
                            <select
                              value={fieldFormValues[field.key] || ""}
                              onChange={(e) =>
                                setFieldFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-borderline rounded-lg text-navy text-xs focus:ring-1 focus:ring-primary"
                            >
                              <option value="">-- Select --</option>
                              {field.opts?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "textarea" ? (
                            <textarea
                              rows={2}
                              value={fieldFormValues[field.key] || ""}
                              onChange={(e) =>
                                setFieldFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder={field.ph}
                              className="w-full px-2.5 py-1.5 bg-white border border-borderline rounded-lg text-navy text-xs focus:ring-1 focus:ring-primary col-span-2"
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={fieldFormValues[field.key] || ""}
                              onChange={(e) =>
                                setFieldFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder={field.ph}
                              className="w-full px-2.5 py-1.5 bg-white border border-borderline rounded-lg text-navy text-xs focus:ring-1 focus:ring-primary"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Next Stage Target Date Setting */}
              {(() => {
                const meta = getStageMeta(selectedCand.currentStage);
                const curIdx = FMS_CANDIDATE_STAGES.findIndex((s) => s.id === meta.id);
                const nextMeta = FMS_CANDIDATE_STAGES[curIdx + 1];

                if (!nextMeta) return null;

                return (
                  <div className="space-y-2 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <label className="font-bold text-navy text-xs flex items-center justify-between">
                      <span>Target Planned Date for Next Stage ({nextMeta.name})</span>
                      <span className="text-primary font-mono text-[10px]">
                        SLA: {nextMeta.weeks * 7} Days
                      </span>
                    </label>
                    <input
                      type="date"
                      value={customTargetDate}
                      onChange={(e) => setCustomTargetDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-borderline rounded-lg text-navy text-xs"
                    />
                  </div>
                );
              })()}

              {advanceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {advanceError}
                </div>
              )}
              {revertError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                  {revertError}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-borderline flex flex-wrap items-center justify-between gap-2 bg-canvas">
              <div className="flex items-center gap-2">
                {/* Drop / Reject Button */}
                {selectedCand.status.toLowerCase() !== "dropped" ? (
                  <button
                    type="button"
                    onClick={() => setIsDropModalOpen(true)}
                    className="px-3 py-2 rounded-lg bg-white border border-borderline text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Drop Candidate</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestoreCandidate}
                    disabled={dropping}
                    className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Restore Candidate</span>
                  </button>
                )}

                {/* Revert Button if not stage 1 */}
                {(() => {
                  const meta = getStageMeta(selectedCand.currentStage);
                  const curIdx = FMS_CANDIDATE_STAGES.findIndex((s) => s.id === meta.id);
                  if (curIdx > 0) {
                    const prevMeta = FMS_CANDIDATE_STAGES[curIdx - 1];
                    return (
                      <button
                        type="button"
                        onClick={() => handleRevertStage(selectedCand.id)}
                        disabled={reverting}
                        className="px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title={`Revert back to ${prevMeta.name}`}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${reverting ? "animate-spin" : ""}`} />
                        <span>Revert to {prevMeta.name} ↶</span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Main Advance / Onboard Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCand(null)}
                  className="px-3.5 py-2 rounded-lg bg-white border border-borderline text-navy hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>

                {(() => {
                  const meta = getStageMeta(selectedCand.currentStage);
                  const isLastStage = meta.id === "ob";

                  if (isLastStage) {
                    return (
                      <button
                        onClick={() => handleOpenAddEmployee(selectedCand)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>ADD to Employees ➔</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={handleAdvanceStage}
                      disabled={advancing || selectedCand.status.toLowerCase() === "dropped"}
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {advancing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Advance to Next Stage ➔</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* DROP MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      {isDropModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl border border-borderline shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-navy">Drop Candidate</h4>
                <p className="text-muted text-xs">Archive candidate from active pipeline</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-navy">Reason for Dropping</label>
              <select
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy text-xs"
              >
                <option value="Salary expectations mismatch">Salary expectations mismatch</option>
                <option value="Failed technical / practical evaluation">Failed technical / practical evaluation</option>
                <option value="Candidate declined offer">Candidate declined offer</option>
                <option value="Unreachable / No show for interview">Unreachable / No show for interview</option>
                <option value="Location / Shift timing constraints">Location / Shift timing constraints</option>
                <option value="Culture fit / behavioral concerns">Culture fit / behavioral concerns</option>
                <option value="Found alternative candidate">Found alternative candidate</option>
              </select>
            </div>

            <div className="pt-3 border-t border-borderline flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDropModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-canvas border border-borderline text-navy font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDropCandidate}
                disabled={dropping}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 shadow-sm"
              >
                {dropping ? "Dropping..." : "Confirm Drop"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* DIRECT ADD TO EMPLOYEES MODAL (STAGE 6) */}
      {/* ────────────────────────────────────────────────────────── */}
      {onboardCand && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-borderline shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {onboardCand.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      onboardCand.brand === "alchamae"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {onboardCand.brand === "alchamae" ? "ALC" : "AHL"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-navy mt-1 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <span>Add to Master Employee Directory</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Direct onboarding form pre-filled with candidate recruitment data
                </p>
              </div>

              <button
                onClick={() => setOnboardCand(null)}
                className="text-muted hover:text-navy p-1.5 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {onboardResult ? (
              <div className="p-6 space-y-5 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-navy">Employee Added Successfully!</h4>
                  <p className="text-xs text-muted mt-1">
                    Onboarding invitation created for <strong>{onboardForm.name}</strong> ({onboardForm.company})
                  </p>
                </div>

                <div className="p-4 bg-canvas rounded-xl border border-borderline text-left text-xs space-y-2">
                  <label className="text-[11px] font-bold text-muted uppercase">Joining Form Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={onboardResult.url}
                      className="w-full px-3 py-2 bg-white border border-borderline rounded-lg text-slate-700 font-mono text-xs select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(onboardResult.url);
                        setOnboardCopied(true);
                        setTimeout(() => setOnboardCopied(false), 2000);
                      }}
                      className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-primary font-semibold hover:bg-indigo-100 flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {onboardCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{onboardCopied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <a
                    href={`https://wa.me/91${normalizeFmsPhone(onboardForm.mobile)}?text=${encodeURIComponent(
                      `Hello ${onboardForm.name.split(" ")[0]}! 🎉 Welcome to ${onboardForm.company}!\n\nPlease fill in your employee onboarding form here:\n${onboardResult.url}\n\n– AHL HR Team`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Link on WhatsApp</span>
                  </a>
                  <button
                    onClick={() => setOnboardCand(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
                {onboardError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                    {onboardError}
                  </div>
                )}

                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-navy">Onboarding Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOnboardForm((f) => ({ ...f, mode: "link" }))}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        onboardForm.mode === "link"
                          ? "bg-indigo-50 border-primary text-primary font-bold shadow-2xs"
                          : "bg-canvas border-borderline text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Send className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Link</span>
                      </div>
                      <p className="text-[10px] text-muted font-normal mt-0.5">Candidate fills on their phone</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOnboardForm((f) => ({ ...f, mode: "device" }))}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        onboardForm.mode === "device"
                          ? "bg-indigo-50 border-primary text-primary font-bold shadow-2xs"
                          : "bg-canvas border-borderline text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Handover This Device</span>
                      </div>
                      <p className="text-[10px] text-muted font-normal mt-0.5">Opens form on this screen</p>
                    </button>
                  </div>
                </div>

                {/* Row 1: Employee Name & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Employee Full Name *</label>
                    <input
                      required
                      type="text"
                      value={onboardForm.name}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">WhatsApp Mobile *</label>
                    <input
                      required
                      type="tel"
                      value={onboardForm.mobile}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, mobile: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                    />
                  </div>
                </div>

                {/* Row 2: Company & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Company Entity *</label>
                    <select
                      value={onboardForm.company}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, company: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium cursor-pointer"
                    >
                      <option value="American Hairlines">American Hairlines</option>
                      <option value="Alchamae">Alchamae</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Department *</label>
                    <select
                      value={onboardForm.department}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, department: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Designation & Manager */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Designation / Role *</label>
                    <input
                      required
                      type="text"
                      value={onboardForm.designation}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, designation: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Reporting Manager *</label>
                    <input
                      required
                      type="text"
                      value={onboardForm.manager}
                      onChange={(e) => setOnboardForm((f) => ({ ...f, manager: e.target.value }))}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                    />
                  </div>
                </div>

                {/* Row 4: Date of Joining */}
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Date of Joining (DOJ) *</label>
                  <input
                    required
                    type="date"
                    value={onboardForm.doj}
                    onChange={(e) => setOnboardForm((f) => ({ ...f, doj: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-borderline flex items-center justify-between">
                  <a
                    href={`/add-employee?mode=${onboardForm.mode}&name=${encodeURIComponent(
                      onboardForm.name
                    )}&mobile=${encodeURIComponent(
                      onboardForm.mobile
                    )}&company=${encodeURIComponent(
                      onboardForm.company
                    )}&designation=${encodeURIComponent(
                      onboardForm.designation
                    )}&department=${encodeURIComponent(
                      onboardForm.department
                    )}&manager=${encodeURIComponent(
                      onboardForm.manager
                    )}&doj=${encodeURIComponent(onboardForm.doj)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Full Screen Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOnboardCand(null)}
                      className="px-3.5 py-2 rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={onboardSubmitting}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {onboardSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Add to Employees</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* EDIT CANDIDATE MODAL (AVAILABLE IN EACH STAGE) */}
      {/* ────────────────────────────────────────────────────────── */}
      {editingCandidate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-borderline shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {editingCandidate.id}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Stage: {editingCandidate.currentStage}
                  </span>
                </div>
                <h3 className="text-base font-bold text-navy mt-1 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary" />
                  <span>Edit Candidate Details</span>
                </h3>
              </div>

              <button
                onClick={() => setEditingCandidate(null)}
                className="text-muted hover:text-navy p-1.5 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditCandidate} className="p-6 overflow-y-auto space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                  {editError}
                </div>
              )}

              {/* Row 1: Target Requisition */}
              <div className="space-y-1">
                <label className="font-semibold text-navy">Target Requisition</label>
                <select
                  value={editForm.requisitionId || ""}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, requisitionId: e.target.value }))}
                  className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium cursor-pointer"
                >
                  <option value="">-- Unassigned / General Intake --</option>
                  {requisitions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}: {r.jobTitle} ({r.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={editForm.fullName || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Mobile Number *</label>
                  <input
                    required
                    type="tel"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
              </div>

              {/* Row 3: Email & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Brand Entity</label>
                  <select
                    value={editForm.brand || "ahl"}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium cursor-pointer"
                  >
                    <option value="ahl">American Hairlines (AHL)</option>
                    <option value="alchamae">Alchamae (ALC)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Pipeline Stage & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Current Pipeline Stage</label>
                  <select
                    value={editForm.currentStage || "Application Received"}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, currentStage: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-navy font-semibold cursor-pointer"
                  >
                    {FMS_CANDIDATE_STAGES.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Overall Status</label>
                  <select
                    value={editForm.status || "Active"}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-navy font-semibold cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Hired">Hired</option>
                    <option value="Onboarded">Onboarded</option>
                    <option value="Dropped">Dropped</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Position & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Job Position</label>
                  <input
                    type="text"
                    value={editForm.position || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, position: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Experience</label>
                  <input
                    type="text"
                    value={editForm.experience || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, experience: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
              </div>

              {/* Row 6: Compensation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Current Salary (CTC)</label>
                  <input
                    type="text"
                    value={editForm.currentSalary || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, currentSalary: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Expected Salary (CTC)</label>
                  <input
                    type="text"
                    value={editForm.expectedSalary || ""}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, expectedSalary: e.target.value }))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium"
                  />
                </div>
              </div>

              {/* Row 7: Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-navy">Stage & Interview Notes</label>
                <textarea
                  rows={3}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes, observations, candidate feedback..."
                  className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy font-medium placeholder:text-muted"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-borderline flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="px-3.5 py-2 rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Candidate Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
