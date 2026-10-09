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

export default function RecruitmentPage() {
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
      if (json.success && Array.isArray(json.data)) {
        setActiveICPs(json.data.filter((i: any) => i.status === "active"));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCandidates(true);
    fetchICPs();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setFormResumeText(`Parsed content from ${file.name} (${Math.round(file.size / 1024)} KB)\n\n${text.slice(0, 3000)}`);
    } catch (err) {
      setFormResumeText(`Uploaded: ${file.name}`);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError("");
    if (!formName.trim() || !formMobile.trim() || !formPosition.trim()) {
      setGenerateError("Please enter candidate name, mobile, and position.");
      return;
    }

    setGenerating(true);
    try {
      const cleanCustomQuestions = customQuestions
        .map((q) => q.trim())
        .filter(Boolean);

      const res = await fetch("/api/recruitment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          mobile: formMobile.trim(),
          email: formEmail.trim(),
          position: formPosition.trim(),
          experience: formExperience.trim(),
          resumeText: formResumeText.trim(),
          timeLimit: Number(timeLimit) || 15,
          mustCheckSkills: mustCheckSkills.trim(),
          customQuestions: cleanCustomQuestions,
          assessmentType,
          selectedIcpId,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setGeneratedResult(json.data);
      await fetchCandidates();
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate assessment.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openCandidateDetail = async (c: any) => {
    setSelectedCandidate(c);
    setLoadingDisc(true);
    try {
      const res = await fetch(`/api/recruitment/disc?id=${encodeURIComponent(c.id || c.candidateId)}`);
      const json = await res.json();
      if (json.success) setPsychometricData(json.data);
      else setPsychometricData(null);
    } catch (e) {
      setPsychometricData(null);
    } finally {
      setLoadingDisc(false);
    }
  };

  const handleSendDiscLink = async (candidateId: string) => {
    try {
      const res = await fetch("/api/recruitment/disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidateId }),
      });
      const json = await res.json();
      if (json.success) {
        alert("DISC assessment link recorded and WhatsApp invitation sent!");
        if (selectedCandidate) openCandidateDetail(selectedCandidate);
        fetchCandidates();
      }
    } catch (e) {
      alert("Failed to send DISC assessment link.");
    }
  };

  const handleDeleteCandidate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this candidate assessment?")) return;
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

      {/* Tabs Navigation (Exact HireOS 4 Tabs) */}
      <div className="flex items-center justify-between border-b border-borderline pb-1">
        <div className="flex space-x-1.5 sm:space-x-2">
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
                  className={`px-3 py-1 rounded-md transition-all ${
                    assessmentType === "normal" ? "bg-white text-primary shadow-xs" : "text-muted hover:text-navy"
                  }`}
                >
                  Technical
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentType("icp")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    assessmentType === "icp" ? "bg-white text-primary shadow-xs" : "text-muted hover:text-navy"
                  }`}
                >
                  ICP Culture-Fit
                </button>
              </div>
            </div>

            {generateError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                {generateError}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              {assessmentType === "icp" && (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                  <label className="block text-xs font-bold text-primary mb-1">Select Ideal Candidate Profile (ICP)</label>
                  <select
                    value={selectedIcpId}
                    onChange={(e) => {
                      setSelectedIcpId(e.target.value);
                      const chosen = activeICPs.find((i) => i.icpId === e.target.value);
                      if (chosen && !formPosition) setFormPosition(chosen.roleName);
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-borderline bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Choose Target ICP Profile --</option>
                    {activeICPs.map((icp) => (
                      <option key={icp.icpId} value={icp.icpId}>
                        {icp.roleName} (v{icp.version})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Candidate Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Candidate Name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">WhatsApp Mobile *</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Applied Position *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AI Engineer / Video Editor"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Experience / Background</label>
                  <input
                    type="text"
                    placeholder="e.g. 3 years in React, Python"
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Time Limit & Must-Check Skills Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Interview Time Limit *
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-navy cursor-pointer"
                  >
                    <option value="15">15 Minutes (Express - 4-5 Questions)</option>
                    <option value="20">20 Minutes (Standard Technical)</option>
                    <option value="30">30 Minutes (Comprehensive Evaluation)</option>
                    <option value="45">45 Minutes (Deep Technical Architecture)</option>
                    <option value="60">60 Minutes (Full Leadership / Comprehensive)</option>
                  </select>
                  <p className="text-[10px] text-muted mt-1">
                    Enforced timer during the interview session.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Must-Check Tools / Skills (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CapCut, Premiere, Python, System Design"
                    value={mustCheckSkills}
                    onChange={(e) => setMustCheckSkills(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    AI will formulate specific evaluation probes targeting these tools.
                  </p>
                </div>
              </div>

              {/* Custom Questions Section */}
              <div className="pt-3 border-t border-borderline space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-navy flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-primary" />
                      Custom Interview Questions (Optional)
                    </label>
                    <p className="text-[11px] text-muted">
                      Add custom questions you want the candidate to answer during the interview.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomQuestion}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-2">
                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted w-6 text-center shrink-0">#{idx + 1}</span>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => handleUpdateCustomQuestion(idx, e.target.value)}
                        placeholder={`e.g. Explain a complex technical challenge you solved recently...`}
                        className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      {customQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomQuestion(idx)}
                          className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 cursor-pointer"
                          title="Remove Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Resume / CV (PDF or Plain Text)</label>
                <div className="border border-dashed border-borderline rounded-xl p-4 bg-canvas text-center">
                  <UploadCloud className="w-5 h-5 text-muted mx-auto mb-1" />
                  <p className="text-xs text-navy font-medium">{fileName ? fileName : "Upload Candidate Resume (PDF / DOCX)"}</p>
                  <input type="file" accept=".pdf,.doc,.docx,.txt" id="cv-upload" className="hidden" onChange={handleFileUpload} />
                  <label
                    htmlFor="cv-upload"
                    className="mt-2.5 inline-block px-3 py-1.5 bg-surface border border-borderline rounded-lg text-xs font-semibold text-navy hover:bg-slate-100 cursor-pointer shadow-xs"
                  >
                    Select File
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Or Paste Resume Excerpts / Specific Topics</label>
                <textarea
                  rows={3}
                  value={formResumeText}
                  onChange={(e) => setFormResumeText(e.target.value)}
                  placeholder="Paste resume summary, required tools, or specific focus areas..."
                  className="w-full text-xs p-3 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all shadow-card flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating AI Assessment Questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate AI Assessment & Candidate Link
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Status Card */}
          <div>
            {generatedResult ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-card space-y-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold">Assessment Created!</h3>
                    <p className="text-[11px] text-emerald-700">Duration: {timeLimit} Mins • Voice Interview</p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-emerald-100 text-xs space-y-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Candidate Test URL:</span>
                  <div className="font-mono text-navy break-all bg-canvas p-2 rounded border border-borderline text-[11px]">
                    {generatedResult.testUrl}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(generatedResult.testUrl)}
                      className="flex-1 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-primary text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedLink ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={generatedResult.testUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 bg-surface hover:bg-slate-100 border border-borderline text-navy text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Preview
                    </a>
                  </div>
                </div>

                <a
                  href={generatedResult.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Send WhatsApp Invite
                </a>

                <div className="pt-2 border-t border-emerald-200">
                  <span className="text-xs font-bold text-emerald-950 block mb-2">
                    {generatedResult.questions?.length || 0} Interview Questions:
                  </span>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {generatedResult.questions.map((q: any, i: number) => (
                      <div key={i} className="bg-white p-2.5 rounded border border-emerald-100 text-[11px]">
                        <span className="font-bold text-primary mr-1">Q{q.id}:</span>
                        <span className="text-navy">{q.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-5 border border-borderline shadow-card space-y-4">
                <h3 className="text-sm font-bold text-navy flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  AI Voice Interview Architecture
                </h3>
                <div className="space-y-3 text-xs text-muted">
                  <div className="p-3 bg-canvas rounded-lg border border-borderline">
                    <strong className="text-navy block mb-0.5">🎙️ Spoken Voice Responses</strong>
                    Candidate speaks answers aloud into their microphone. Live speech-to-text captures their response.
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-borderline">
                    <strong className="text-navy block mb-0.5">✏️ Editable Transcription</strong>
                    After speaking, the transcribed text appears on screen. The candidate can review and edit it to ensure complete accuracy before confirming each answer.
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-borderline">
                    <strong className="text-navy block mb-0.5">⏱️ Selected Time Limit ({timeLimit}m)</strong>
                    Interview strictly enforces a session timer countdown based on your selected limit ({timeLimit} mins).
                  </div>
                  <div className="p-3 bg-canvas rounded-lg border border-borderline">
                    <strong className="text-navy block mb-0.5">🛡️ Anti-Cheating & Proctoring</strong>
                    Continuous tab-switch detection, browser blur tracking, and audit logging to Google Sheets.
                  </div>
                </div>
              </div>
            )}
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
                  placeholder="Search name, mobile, role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* DISC Filter */}
              <select
                value={discFilter}
                onChange={(e) => setDiscFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none"
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
                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedCandidates.length})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
            {loadingResults ? (
              <div className="py-20 text-center text-xs text-muted flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading candidate records...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted">No candidate assessments found matching the filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-borderline text-muted uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">AI Score</th>
                      <th className="px-4 py-3">DISC Profile</th>
                      <th className="px-4 py-3">Anti-Cheat</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderline">
                    {filteredCandidates.map((c) => (
                      <tr
                        key={c.id || c.candidateId}
                        onClick={() => openCandidateDetail(c)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-navy group-hover:text-primary transition-colors">{c.name}</div>
                          <div className="text-[11px] text-muted">{c.mobile}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-navy font-medium">{c.position}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          {c.status === "Completed" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {c.score !== null ? (
                            <span className="font-bold text-xs text-primary">{c.score}%</span>
                          ) : (
                            <span className="text-muted text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {c.discProfile ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-primary font-bold text-[11px]">
                              {c.discProfile}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted">{c.discStatus || "Not Started"}</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {c.tabSwitches > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              <ShieldAlert className="w-3 h-3" />
                              {c.tabSwitches} switches
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium text-[11px]">Clean</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleCopy(c.testUrl)}
                              title="Copy Test URL"
                              className="p-1.5 rounded-md hover:bg-slate-100 text-muted hover:text-navy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteCandidate(e, c.id || c.candidateId)}
                              title="Delete Candidate"
                              className="p-1.5 rounded-md hover:bg-rose-50 text-muted hover:text-rose-600"
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
            )}
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
                  Applied for <strong className="text-navy">{selectedCandidate.position}</strong> • {selectedCandidate.mobile}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReportPdf}
                  className="px-3 py-1.5 bg-white border border-borderline hover:bg-slate-50 text-navy text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF Report
                </button>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div id="candidate-report-printable" className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Executive Summary Card */}
              <div className="bg-canvas rounded-xl p-4 border border-borderline">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Evaluation Score</span>
                  {selectedCandidate.score !== null && (
                    <span className="text-xl font-extrabold text-primary">{selectedCandidate.score}%</span>
                  )}
                </div>
                <p className="text-xs text-navy leading-relaxed bg-white p-3 rounded-lg border border-borderline">
                  {selectedCandidate.aiSummary || "Test pending completion."}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted pt-2 border-t border-borderline">
                  <span>Proctoring: {selectedCandidate.tabSwitches} tab switches logged</span>
                  <span>Date: {selectedCandidate.submittedAt ? new Date(selectedCandidate.submittedAt).toLocaleDateString() : "Pending"}</span>
                </div>
              </div>

              {/* DISC Personality Assessment Component */}
              <PersonalityAssessmentSection
                psychometric={psychometricData}
                loading={loadingDisc}
                onResend={() => handleSendDiscLink(selectedCandidate.id || selectedCandidate.candidateId)}
              />

              {/* Q&A Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Questions & Answers</h4>
                {(selectedCandidate.questions || []).map((q: any, i: number) => (
                  <div key={i} className="bg-canvas rounded-xl p-4 border border-borderline space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">Question {q.id || i + 1}</span>
                      {q.score !== null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-primary">
                          Score: {q.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-navy">{q.question}</p>
                    <div className="pt-2 border-t border-borderline">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                        Candidate Answer:
                      </span>
                      <p className="text-xs text-slate-800 bg-white p-2.5 rounded border border-borderline whitespace-pre-wrap">
                        {q.candidateAnswer || <span className="text-muted italic">No response submitted yet.</span>}
                      </p>
                    </div>
                    {q.feedback && (
                      <div className="text-[11px] text-primary bg-indigo-50 p-2 rounded">
                        <strong>AI Feedback:</strong> {q.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-borderline bg-canvas flex items-center justify-between">
              <button
                onClick={() => handleCopy(selectedCandidate.testUrl)}
                className="px-4 py-2 border border-borderline bg-white hover:bg-slate-50 text-navy text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Test Link
              </button>

              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    name: selectedCandidate.name,
                    mobile: selectedCandidate.mobile,
                    designation: selectedCandidate.position,
                  });
                  router.push(`/add-employee?${params.toString()}`);
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Convert to Employee Onboarding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
