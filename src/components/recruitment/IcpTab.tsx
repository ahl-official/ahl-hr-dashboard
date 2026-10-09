"use client";

import React, { useState, useEffect } from "react";
import { Plus, Save, Loader2, BookOpen, CheckCircle2, AlertTriangle, FileText, Bot } from "lucide-react";

interface ICP {
  icpId: string;
  roleName: string;
  status: string;
  version: string;
  icpContent: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function IcpTab() {
  const [icps, setIcps] = useState<ICP[]>([]);
  const [selectedIcp, setSelectedIcp] = useState<ICP | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: "", text: "" });

  const [formData, setFormData] = useState({
    roleName: "",
    status: "active",
    icpContent: "",
  });

  const fetchICPs = async () => {
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/recruitment/icp");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setIcps(json.data);
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load ICPs from database." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchICPs();
  }, []);

  const handleSelectIcp = (icp: ICP) => {
    setSelectedIcp(icp);
    setFormData({
      roleName: icp.roleName || "",
      status: icp.status || "active",
      icpContent: icp.icpContent || "",
    });
    setMessage({ type: "", text: "" });
  };

  const handleCreateNew = () => {
    setSelectedIcp(null);
    setFormData({
      roleName: "",
      status: "active",
      icpContent: `# IDEAL CANDIDATE PROFILE – ROLE NAME\n\n## 1. BASIC DETAILS\n- Role Name: \n- Department: \n- Target Level: \n\n## 2. CORE RESPONSIBILITIES\n- Key deliverable 1\n- Key deliverable 2\n\n## 3. MANDATORY SKILLS & TOOLS\n- Tool 1\n- Tool 2\n\n## 4. RED FLAGS\n- Indicator 1`,
    });
    setMessage({ type: "", text: "" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roleName.trim()) {
      setMessage({ type: "error", text: "Role Name is required." });
      return;
    }

    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/recruitment/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icpId: selectedIcp?.icpId,
          roleName: formData.roleName.trim(),
          status: formData.status,
          icpContent: formData.icpContent,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setMessage({ type: "success", text: "ICP Profile saved successfully to Google Sheets!" });
      await fetchICPs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save ICP." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left List of ICPs */}
      <div className="bg-surface rounded-xl border border-borderline shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-borderline">
          <div>
            <h3 className="text-sm font-bold text-navy flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Role Profiles ({icps.length})
            </h3>
            <p className="text-[11px] text-muted">Ideal Candidate Profiles library</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New ICP
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Loading profiles...
          </div>
        ) : icps.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">No ICP profiles found. Click "New ICP" to create one.</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {icps.map((icp) => (
              <button
                key={icp.icpId}
                onClick={() => handleSelectIcp(icp)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedIcp?.icpId === icp.icpId
                    ? "bg-indigo-50 border-primary shadow-xs"
                    : "bg-canvas border-borderline hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">{icp.roleName}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      icp.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {icp.status}
                  </span>
                </div>
                <div className="text-[10px] text-muted font-mono mt-1 truncate">{icp.icpId}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Form Editor */}
      <div className="lg:col-span-2 bg-surface rounded-xl border border-borderline shadow-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-borderline mb-4">
          <div>
            <h3 className="text-sm font-bold text-navy">
              {selectedIcp ? `Edit: ${selectedIcp.roleName}` : "Create Ideal Candidate Profile"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Define target skills, competencies, and interview evaluation criteria
            </p>
          </div>
          <Bot className="w-5 h-5 text-primary" />
        </div>

        {message.text && (
          <div
            className={`p-3 rounded-lg mb-4 text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-navy mb-1.5">Role Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Frontend Developer"
                value={formData.roleName}
                onChange={(e) => setFormData((prev) => ({ ...prev, roleName: e.target.value }))}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1.5">
              ICP Content & Evaluation Rubric (Markdown)
            </label>
            <textarea
              rows={14}
              value={formData.icpContent}
              onChange={(e) => setFormData((prev) => ({ ...prev, icpContent: e.target.value }))}
              placeholder="Define competencies, mandatory skills, specific role expectations, and rubric rules..."
              className="w-full text-xs p-3.5 rounded-xl border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving to Sheets...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save ICP Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
