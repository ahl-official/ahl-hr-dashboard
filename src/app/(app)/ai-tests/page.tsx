"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  Users,
  Mic,
  BookOpen,
  CheckCircle,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  Copy,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Trash2,
  ShieldAlert,
  UserPlus,
  X,
  ChevronRight,
  Download,
  UserCheck,
  Plus,
  HelpCircle,
} from "lucide-react";
import IcpTab from "@/components/recruitment/IcpTab";
import AudioReviewTab from "@/components/recruitment/AudioReviewTab";
import PersonalityAssessmentSection from "@/components/recruitment/PersonalityAssessmentSection";
import EmployeeDiscTab from "@/components/recruitment/EmployeeDiscTab";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const DISC_FILTER_OPTIONS = [
  { value: "", label: "All DISC" },
  { value: "pending", label: "Pending" },
  { value: "not_started", label: "Not started" },
  { value: "completed", label: "Completed" },
  { value: "D", label: "D" },
  { value: "Di", label: "Di" },
  { value: "iD", label: "iD" },
  { value: "I", label: "I" },
  { value: "iS", label: "iS" },
  { value: "Si", label: "Si" },
  { value: "S", label: "S" },
  { value: "SC", label: "SC" },
  { value: "CS", label: "CS" },
  { value: "C", label: "C" },
  { value: "CD", label: "CD" },
  { value: "DC", label: "DC" },
];

