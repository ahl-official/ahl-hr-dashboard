"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  MapPin,
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  MessageSquare,
  FileText,
  Briefcase,
  X,
  Loader2,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  ChevronDown,
  UserCheck,
  Send,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Edit3,
} from "lucide-react";
import type { FmsCandidate, FmsRequisition } from "@/types/fms";
import { normalizeFmsPhone } from "@/lib/fms-rules";

interface CandidateApplicationsTabProps {
  initialRequisitionId?: string;
  initialOpenAddModal?: boolean;
  onClearInitialReq?: () => void;
  onNavigateToRequisitions?: () => void;
}

const SOURCE_CHANNELS = [
  "LinkedIn",
  "Walk-in",
  "Referral",
  "Indeed",
  "WhatsApp",
  "Instagram",
  "Job Portal",
  "Direct Intake",
  "Website Inbound",
];

const STAGES_LIST = [
  "Application Received",
  "Interview Updates",
  "Confirmation Call",
  "Joining",
  "Documentation",
  "Onboarding",
];

export default function CandidateApplicationsTab({
  initialRequisitionId,
  initialOpenAddModal = false,
  onClearInitialReq,
  onNavigateToRequisitions,
}: CandidateApplicationsTabProps) {
  const [candidates, setCandidates] = useState<FmsCandidate[]>([]);
  const [requisitions, setRequisitions] = useState<FmsRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [reqFilter, setReqFilter] = useState<string>(initialRequisitionId || "All");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Create/Edit Modal state
  const [isAddOpen, setIsAddOpen] = useState(initialOpenAddModal);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdCandidate, setCreatedCandidate] = useState<FmsCandidate | null>(null);

  // Profile Drawer state
  const [selectedCandidate, setSelectedCandidate] = useState<FmsCandidate | null>(null);

  // Form State
  const [formReqId, setFormReqId] = useState(initialRequisitionId || "");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formExperience, setFormExperience] = useState("");
  const [formSource, setFormSource] = useState("LinkedIn");
  const [formCurrentLoc, setFormCurrentLoc] = useState("Mumbai");
  const [formPreferredLoc, setFormPreferredLoc] = useState("Bandra Salon");
  const [formCurrentCompany, setFormCurrentCompany] = useState("");
  const [formCurrentCtc, setFormCurrentCtc] = useState("");
  const [formExpectedCtc, setFormExpectedCtc] = useState("");
  const [formNoticePeriod, setFormNoticePeriod] = useState("Immediate");
  const [formSkills, setFormSkills] = useState("");
  const [formResumeLink, setFormResumeLink] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formBrand, setFormBrand] = useState<"ahl" | "alchamae">("ahl");
  const [formStage, setFormStage] = useState<string>("Application Received");
  const [formStatus, setFormStatus] = useState<string>("Active");

  // Synchronize when initialRequisitionId changes
  useEffect(() => {
    if (initialRequisitionId) {
      setReqFilter(initialRequisitionId);
      setFormReqId(initialRequisitionId);
    }
  }, [initialRequisitionId]);

  useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddOpen(true);
    }
  }, [initialOpenAddModal]);

  // Load Requisitions for dropdowns
  const fetchRequisitions = async () => {
    try {
      const res = await fetch("/api/recruitment/requisitions");
      const json = await res.json();
      if (json.success && json.data) {
        setRequisitions(json.data.requisitions || []);
      }
    } catch (err) {
      console.warn("Failed to load requisitions for dropdown:", err);
    }
  };

  // Load Candidates
  const fetchCandidates = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recruitment/candidates-fms");
      const json = await res.json();
      if (json.success && json.data) {
        setCandidates(json.data.candidates || []);
      } else {
        setError(json.message || "Failed to load candidate applications");
      }
    } catch (err: any) {
      setError("Network error loading candidates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    fetchRequisitions();
  }, []);

  // When formReqId changes, auto-populate role and brand
  const handleReqSelect = (reqId: string) => {
    setFormReqId(reqId);
    const matched = requisitions.find((r) => r.id === reqId);
    if (matched) {
      setFormPosition(matched.jobTitle);
      setFormBrand(matched.brand === "alchamae" ? "alchamae" : "ahl");
      if (matched.workLocation) {
        setFormPreferredLoc(matched.workLocation);
      }
    }
  };

  // Filter candidates
  const filtered = candidates.filter((c) => {
    if (reqFilter !== "All" && c.requisitionId !== reqFilter) return false;
    if (stageFilter !== "All") {
      const matchFilter =
        c.currentStage.toLowerCase() === stageFilter.toLowerCase() ||
        (stageFilter === "Interview Updates" && c.currentStage.toLowerCase() === "pre-screening") ||
        (stageFilter === "Pre-Screening" && c.currentStage.toLowerCase() === "interview updates");
      if (!matchFilter) return false;
    }
    if (sourceFilter !== "All" && (c.source || "").toLowerCase() !== sourceFilter.toLowerCase()) return false;
    if (statusFilter !== "All" && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        c.fullName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.position && c.position.toLowerCase().includes(q)) ||
        (c.requisitionId && c.requisitionId.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = candidates.length;
  const activeCount = candidates.filter((c) => c.status.toLowerCase() === "active").length;
  const inboundCount = candidates.filter(
    (c) => c.id.startsWith("APP-") || c.status.toLowerCase() === "inbound"
  ).length;
  const linkedCount = candidates.filter((c) => Boolean(c.requisitionId)).length;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setSubmitError("Candidate Full Name is required");
      return;
    }
    if (!formPhone.trim()) {
      setSubmitError("Phone number is required");
      return;
    }
    if (!formReqId) {
      setSubmitError("Please link this candidate to an active Job Requisition");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      if (editingCandidateId) {
        // Edit existing candidate
        const updates: any = {
          fullName: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          requisitionId: formReqId,
          position: formPosition.trim() || undefined,
          experience: formExperience.trim() || undefined,
          source: formSource,
          currentLocation: formCurrentLoc.trim() || undefined,
          preferredLocation: formPreferredLoc.trim() || undefined,
          currentCompany: formCurrentCompany.trim() || undefined,
          currentSalary: formCurrentCtc.trim() || undefined,
          expectedSalary: formExpectedCtc.trim() || undefined,
          noticePeriod: formNoticePeriod.trim() || undefined,
          skills: formSkills.trim() || undefined,
          resumeLink: formResumeLink.trim() || undefined,
          notes: formNotes.trim() || undefined,
          brand: formBrand,
          currentStage: formStage,
          status: formStatus,
        };

        const res = await fetch("/api/recruitment/candidates-fms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCandidateId,
            updates,
          }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          setCandidates((prev) =>
            prev.map((c) => (c.id === editingCandidateId ? json.data : c))
          );
          if (selectedCandidate && selectedCandidate.id === editingCandidateId) {
            setSelectedCandidate(json.data);
          }
          resetForm();
        } else {
          setSubmitError(json.message || "Failed to update candidate");
        }
      } else {
        // Add new candidate
        const res = await fetch("/api/recruitment/candidates-fms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formName.trim(),
            phone: formPhone.trim(),
            email: formEmail.trim(),
            requisitionId: formReqId,
            position: formPosition.trim() || undefined,
            experience: formExperience.trim() || undefined,
            source: formSource,
            currentLocation: formCurrentLoc.trim() || undefined,
            preferredLocation: formPreferredLoc.trim() || undefined,
            currentCompany: formCurrentCompany.trim() || undefined,
            currentSalary: formCurrentCtc.trim() || undefined,
            expectedSalary: formExpectedCtc.trim() || undefined,
            noticePeriod: formNoticePeriod.trim() || undefined,
            skills: formSkills.trim() || undefined,
            resumeLink: formResumeLink.trim() || undefined,
            notes: formNotes.trim() || undefined,
            brand: formBrand,
          }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          setCandidates((prev) => [json.data, ...prev]);
          setCreatedCandidate(json.data);
        } else {
          setSubmitError(json.message || "Failed to add candidate");
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || "Network error saving application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditCandidate = (cand: FmsCandidate) => {
    setEditingCandidateId(cand.id);
    setCreatedCandidate(null);
    setFormReqId(cand.requisitionId || "");
    setFormName(cand.fullName || "");
    setFormPhone(cand.phone || "");
    setFormEmail(cand.email || "");
    setFormPosition(cand.position || "");
    setFormExperience(cand.experience || "");
    setFormSource(cand.source || "LinkedIn");
    setFormCurrentLoc(cand.city || "Mumbai");
    setFormPreferredLoc(cand.area || "");
    setFormCurrentCompany(cand.currentCompany || "");
    setFormCurrentCtc(cand.currentSalary || "");
    setFormExpectedCtc(cand.expectedSalary || "");
    setFormNoticePeriod(cand.noticePeriod || "Immediate");
    setFormSkills(cand.skills || "");
    setFormResumeLink(cand.resumeLink || "");
    setFormNotes(cand.notes || "");
    setFormBrand((cand.brand as any) || "ahl");
    setFormStage(cand.currentStage || "Application Received");
    setFormStatus(cand.status || "Active");
    setSubmitError("");
    setIsAddOpen(true);
  };

  const resetForm = () => {
    setEditingCandidateId(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormPosition("");
    setFormExperience("");
    setFormCurrentCompany("");
    setFormCurrentCtc("");
    setFormExpectedCtc("");
    setFormSkills("");
    setFormResumeLink("");
    setFormNotes("");
    setCreatedCandidate(null);
    setSubmitError("");
    setIsAddOpen(false);
  };

  // Generate WhatsApp Invite URL
  const getWhatsAppInviteUrl = (cand: FmsCandidate) => {
    const rawDigits = normalizeFmsPhone(cand.phone);
    if (!rawDigits) return "#";
    const text = `Hi ${cand.fullName}! 👋\n\nThank you for your interest in joining American Hairline.\n\nPlease fill out your candidate application form before your Pre-Screening begins:\n🔗 https://candidate-application-form-seven.vercel.app/\n\nThis helps us understand your profile better.\n– AHL HR Team`;
    return `https://wa.me/91${rawDigits}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────── */}
      {/* ACTIVE REQUISITION FILTER BANNER (If navigated from Req tab) */}
      {/* ────────────────────────────────────────────────────────── */}
      {reqFilter !== "All" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <span>
              Showing applicants specifically linked to{" "}
              <strong className="font-mono font-bold text-primary">{reqFilter}</strong>
              {requisitions.find((r) => r.id === reqFilter) && (
                <span> ({requisitions.find((r) => r.id === reqFilter)?.jobTitle})</span>
              )}
            </span>
          </div>
          <button
            onClick={() => {
              setReqFilter("All");
              if (onClearInitialReq) onClearInitialReq();
            }}
            className="text-primary hover:text-navy font-semibold underline text-xs cursor-pointer"
          >
            Show All Requisitions
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP KPI CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Applications */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Candidates
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{totalCount}</div>
          <div className="mt-1 text-xs text-muted flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            <span>All recorded candidates</span>
          </div>
        </div>

        {/* Active Pipeline */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Active In Pipeline
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">{activeCount}</div>
          <div className="mt-1 text-xs text-muted">Currently undergoing screening / hiring</div>
        </div>

        {/* Inbound Queue */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Inbound Queue
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-700">{inboundCount}</div>
          <div className="mt-1 text-xs text-muted">New submissions awaiting triage</div>
        </div>

        {/* Linked to Requisitions */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Linked to Requisitions
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{linkedCount}</div>
          <div className="mt-1 text-xs text-muted">Mapped to active job openings</div>
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

        {/* Filter Dropdowns & Actions */}
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

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Stages</option>
            {STAGES_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Sources</option>
            {SOURCE_CHANNELS.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inbound">Inbound Queue</option>
            <option value="Archived">Archived</option>
            <option value="Dropped">Dropped</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-canvas p-1 rounded-lg border border-borderline">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "grid"
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

          {/* Refresh Button */}
          <button
            onClick={() => fetchCandidates(true)}
            disabled={refreshing}
            title="Refresh Candidate List"
            className="p-2 text-muted hover:text-primary hover:bg-canvas rounded-lg border border-borderline transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Add Candidate Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Candidate</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* LOADING & ERROR STATES */}
      {/* ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-surface rounded-xl p-12 border border-borderline shadow-card flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-semibold text-navy">Loading Candidate Applications...</p>
          <p className="text-xs text-muted mt-1">Retrieving pipeline and intake records</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => fetchCandidates(false)}
            className="mt-3 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* EMPTY STATE */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-surface rounded-xl p-12 border border-borderline shadow-card text-center">
          <Users className="w-10 h-10 text-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy">No Candidates Found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            {search || reqFilter !== "All" || stageFilter !== "All"
              ? "No candidate applications match your active search filters. Try clearing filters."
              : "No candidate applications have been entered yet. Click '+ Add Candidate' to intake your first applicant."}
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Candidate</span>
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW MODE: GRID CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cand) => {
            const isApp = cand.id.startsWith("APP-");
            const isArchived = cand.status.toLowerCase() === "archived";
            const isDropped = cand.status.toLowerCase() === "dropped";
            const reqMatch = requisitions.find((r) => r.id === cand.requisitionId);

            return (
              <div
                key={cand.id}
                className="bg-surface rounded-xl border border-borderline p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Candidate ID, Brand & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {cand.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          cand.brand?.toLowerCase() === "alchamae"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {cand.brand?.toLowerCase() === "alchamae" ? "ALC" : "AHL"}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isArchived || isDropped
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : isApp
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {cand.status}
                    </span>
                  </div>

                  {/* Candidate Full Name & Role */}
                  <h3 className="text-base font-bold text-navy group-hover:text-primary transition-colors leading-snug">
                    {cand.fullName}
                  </h3>
                  <div className="text-xs font-medium text-slate-700 mt-0.5">
                    {cand.position || "Applicant"}
                  </div>

                  {/* Requisition Link Pill */}
                  <div className="mt-2.5">
                    {cand.requisitionId ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-medium">
                        <Briefcase className="w-3 h-3 text-primary" />
                        <span className="font-mono font-bold text-primary">{cand.requisitionId}</span>
                        {reqMatch && <span className="truncate max-w-[140px]">· {reqMatch.jobTitle}</span>}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3" />
                        <span>Unassigned Inbound</span>
                      </span>
                    )}
                  </div>

                  {/* Stage Badge & Source Info */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-borderline text-xs">
                    <div className="bg-canvas p-2 rounded-lg">
                      <span className="text-[10px] text-muted block uppercase font-medium">Stage</span>
                      <span className="font-bold text-navy text-[11px] truncate block">
                        {cand.currentStage}
                      </span>
                    </div>

                    <div className="bg-canvas p-2 rounded-lg">
                      <span className="text-[10px] text-muted block uppercase font-medium">Source</span>
                      <span className="font-bold text-navy text-[11px] truncate block">
                        {cand.source || "Direct"}
                      </span>
                    </div>
                  </div>

                  {/* Location & Experience Info */}
                  <div className="space-y-1 mt-2.5 text-xs text-slate-600">
                    {(cand.city || cand.area) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span className="truncate">{[cand.area, cand.city].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {cand.experience && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span>{cand.experience}</span>
                      </div>
                    )}
                    {cand.expectedSalary && (
                      <div className="text-[11px] font-medium text-emerald-700">
                        Exp CTC: {cand.expectedSalary}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Quick Actions (WhatsApp, Call, Details) */}
                <div className="mt-4 pt-3 border-t border-borderline flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {cand.phone && (
                      <>
                        <a
                          href={getWhatsAppInviteUrl(cand)}
                          target="_blank"
                          rel="noreferrer"
                          title="Message on WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${cand.phone}`}
                          title={`Call ${cand.phone}`}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    {cand.resumeLink && (
                      <a
                        href={cand.resumeLink}
                        target="_blank"
                        rel="noreferrer"
                        title="View Resume / CV"
                        className="p-1.5 rounded-lg bg-indigo-50 text-primary hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEditCandidate(cand)}
                      className="text-xs font-semibold text-slate-600 hover:text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setSelectedCandidate(cand)}
                      className="text-xs font-semibold text-primary hover:text-navy hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW MODE: TABLE VIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === "table" && filtered.length > 0 && (
        <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-borderline text-[11px] font-bold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate ID</th>
                  <th className="py-3 px-4">Name & Contact</th>
                  <th className="py-3 px-4">Position & Requisition</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {filtered.map((cand) => (
                  <tr key={cand.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">{cand.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy">{cand.fullName}</div>
                      <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                        <span>{cand.phone}</span>
                        {cand.email && <span>· {cand.email}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{cand.position || "Applicant"}</div>
                      {cand.requisitionId ? (
                        <div className="text-[10px] font-mono text-primary font-semibold">
                          {cand.requisitionId}
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700">Unassigned</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-primary border border-indigo-100 font-semibold text-[10px]">
                        {cand.currentStage}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{cand.source || "Direct"}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {[cand.area, cand.city].filter(Boolean).join(", ") || "Mumbai"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          cand.status.toLowerCase() === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : cand.status.toLowerCase() === "inbound"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cand.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {cand.phone && (
                          <a
                            href={getWhatsAppInviteUrl(cand)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleStartEditCandidate(cand)}
                          className="text-xs text-slate-600 hover:text-primary font-semibold hover:underline px-1.5 py-0.5 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setSelectedCandidate(cand)}
                          className="text-xs text-primary font-semibold hover:underline px-1.5 py-0.5 cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD CANDIDATE / INTAKE FORM */}
      {/* ────────────────────────────────────────────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-borderline shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-navy flex items-center gap-2">
                  {editingCandidateId ? (
                    <>
                      <Edit3 className="w-5 h-5 text-primary" />
                      <span>Edit Candidate Details ({editingCandidateId})</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-primary" />
                      <span>Candidate Application Intake Form</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {editingCandidateId
                    ? "Modify candidate contact information, professional background, and stage"
                    : "Register incoming applicant and place into Stage 1 (Application Received)"}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-muted hover:text-navy p-1 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {createdCandidate ? (
              <div className="p-6 space-y-5 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-navy">Candidate Added Successfully!</h4>
                  <p className="text-xs text-muted mt-1">
                    Candidate ID <strong className="font-mono text-primary font-bold">{createdCandidate.id}</strong> has been registered into Stage 1 (Application Received).
                  </p>
                </div>

                <div className="p-4 bg-canvas rounded-xl border border-borderline max-w-md mx-auto text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Full Name:</span>
                    <span className="font-bold text-navy">{createdCandidate.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Mobile Number:</span>
                    <span className="font-bold text-navy">{createdCandidate.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Job Requisition:</span>
                    <span className="font-mono font-bold text-primary">{createdCandidate.requisitionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Initial Stage:</span>
                    <span className="font-semibold text-emerald-700">Application Received (Planned Today)</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <a
                    href={getWhatsAppInviteUrl(createdCandidate)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Application Link via WhatsApp</span>
                  </a>
                  <button
                    onClick={() => handleStartEditCandidate(createdCandidate)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-primary border border-indigo-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Candidate Details</span>
                  </button>
                  <button
                    onClick={resetForm}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
                {submitError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                    {submitError}
                  </div>
                )}

                {/* Row 1: Target Requisition (Crucial Anchor) */}
                <div className="space-y-1">
                  <label className="font-semibold text-navy flex items-center justify-between">
                    <span>
                      Target Job Requisition <span className="text-rose-500">*</span>
                    </span>
                    {onNavigateToRequisitions && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddOpen(false);
                          onNavigateToRequisitions();
                        }}
                        className="text-[11px] text-primary hover:underline font-normal cursor-pointer"
                      >
                        Browse Requisitions →
                      </button>
                    )}
                  </label>
                  <select
                    required
                    value={formReqId}
                    onChange={(e) => handleReqSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  >
                    <option value="">-- Select Active Job Requisition --</option>
                    {requisitions
                      .filter((r) => r.status.toLowerCase() === "open" || r.id === formReqId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id}: {r.jobTitle} ({r.department} · {r.workLocation || r.location})
                        </option>
                      ))}
                  </select>
                </div>

                {/* When in Edit Mode: Current Stage & Status selectors */}
                {editingCandidateId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="space-y-1">
                      <label className="font-semibold text-navy">Pipeline Stage</label>
                      <select
                        value={formStage}
                        onChange={(e) => setFormStage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-navy font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        {STAGES_LIST.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-navy">Candidate Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-navy font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Hired">Hired</option>
                        <option value="Dropped">Dropped</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Row 2: Full Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">
                      Candidate Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-navy">
                      Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. 9820012345 or +91 98200 12345"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Row 3: Email & Experience */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="candidate@example.com"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Experience (Years / Background)</label>
                    <input
                      type="text"
                      value={formExperience}
                      onChange={(e) => setFormExperience(e.target.value)}
                      placeholder="e.g. 3 Years, Fresher, 5+ Yrs Salon"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Row 4: Source & Notice Period */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Source Channel</label>
                    <select
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {SOURCE_CHANNELS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Notice Period</label>
                    <input
                      type="text"
                      value={formNoticePeriod}
                      onChange={(e) => setFormNoticePeriod(e.target.value)}
                      placeholder="e.g. Immediate, 15 Days, 1 Month"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                    />
                  </div>
                </div>

                {/* Row 5: Current & Preferred Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Current Location / City</label>
                    <input
                      type="text"
                      value={formCurrentLoc}
                      onChange={(e) => setFormCurrentLoc(e.target.value)}
                      placeholder="e.g. Andheri, Mumbai"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Preferred Salon Branch</label>
                    <input
                      type="text"
                      value={formPreferredLoc}
                      onChange={(e) => setFormPreferredLoc(e.target.value)}
                      placeholder="e.g. Bandra Salon, Juhu, South Bombay"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                    />
                  </div>
                </div>

                {/* Row 6: Compensation details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Current Salary (CTC)</label>
                    <input
                      type="text"
                      value={formCurrentCtc}
                      onChange={(e) => setFormCurrentCtc(e.target.value)}
                      placeholder="e.g. ₹35,000 / mo or ₹4.2 LPA"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-navy">Expected Salary (CTC)</label>
                    <input
                      type="text"
                      value={formExpectedCtc}
                      onChange={(e) => setFormExpectedCtc(e.target.value)}
                      placeholder="e.g. ₹45,000 / mo or ₹5.5 LPA"
                      className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                    />
                  </div>
                </div>

                {/* Row 7: Resume Link & Skills */}
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Resume URL or Portfolio Link</label>
                  <input
                    type="url"
                    value={formResumeLink}
                    onChange={(e) => setFormResumeLink(e.target.value)}
                    placeholder="https://drive.google.com/... or LinkedIn CV"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Core Skills & Specializations</label>
                  <input
                    type="text"
                    value={formSkills}
                    onChange={(e) => setFormSkills(e.target.value)}
                    placeholder="e.g. Hair Extensions, Hair Patch, Consultation, Client Relations"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Initial Intake Notes & Observations</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="First impressions, communication style, candidate motivation..."
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-borderline flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg bg-canvas border border-borderline text-navy hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/95 font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingCandidateId ? "Save Changes" : "Submit Candidate & Place in Stage 1"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* CANDIDATE 360° PROFILE DRAWER */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-navy/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-xl h-full shadow-2xl border-l border-borderline flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {selectedCandidate.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      selectedCandidate.brand === "alchamae"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {selectedCandidate.brand === "alchamae" ? "ALC" : "AHL"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-navy mt-1">{selectedCandidate.fullName}</h3>
                <p className="text-xs text-muted">{selectedCandidate.position || "Applicant"}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartEditCandidate(selectedCandidate)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-borderline text-navy hover:text-primary hover:border-primary/40 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                  title="Edit Candidate Information"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-muted hover:text-navy p-1.5 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Quick Contact & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedCandidate.phone && (
                  <>
                    <a
                      href={getWhatsAppInviteUrl(selectedCandidate)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Form Link</span>
                    </a>
                    <a
                      href={`tel:${selectedCandidate.phone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call {selectedCandidate.phone}</span>
                    </a>
                  </>
                )}
                {selectedCandidate.resumeLink && (
                  <a
                    href={selectedCandidate.resumeLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-primary hover:bg-indigo-100 font-semibold border border-indigo-200 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Resume</span>
                  </a>
                )}
              </div>

              {/* Status & Requisition Overview */}
              <div className="bg-canvas p-4 rounded-xl border border-borderline space-y-2.5">
                <div className="text-[10px] font-bold uppercase text-muted tracking-wider">
                  Recruitment Alignment
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted block text-[11px]">Current Stage</span>
                    <span className="font-bold text-navy">{selectedCandidate.currentStage}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Lifecycle Status</span>
                    <span className="font-bold text-emerald-700">{selectedCandidate.status}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Linked Requisition</span>
                    <span className="font-mono font-bold text-primary">
                      {selectedCandidate.requisitionId || "Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Source Channel</span>
                    <span className="font-semibold text-navy">{selectedCandidate.source || "Direct"}</span>
                  </div>
                </div>
              </div>

              {/* Professional Profile */}
              <div className="space-y-3">
                <h4 className="font-bold text-navy text-xs uppercase tracking-wider text-muted">
                  Professional Experience
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted block text-[11px]">Experience</span>
                    <span className="font-semibold text-navy">{selectedCandidate.experience || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Notice Period</span>
                    <span className="font-semibold text-navy">{selectedCandidate.noticePeriod || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Current Company</span>
                    <span className="font-semibold text-navy">{selectedCandidate.currentCompany || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Current CTC</span>
                    <span className="font-semibold text-navy">{selectedCandidate.currentSalary || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Expected CTC</span>
                    <span className="font-semibold text-emerald-700">{selectedCandidate.expectedSalary || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Location</span>
                    <span className="font-semibold text-navy">
                      {[selectedCandidate.area, selectedCandidate.city].filter(Boolean).join(", ") || "Mumbai"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills Tags */}
              {selectedCandidate.skills && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-navy text-xs uppercase tracking-wider text-muted">
                    Skills & Competencies
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate.skills.split(",").map((sk, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-indigo-50 text-primary border border-indigo-100 px-2 py-0.5 rounded font-medium"
                      >
                        {sk.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* KYC & Documentation Data if captured */}
              {selectedCandidate.personalDetails && (
                <div className="space-y-3 pt-3 border-t border-borderline">
                  <h4 className="font-bold text-navy text-xs uppercase tracking-wider text-muted">
                    KYC & Identity Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted block">Aadhaar Card:</span>
                      <span className="font-mono font-medium text-navy">
                        {selectedCandidate.personalDetails.aadharCardNumber || "Pending Collection"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">PAN Card:</span>
                      <span className="font-mono font-medium text-navy">
                        {selectedCandidate.personalDetails.panNumber || "Pending Collection"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Bank Name:</span>
                      <span className="font-medium text-navy">
                        {selectedCandidate.personalDetails.bankName || "Pending Collection"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Account Number:</span>
                      <span className="font-mono font-medium text-navy">
                        {selectedCandidate.personalDetails.accountNumber || "Pending Collection"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCandidate.notes && (
                <div className="space-y-1.5 pt-3 border-t border-borderline">
                  <h4 className="font-bold text-navy text-xs uppercase tracking-wider text-muted">
                    Notes & Observations
                  </h4>
                  <div className="p-3 bg-canvas rounded-lg text-slate-700 text-xs whitespace-pre-wrap leading-relaxed border border-borderline">
                    {selectedCandidate.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
