"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileSearch, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { FmsCandidate } from "@/types/fms";
import { pickIcpForPosition, type CvScreeningReport, type IcpOption } from "@/lib/cv-screening";

const VERDICT_STYLE: Record<string, string> = {
  Proceed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Hold: "bg-amber-100 text-amber-800 border-amber-300",
  Reject: "bg-rose-100 text-rose-800 border-rose-300",
};

const scoreTone = (score: number) =>
  score >= 75 ? "text-emerald-700 border-emerald-300 bg-emerald-50" : score >= 50 ? "text-amber-700 border-amber-300 bg-amber-50" : "text-rose-700 border-rose-300 bg-rose-50";

export function getCvScreening(candidate: FmsCandidate): CvScreeningReport | null {
  return (candidate.stageData?.ar?.cvScreening as CvScreeningReport) || null;
}

/** Small "72% · Proceed" badge for pipeline cards. */
export function CvScreeningBadge({ candidate }: { candidate: FmsCandidate }) {
  const report = getCvScreening(candidate);
  if (!report) return null;
  return (
    <span
      title={`AI CV match ${report.matchScore}% · ${report.verdict}`}
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${VERDICT_STYLE[report.verdict] || ""}`}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {report.matchScore}% · {report.verdict}
    </span>
  );
}

export function CvScreeningPanel({
  candidate,
  roleTitles,
  onUpdated,
}: {
  candidate: FmsCandidate;
  roleTitles: string[];
  onUpdated: (candidate: FmsCandidate) => void;
}) {
  const report = getCvScreening(candidate);
  const [open, setOpen] = useState(false);

  const list = (title: string, items: string[], tone: string) =>
    items.length > 0 && (
      <div>
        <h5 className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${tone}`}>{title}</h5>
        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="p-4 rounded-xl border border-borderline bg-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
          <FileSearch className="w-4 h-4 text-primary" />
          AI CV Screening
        </h4>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {report ? "Re-screen CV" : "Screen CV"}
        </button>
      </div>

      {!report ? (
        <p className="text-[11px] text-muted">
          Not screened yet. Upload the CV and the AI checks it against the role&apos;s Ideal Candidate Profile: match,
          strengths, missing skills, red flags, and whether to proceed.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`shrink-0 w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center ${scoreTone(report.matchScore)}`}>
              <span className="text-lg font-bold leading-none">{report.matchScore}</span>
              <span className="text-[9px] font-semibold">match</span>
            </div>
            <div className="space-y-1">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${VERDICT_STYLE[report.verdict]}`}>
                {report.verdict}
              </span>
              <p className="text-slate-700 leading-relaxed">{report.summary}</p>
            </div>
          </div>
          {report.relevantExperience && (
            <p className="text-slate-700">
              <strong className="text-navy">Relevant experience:</strong> {report.relevantExperience}
            </p>
          )}
          {list("Strengths", report.strengths, "text-emerald-700")}
          {list("Missing skills", report.missingSkills, "text-amber-700")}
          {list("Red flags", report.redFlags, "text-rose-700")}
          <p className="text-[10px] text-muted border-t border-borderline pt-2">
            {report.icpRole ? `Checked against ICP "${report.icpRole}" v${report.icpVersion || "1"}` : "No ICP was available — checked against the role details only"}
            {" · "}
            {report.cvSource === "pdf" ? report.cvFileName || "PDF" : "pasted text"}
            {" · "}
            {new Date(report.screenedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      )}

      {open && (
        <ScreenCvModal
          candidate={candidate}
          roleTitles={roleTitles}
          onClose={() => setOpen(false)}
          onDone={(updated) => {
            setOpen(false);
            onUpdated(updated);
          }}
        />
      )}
    </div>
  );
}

function ScreenCvModal({
  candidate,
  roleTitles,
  onClose,
  onDone,
}: {
  candidate: FmsCandidate;
  roleTitles: string[];
  onClose: () => void;
  onDone: (candidate: FmsCandidate) => void;
}) {
  const [icps, setIcps] = useState<IcpOption[]>([]);
  const [icpId, setIcpId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/recruitment/icp")
      .then((r) => r.json())
      .then((json) => setIcps((json.icps || json.data || []).filter((i: IcpOption) => (i.status || "active") === "active")))
      .catch(() => setIcps([]));
  }, []);

  const autoIcp = useMemo(() => pickIcpForPosition(icps, ...roleTitles), [icps, roleTitles]);
  const usedIcp = icpId ? icps.find((i) => i.icpId === icpId) : autoIcp;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("candidateId", candidate.id);
      form.append("icpId", icpId);
      if (file) form.append("file", file);
      else form.append("cvText", cvText);
      const res = await fetch("/api/recruitment/cv-screening", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Screening failed");
      onDone(json.data.candidate);
    } catch (e: any) {
      setError(e.message || "Screening failed");
      setBusy(false);
    }
  };

  const field = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      size="lg"
      title={`Screen CV · ${candidate.fullName}`}
      subtitle={candidate.position || "Position not set"}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 rounded-md border border-borderline bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || (!file && cvText.trim().length < 150)}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? "Screening... (up to a minute)" : "Run AI screening"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ideal Candidate Profile</label>
          <select value={icpId} onChange={(e) => setIcpId(e.target.value)} className={field}>
            <option value="">Automatic{autoIcp ? ` — ${autoIcp.roleName}` : ""}</option>
            {icps.map((i) => (
              <option key={i.icpId} value={i.icpId}>
                {i.roleName} (v{i.version || "1"})
              </option>
            ))}
          </select>
          {!usedIcp && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              No approved ICP matches this position. The SOP asks for one before recruiting — create it in AI Tests → ICP, or pick
              one above. Without it the AI checks against the requisition details only.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CV (PDF)</label>
          <label className="flex items-center gap-2 px-3 py-3 rounded-md border border-dashed border-borderline bg-slate-50 cursor-pointer hover:bg-slate-100">
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            <span className="text-xs text-slate-700 truncate">{file ? file.name : "Choose the CV PDF (max 4 MB)"}</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <button type="button" onClick={() => setFile(null)} className="mt-1 text-xs text-indigo-600 hover:underline">
              Remove file and paste text instead
            </button>
          )}
        </div>

        {!file && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">…or paste the CV text</label>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              rows={7}
              placeholder="Paste the full CV here (needed for scanned PDFs or Word files)"
              className="w-full px-3 py-2 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
            />
          </div>
        )}

        {error && <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
}