export default function AiTestsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"generate" | "icp" | "results" | "employee_disc" | "audio">("generate");

  // Candidates & Stats
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, avgScore: 0 });

  // Filters & Selection
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [discFilter, setDiscFilter] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Drawer state
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [psychometricData, setPsychometricData] = useState<any | null>(null);
  const [loadingDisc, setLoadingDisc] = useState(false);

  // Generate Tab Form state
  const [assessmentType, setAssessmentType] = useState<"normal" | "icp">("normal");
  const [activeICPs, setActiveICPs] = useState<any[]>([]);
  const [selectedIcpId, setSelectedIcpId] = useState("");
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formExperience, setFormExperience] = useState("");
  const [formResumeText, setFormResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("15");
  const [mustCheckSkills, setMustCheckSkills] = useState<string>("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([""]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleAddCustomQuestion = () => {
    setCustomQuestions((prev) => [...prev, ""]);
  };

  const handleUpdateCustomQuestion = (index: number, val: string) => {
    setCustomQuestions((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveCustomQuestion = (index: number) => {
    setCustomQuestions((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
  };

  const fetchCandidates = async (showLoading = false) => {
    if (showLoading) setLoadingResults(true);
    try {
      const res = await fetch("/api/recruitment/candidates");
      const json = await res.json();
      if (json.success && json.data) {
        setCandidates(json.data.candidates || []);
        setStats(json.data.stats || { total: 0, completed: 0, pending: 0, avgScore: 0 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResults(false);
    }
  };

  const fetchICPs = async () => {
    try {
      const res = await fetch("/api/recruitment/icp");
      const json = await res.json();
      if (json.success && json.data) {
        setActiveICPs(json.data.filter((i: any) => i.status === "Active"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCandidates(true);
    fetchICPs();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenerateError("");
    setGeneratedResult(null);

    try {
      const questionsCleaned = customQuestions.filter((q) => q.trim() !== "");
      const res = await fetch("/api/recruitment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          mobile: formMobile,
          email: formEmail,
          position: formPosition,
          experience: formExperience,
          resumeText: formResumeText,
          timeLimitMinutes: parseInt(timeLimit) || 15,
          assessmentType,
          icpId: assessmentType === "icp" ? selectedIcpId : undefined,
          mustCheckSkills,
          customQuestions: questionsCleaned,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setGeneratedResult(json.data);
        fetchCandidates();
      } else {
        setGenerateError(json.message || "Failed to generate assessment");
      }
    } catch (err: any) {
      setGenerateError(err.message || "Network error occurred");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenCandidateDrawer = async (c: any) => {
    setSelectedCandidate(c);
    setPsychometricData(null);
    setLoadingDisc(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${c.id}`);
      const json = await res.json();
      if (json.success && json.data?.candidate) {
        setSelectedCandidate(json.data.candidate);
        setPsychometricData(json.data.psychometric || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDisc(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this candidate test?")) return;
    setIsDeleting(true);
    try {
      await fetch("/api/recruitment/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSelectedCandidates((prev) => prev.filter((x) => x !== id));
      await fetchCandidates();
      if (selectedCandidate?.id === id) setSelectedCandidate(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCandidates.length} candidate(s)?`)) return;
    setIsDeleting(true);
    try {
      await fetch("/api/recruitment/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedCandidates }),
      });
      setSelectedCandidates([]);
      await fetchCandidates();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadReportPdf = async () => {
    const el = document.getElementById("candidate-report-printable");
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedCandidate?.name || "Candidate"}-Evaluation-Report.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    if (positionFilter && !c.position?.toLowerCase().includes(positionFilter.toLowerCase())) return false;
    if (search) {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.position.toLowerCase().includes(search.toLowerCase()) ||
        c.mobile.includes(search);
      if (!matchSearch) return false;
    }
    if (!discFilter) return true;
    const status = String(c.discStatus || "Not Started").trim().toLowerCase();
    const profile = String(c.discProfile || "").trim();
    if (discFilter === "pending") return status === "pending";
    if (discFilter === "not_started") return status === "not started" || status === "";
    if (discFilter === "completed") return status === "completed";
    return status === "completed" && profile === discFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Total Tests</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{stats.total}</div>
          <div className="mt-1 text-xs text-muted">Created assessments</div>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{stats.completed}</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">
            {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% completion rate` : "Ready"}
          </div>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{stats.pending}</div>
          <div className="mt-1 text-xs text-amber-600 font-medium">Awaiting submission</div>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Avg Score</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-navy">{stats.avgScore > 0 ? `${stats.avgScore}%` : "—"}</div>
          <div className="mt-1 text-xs text-muted">AI graded performance</div>
        </div>
      </div>

      {/* Tabs Navigation: Exact 5 Tabs Requested */}
      <div className="flex items-center justify-between border-b border-borderline pb-1">
        <div className="flex space-x-1.5 sm:space-x-2 overflow-x-auto">
          {[
            { key: "generate", label: "Generate Assessment", icon: FilePlus2 },
            { key: "icp", label: "ICPs (Profiles)", icon: BookOpen },
            { key: "results", label: `Candidate Results (${candidates.length})`, icon: Users },
            { key: "employee_disc", label: "Employee DISC", icon: UserCheck },
            { key: "audio", label: "Audio Review", icon: Mic },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  isActive ? "bg-primary text-white shadow-sm" : "text-muted hover:text-navy hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => fetchCandidates(true)}
          disabled={loadingResults}
          className="text-xs text-muted hover:text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borderline hover:bg-surface transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingResults ? "animate-spin text-primary" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: GENERATE ASSESSMENT */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface rounded-xl p-6 border border-borderline shadow-card space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Generate Candidate Assessment
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Tailored technical questions, optional ICP alignment, and proctoring
                </p>
              </div>

              {/* Assessment Mode Selector */}
              <div className="flex bg-canvas p-1 rounded-lg border border-borderline text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAssessmentType("normal")}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    assessmentType === "normal"
                      ? "bg-surface text-primary shadow-xs font-bold"
                      : "text-muted hover:text-navy"
                  }`}
                >
                  Standard Test
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentType("icp")}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                    assessmentType === "icp"
                      ? "bg-surface text-primary shadow-xs font-bold"
                      : "text-muted hover:text-navy"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>ICP Profile Match</span>
                </button>
              </div>
            </div>

            {generateError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{generateError}</span>
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              {assessmentType === "icp" && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                  <label className="text-xs font-bold text-navy flex items-center justify-between">
                    <span>Select Ideal Candidate Profile (ICP)</span>
                    <span className="text-[10px] text-primary font-normal">Auto-aligns test rubrics</span>
                  </label>
                  <select
                    value={selectedIcpId}
                    onChange={(e) => {
                      setSelectedIcpId(e.target.value);
                      const chosen = activeICPs.find((i) => i.id === e.target.value);
                      if (chosen) {
                        setFormPosition(chosen.roleTitle);
                        setMustCheckSkills(chosen.coreSkills);
                      }
                    }}
                    required
                    className="w-full text-xs bg-surface border border-indigo-200 rounded-lg p-2.5 text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose an Active ICP --</option>
                    {activeICPs.map((icp) => (
                      <option key={icp.id} value={icp.id}>
                        {icp.roleTitle} ({icp.experienceYears} yrs)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">
                    Candidate Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">
                    WhatsApp Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="e.g. 9876543210 (10 digits)"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">
                    Position Applied For <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="e.g. Senior Stylist"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">Experience (Years)</label>
                  <input
                    type="text"
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    placeholder="e.g. 3.5"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-navy flex items-center justify-between">
                  <span>Resume Content or Key Highlights</span>
                  <span className="text-[10px] text-muted">Paste text or summary</span>
                </label>
                <textarea
                  rows={4}
                  value={formResumeText}
                  onChange={(e) => setFormResumeText(e.target.value)}
                  placeholder="Paste candidate background, previous roles, techniques mastered, or portfolio notes..."
                  className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">Time Limit (Minutes)</label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="10">10 Minutes (Quick Screening)</option>
                    <option value="15">15 Minutes (Standard)</option>
                    <option value="20">20 Minutes (In-depth Technical)</option>
                    <option value="30">30 Minutes (Senior/Managerial)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-navy">Must-Check Skills</label>
                  <input
                    type="text"
                    value={mustCheckSkills}
                    onChange={(e) => setMustCheckSkills(e.target.value)}
                    placeholder="e.g. Client consultation, patch test, scalp hygiene"
                    className="w-full text-xs bg-canvas border border-borderline rounded-lg p-2.5 text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Custom Questions Section */}
              <div className="space-y-2 pt-2 border-t border-borderline">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-navy flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" />
                    <span>Custom Specific Questions (Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCustomQuestion}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => handleUpdateCustomQuestion(idx, e.target.value)}
                        placeholder={`Custom question #${idx + 1}...`}
                        className="flex-1 text-xs bg-canvas border border-borderline rounded-lg p-2 text-navy focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {customQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomQuestion(idx)}
                          className="text-muted hover:text-rose-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/95 transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Assessment & Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Generation Result Card */}
          <div className="bg-surface rounded-xl p-6 border border-borderline shadow-card flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-navy flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Assessment Dispatch
              </h3>
              <p className="text-xs text-muted mt-1">
                Once generated, the single-use assessment link will appear here ready to copy or send via WhatsApp.
              </p>

              {generatedResult ? (
                <div className="mt-5 space-y-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        Ready to Share
                      </span>
                      <span className="text-xs font-mono font-bold text-navy">
                        {generatedResult.questions?.length || 0} Questions
                      </span>
                    </div>

                    <div className="text-xs font-bold text-navy">{generatedResult.candidate?.name}</div>
                    <div className="text-[11px] text-slate-600">{generatedResult.candidate?.position}</div>

                    <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
                      <input
                        type="text"
                        readOnly
                        value={generatedResult.testUrl}
                        className="flex-1 text-[11px] font-mono bg-white border border-emerald-300 rounded p-1.5 text-slate-700"
                      />
                      <button
                        onClick={() => handleCopyLink(generatedResult.testUrl)}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedLink ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/91${formMobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hello ${formName}, please complete your American Hairline screening assessment using this link: ${generatedResult.testUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send via WhatsApp</span>
                  </a>
                </div>
              ) : (
                <div className="mt-8 text-center py-10 border-2 border-dashed border-borderline rounded-xl">
                  <Sparkles className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-muted">Awaiting generation</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-borderline mt-6 text-[11px] text-muted space-y-1">
              <div>• Questions are tailored by AI using JD & resume.</div>
              <div>• Integrity monitoring tracks tab-switches.</div>
              <div>• Results auto-grade upon test submission.</div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: IDEAL CANDIDATE PROFILES (ICPs) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "icp" && <IcpTab />}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 3: CANDIDATE RESULTS & RECORDS */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "results" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, role, mobile..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-borderline rounded-lg text-navy placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="text-xs bg-canvas border border-borderline rounded-lg px-2.5 py-1.5 text-navy focus:outline-none"
              >
                <option value="">All Roles</option>
                {Array.from(new Set(candidates.map((c) => c.position).filter(Boolean))).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>

              <select
                value={discFilter}
                onChange={(e) => setDiscFilter(e.target.value)}
                className="text-xs bg-canvas border border-borderline rounded-lg px-2.5 py-1.5 text-navy focus:outline-none"
              >
                {DISC_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedCandidates.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedCandidates.length})</span>
              </button>
            )}
          </div>

          {/* Results Table */}
          <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas border-b border-borderline text-[11px] font-bold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCandidates(filteredCandidates.map((c) => c.id));
                          else setSelectedCandidates([]);
                        }}
                      />
                    </th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Integrity (Tab Switches)</th>
                    <th className="py-3 px-4">DISC Profile</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderline">
                  {filteredCandidates.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenCandidateDrawer(c)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCandidates.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCandidates((prev) => [...prev, c.id]);
                            else setSelectedCandidates((prev) => prev.filter((x) => x !== c.id));
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-navy">
                        <div>{c.name}</div>
                        <div className="text-[10px] text-muted font-normal">{c.mobile}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{c.position}</td>
                      <td className="py-3 px-4">
                        {c.score !== null && !isNaN(c.score) ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              c.score >= 75
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : c.score >= 50
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {c.score}%
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {c.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {c.tabSwitches > 0 ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{c.tabSwitches} switch(es)</span>
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">0 switches</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {c.discProfile ? (
                          <span className="font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                            {c.discProfile}
                          </span>
                        ) : (
                          <span className="text-muted text-[10px]">{c.discStatus || "Not Started"}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenCandidateDrawer(c)}
                            className="p-1.5 text-muted hover:text-primary rounded hover:bg-canvas"
                            title="View Full Evaluation"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(c.id)}
                            className="p-1.5 text-muted hover:text-rose-600 rounded hover:bg-canvas"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 4: EMPLOYEE DISC ASSESSMENTS */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "employee_disc" && <EmployeeDiscTab />}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 5: AUDIO REVIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "audio" && <AudioReviewTab />}

      {/* ────────────────────────────────────────────────────────── */}
      {/* CANDIDATE DETAIL PANEL (FULL HIREOS DRAWER) */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-navy/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-3xl bg-surface h-full shadow-2xl flex flex-col border-l border-borderline animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-borderline flex items-center justify-between bg-canvas">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-navy">{selectedCandidate.name}</h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedCandidate.status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedCandidate.status}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {selectedCandidate.position} • {selectedCandidate.mobile}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReportPdf}
                  className="px-3 py-1.5 bg-canvas border border-borderline rounded-lg text-xs font-semibold text-navy hover:bg-surface flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Download Report</span>
                </button>

                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="p-1.5 text-muted hover:text-navy rounded-lg hover:bg-canvas"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" id="candidate-report-printable">
              {/* Score & Integrity Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-canvas p-4 rounded-xl border border-borderline text-center">
                  <span className="text-[10px] font-bold uppercase text-muted">Test Score</span>
                  <div className="text-2xl font-bold text-primary mt-1">
                    {selectedCandidate.score !== null ? `${selectedCandidate.score}%` : "—"}
                  </div>
                </div>

                <div className="bg-canvas p-4 rounded-xl border border-borderline text-center">
                  <span className="text-[10px] font-bold uppercase text-muted">Integrity (Tab Switches)</span>
                  <div
                    className={`text-2xl font-bold mt-1 ${
                      selectedCandidate.tabSwitches > 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {selectedCandidate.tabSwitches || 0}
                  </div>
                </div>

                <div className="bg-canvas p-4 rounded-xl border border-borderline text-center">
                  <span className="text-[10px] font-bold uppercase text-muted">DISC Profile</span>
                  <div className="text-2xl font-bold text-navy mt-1">
                    {selectedCandidate.discProfile || "—"}
                  </div>
                </div>
              </div>

              {/* Personality Section */}
              <PersonalityAssessmentSection
                psychometric={psychometricData}
                loading={loadingDisc}
                onResend={async () => {
                  if (!selectedCandidate) return;
                  try {
                    await fetch(`/api/recruitment/candidates/${selectedCandidate.id}/send-disc`, { method: "POST" });
                    await fetchCandidates();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
