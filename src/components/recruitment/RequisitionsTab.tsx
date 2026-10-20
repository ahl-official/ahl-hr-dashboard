"use client";

import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  MapPin,
  Calendar,
  Building,
  DollarSign,
  ChevronDown,
  X,
  Loader2,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import type { FmsRequisition } from "@/types/fms";

interface RequisitionsTabProps {
  onSelectRequisition?: (req: FmsRequisition) => void;
}

const DEPARTMENTS_LIST = [
  "Salon Operations",
  "Hair Specialists & Stylists",
  "Trichology & Clinical",
  "Front Desk & Guest Experience",
  "Sales & Consultations",
  "Digital Marketing & Creatives",
  "Human Resources",
  "Finance & Accounts",
  "Warehouse & Inventory",
  "Operations & Maintenance",
];

export default function RequisitionsTab({ onSelectRequisition }: RequisitionsTabProps) {
  const [requisitions, setRequisitions] = useState<FmsRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & View state
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [brandFilter, setBrandFilter] = useState<string>("All");

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit / Details Modal state
  const [selectedReq, setSelectedReq] = useState<FmsRequisition | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDept, setFormDept] = useState("Salon Operations");
  const [formBrand, setFormBrand] = useState<"ahl" | "alchamae" | "both">("ahl");
  const [formOpenings, setFormOpenings] = useState(1);
  const [formPriority, setFormPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [formMinExp, setFormMinExp] = useState("1");
  const [formMaxExp, setFormMaxExp] = useState("4");
  const [formBudget, setFormBudget] = useState("");
  const [formLocation, setFormLocation] = useState("Mumbai");
  const [formWorkLocation, setFormWorkLocation] = useState("Bandra Salon");
  const [formHiringManager, setFormHiringManager] = useState("");
  const [formRecruiter, setFormRecruiter] = useState("");
  const [formTargetStart, setFormTargetStart] = useState("");
  const [formReason, setFormReason] = useState("New Headcount");
  const [formSkills, setFormSkills] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchRequisitions = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recruitment/requisitions");
      const json = await res.json();
      if (json.success && json.data) {
        setRequisitions(json.data.requisitions || []);
      } else {
        setError(json.message || "Failed to load requisitions");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error loading requisitions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Summary Metrics
  const openRequisitions = requisitions.filter((r) => r.status.toLowerCase() === "open");
  const totalOpenings = openRequisitions.reduce((acc, r) => acc + (Number(r.openings) || 1), 0);
  const urgentCount = openRequisitions.filter((r) => r.priority.toLowerCase() === "high").length;
  const filledCount = requisitions.filter(
    (r) => r.status.toLowerCase() === "filled" || r.status.toLowerCase() === "closed"
  ).length;

  // Filtered List
  const filtered = requisitions.filter((r) => {
    if (statusFilter !== "All" && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (deptFilter !== "All" && r.department.toLowerCase() !== deptFilter.toLowerCase()) return false;
    if (priorityFilter !== "All" && r.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
    if (brandFilter !== "All") {
      const b = (r.brand || "ahl").toLowerCase();
      if (brandFilter === "ahl" && b !== "ahl" && b !== "both") return false;
      if (brandFilter === "alchamae" && b !== "alchamae" && b !== "both") return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.id.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.hiringManager && r.hiringManager.toLowerCase().includes(q)) ||
        (r.requiredSkills && r.requiredSkills.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setCreateError("Job Title is required");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/recruitment/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: formTitle.trim(),
          department: formDept,
          brand: formBrand,
          openings: Number(formOpenings) || 1,
          priority: formPriority,
          minExp: formMinExp,
          maxExp: formMaxExp,
          budget: formBudget.trim(),
          location: formLocation.trim(),
          workLocation: formWorkLocation.trim(),
          hiringManager: formHiringManager.trim(),
          recruiterName: formRecruiter.trim(),
          targetStart: formTargetStart,
          reason: formReason,
          requiredSkills: formSkills.trim(),
          jobDescription: formDescription.trim(),
          notes: formNotes.trim(),
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setRequisitions((prev) => [json.data, ...prev]);
        setIsCreateOpen(false);
        // Reset form
        setFormTitle("");
        setFormBudget("");
        setFormSkills("");
        setFormDescription("");
        setFormNotes("");
      } else {
        setCreateError(json.message || "Failed to create requisition");
      }
    } catch (err: any) {
      setCreateError(err.message || "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/recruitment/requisitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          updates: { status: newStatus },
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setRequisitions((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
        if (selectedReq?.id === id) {
          setSelectedReq({ ...selectedReq, status: newStatus });
        }
      }
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP KPI CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Positions */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Open Positions
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{openRequisitions.length}</div>
          <div className="mt-1 text-xs text-muted flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Actively recruiting</span>
          </div>
        </div>

        {/* Target Vacancies / Openings */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Openings
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{totalOpenings}</div>
          <div className="mt-1 text-xs text-muted">Headcount requested across salons</div>
        </div>

        {/* High Priority */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Urgent / High Priority
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600">{urgentCount}</div>
          <div className="mt-1 text-xs text-muted">Immediate hiring focus</div>
        </div>

        {/* Filled / Closed */}
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Filled / Closed
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{filledCount}</div>
          <div className="mt-1 text-xs text-muted">Positions successfully staffed</div>
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
            placeholder="Search by role, req ID, department, manager..."
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

        {/* Filter Dropdowns & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open Only</option>
            <option value="Filled">Filled</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[140px] truncate"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS_LIST.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-canvas border border-borderline rounded-lg text-navy font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-surface text-primary shadow-xs font-semibold" : "text-muted hover:text-navy"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-surface text-primary shadow-xs font-semibold" : "text-muted hover:text-navy"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchRequisitions(true)}
            disabled={refreshing}
            title="Refresh Requisitions"
            className="p-2 text-muted hover:text-primary hover:bg-canvas rounded-lg border border-borderline transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Create Button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* LOADING & ERROR STATES */}
      {/* ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-surface rounded-xl p-12 border border-borderline shadow-card flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-semibold text-navy">Loading Job Requisitions...</p>
          <p className="text-xs text-muted mt-1">Retrieving vacancies and headcount targets</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => fetchRequisitions(false)}
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
          <Briefcase className="w-10 h-10 text-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy">No Requisitions Found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "All" || deptFilter !== "All"
              ? "No job requisitions match your active search filters. Try clearing filters."
              : "No hiring requisitions have been logged yet. Create your first opening to begin recruiting."}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Requisition</span>
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW MODE: GRID CARDS */}
      {/* ────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((req) => {
            const isOpen = req.status.toLowerCase() === "open";
            const isFilled = req.status.toLowerCase() === "filled" || req.status.toLowerCase() === "closed";
            const isHighPriority = req.priority.toLowerCase() === "high";

            return (
              <div
                key={req.id}
                className="bg-surface rounded-xl border border-borderline p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Req ID & Brand Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {req.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          req.brand?.toLowerCase() === "alchamae"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {req.brand?.toLowerCase() === "alchamae" ? "ALC" : "AHL"}
                      </span>
                    </div>

                    {/* Priority Badge */}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        isHighPriority
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : req.priority.toLowerCase() === "medium"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {isHighPriority && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>}
                      <span>{req.priority}</span>
                    </span>
                  </div>

                  {/* Job Title & Department */}
                  <h3 className="text-base font-bold text-navy group-hover:text-primary transition-colors leading-snug">
                    {req.jobTitle}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted mt-1">
                    <Building className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-slate-700">{req.department}</span>
                    {req.jobLevel && (
                      <>
                        <span>•</span>
                        <span>{req.jobLevel}</span>
                      </>
                    )}
                  </div>

                  {/* Key Stats Pills */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-borderline text-xs">
                    <div className="bg-canvas p-2 rounded-lg">
                      <span className="text-[10px] text-muted block uppercase font-medium">Openings</span>
                      <span className="font-bold text-navy flex items-center gap-1">
                        <Users className="w-3 h-3 text-primary" />
                        {req.openings || 1} {Number(req.openings) === 1 ? "Vacancy" : "Vacancies"}
                      </span>
                    </div>

                    <div className="bg-canvas p-2 rounded-lg">
                      <span className="text-[10px] text-muted block uppercase font-medium">Experience</span>
                      <span className="font-bold text-navy">
                        {req.minExp || "0"} - {req.maxExp || "3"} Years
                      </span>
                    </div>
                  </div>

                  {/* Location & Budget Details */}
                  <div className="space-y-1.5 mt-3 text-xs text-slate-600">
                    {(req.workLocation || req.location) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span className="truncate">{req.workLocation || req.location}</span>
                      </div>
                    )}
                    {req.budget && (
                      <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>{req.budget}</span>
                      </div>
                    )}
                    {req.hiringManager && (
                      <div className="text-[11px] text-muted">
                        Manager: <span className="font-semibold text-navy">{req.hiringManager}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags */}
                  {req.requiredSkills && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {req.requiredSkills
                        .split(",")
                        .slice(0, 3)
                        .map((sk, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium"
                          >
                            {sk.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Status & Action */}
                <div className="mt-4 pt-3 border-t border-borderline flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        isOpen ? "bg-emerald-500" : isFilled ? "bg-blue-500" : "bg-slate-400"
                      }`}
                    ></span>
                    <span
                      className={`text-xs font-bold ${
                        isOpen ? "text-emerald-700" : isFilled ? "text-blue-700" : "text-slate-600"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedReq(req)}
                    className="text-xs font-semibold text-primary hover:text-navy hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View / Manage</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
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
                  <th className="py-3 px-4">Req ID</th>
                  <th className="py-3 px-4">Job Title & Brand</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Openings</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">{req.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-navy">{req.jobTitle}</div>
                      <div className="text-[10px] text-muted uppercase font-semibold">
                        {req.brand === "alchamae" ? "Alchemane" : "American Hairline"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">{req.department}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-navy">{req.openings || 1}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          req.priority.toLowerCase() === "high"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{req.workLocation || req.location || "Mumbai"}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          req.status.toLowerCase() === "open"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : req.status.toLowerCase() === "filled"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedReq(req)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE REQUISITION */}
      {/* ────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-borderline shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-navy flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Create Job Requisition
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Request new headcount or replacement vacancies for the team
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted hover:text-navy p-1 rounded-lg hover:bg-canvas transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                  {createError}
                </div>
              )}

              {/* Row 1: Title & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-navy">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Senior Hair Stylist, Trichologist, Front Desk Executive"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Brand</label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value as any)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ahl">American Hairline</option>
                    <option value="alchamae">Alchemane</option>
                    <option value="both">Both Brands</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Department & Openings & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DEPARTMENTS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Openings (Vacancies)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formOpenings}
                    onChange={(e) => setFormOpenings(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Hiring Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="High">High (Urgent)</option>
                    <option value="Medium">Medium (Standard)</option>
                    <option value="Low">Low (Future Pipeline)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Experience & Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Min Experience (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinExp}
                    onChange={(e) => setFormMinExp(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Max Experience (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={formMaxExp}
                    onChange={(e) => setFormMaxExp(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Budget / Salary Range</label>
                  <input
                    type="text"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    placeholder="e.g. ₹40,000 - ₹50,000 / mo"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                  />
                </div>
              </div>

              {/* Row 4: Work Location & Hiring Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-navy">Salon / Work Location</label>
                  <input
                    type="text"
                    value={formWorkLocation}
                    onChange={(e) => setFormWorkLocation(e.target.value)}
                    placeholder="e.g. Bandra Salon, Juhu Salon, Head Office"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Hiring Manager</label>
                  <input
                    type="text"
                    value={formHiringManager}
                    onChange={(e) => setFormHiringManager(e.target.value)}
                    placeholder="e.g. Rakesh Sir, Clinic Head"
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-navy">Target Start Date</label>
                  <input
                    type="date"
                    value={formTargetStart}
                    onChange={(e) => setFormTargetStart(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy"
                  />
                </div>
              </div>

              {/* Row 5: Skills */}
              <div className="space-y-1">
                <label className="font-semibold text-navy">Required Skills (Comma separated)</label>
                <input
                  type="text"
                  value={formSkills}
                  onChange={(e) => setFormSkills(e.target.value)}
                  placeholder="e.g. Hair Extensions, Consultation, Client Retention, Hair Systems"
                  className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                />
              </div>

              {/* Row 6: Description & Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-navy">Job Description & Notes</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Responsibilities, requirements, shift timings, or special expectations..."
                  className="w-full px-3 py-2 bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-borderline flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 font-semibold text-muted hover:text-navy rounded-lg hover:bg-canvas transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 font-semibold rounded-lg bg-primary text-white hover:bg-primary/95 transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Requisition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: VIEW / MANAGE DETAILS */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-borderline shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-borderline flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  {selectedReq.id}
                </span>
                <h3 className="text-base font-bold text-navy mt-1">{selectedReq.jobTitle}</h3>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-muted hover:text-navy p-1 rounded-lg hover:bg-canvas"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Status & Change Status */}
              <div className="bg-canvas p-3.5 rounded-xl border border-borderline flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted uppercase font-bold block">Status</span>
                  <span
                    className={`text-xs font-bold ${
                      selectedReq.status.toLowerCase() === "open"
                        ? "text-emerald-700"
                        : selectedReq.status.toLowerCase() === "filled"
                        ? "text-blue-700"
                        : "text-slate-600"
                    }`}
                  >
                    {selectedReq.status}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    disabled={updatingStatus || selectedReq.status === "Open"}
                    onClick={() => handleUpdateStatus(selectedReq.id, "Open")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-40"
                  >
                    Set Open
                  </button>
                  <button
                    disabled={updatingStatus || selectedReq.status === "Filled"}
                    onClick={() => handleUpdateStatus(selectedReq.id, "Filled")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-100 text-blue-800 hover:bg-blue-200 disabled:opacity-40"
                  >
                    Set Filled
                  </button>
                  <button
                    disabled={updatingStatus || selectedReq.status === "Cancelled"}
                    onClick={() => handleUpdateStatus(selectedReq.id, "Cancelled")}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-200 text-slate-800 hover:bg-slate-300 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Department</span>
                  <span className="font-semibold text-navy">{selectedReq.department}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Brand</span>
                  <span className="font-semibold text-navy uppercase">{selectedReq.brand}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Openings</span>
                  <span className="font-semibold text-navy">{selectedReq.openings || 1}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Priority</span>
                  <span className="font-semibold text-navy">{selectedReq.priority}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Experience</span>
                  <span className="font-semibold text-navy">
                    {selectedReq.minExp || "0"} - {selectedReq.maxExp || "3"} Yrs
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Budget</span>
                  <span className="font-semibold text-navy">{selectedReq.budget || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Location</span>
                  <span className="font-semibold text-navy">
                    {selectedReq.workLocation || selectedReq.location || "Mumbai"}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">Hiring Manager</span>
                  <span className="font-semibold text-navy">{selectedReq.hiringManager || "—"}</span>
                </div>
              </div>

              {selectedReq.requiredSkills && (
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-1">Required Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedReq.requiredSkills.split(",").map((s, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedReq.jobDescription && (
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold mb-1">Description / Notes</span>
                  <p className="text-slate-700 bg-canvas p-2.5 rounded-lg border border-borderline leading-relaxed">
                    {selectedReq.jobDescription}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-borderline flex justify-end">
                <button
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-1.5 font-semibold bg-slate-100 text-navy rounded-lg hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
