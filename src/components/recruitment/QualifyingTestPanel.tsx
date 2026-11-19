"use client";

import React, { useState } from "react";
import { ClipboardCheck, ExternalLink, Loader2 } from "lucide-react";
import type { FmsCandidate } from "@/types/fms";
import { getTodayLocalIsoDate } from "@/lib/date-utils";
import type { PositionKitRecord } from "@/lib/position-kit";
import {
  TEST_RESULTS,
  TEST_STATUSES,
  getQualifyingTest,
  qualifyingTestLabel,
  qualifyingTestUpdate,
  validateQualifyingTest,
  type QualifyingTestResult,
} from "@/lib/qualifying-test";

const RESULT_STYLE: Record<string, string> = {
  Pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Borderline: "bg-amber-50 text-amber-800 border-amber-200",
  Fail: "bg-rose-50 text-rose-700 border-rose-200",
};

/** "Test: Pass" badge for cards, shown where the Position Kit defines a qualifying test. */
export function QualifyingTestBadge({ candidate, kitHasTest }: { candidate: FmsCandidate; kitHasTest: boolean }) {
  if (!kitHasTest) return null;
  const t = getQualifyingTest(candidate);
  const tone = t?.status === "Completed" ? RESULT_STYLE[t.result] : t?.status === "No-show" ? RESULT_STYLE.Fail : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${tone}`}>
      <ClipboardCheck className="w-2.5 h-2.5" />
      {qualifyingTestLabel(t)}
    </span>
  );
}

export function QualifyingTestPanel({
  candidate,
  kit,
  onSaved,
}: {
  candidate: FmsCandidate;
  kit: PositionKitRecord | null;
  onSaved: (c: FmsCandidate) => void;
}) {
  const saved = getQualifyingTest(candidate);
  const k = kit?.kit;
  const today = getTodayLocalIsoDate();
  const [testType, setTestType] = useState(saved?.testType || k?.qualifyingTestType || "");
  const [status, setStatus] = useState<QualifyingTestResult["status"]>(saved?.status || "Scheduled");
  const [scheduledOn, setScheduledOn] = useState(saved?.scheduledOn || "");
  const [completedOn, setCompletedOn] = useState(saved?.completedOn || today);
  const [evaluator, setEvaluator] = useState(saved?.evaluator || k?.departmentHead || "");
  const [score, setScore] = useState(saved?.score || "");
  const [result, setResult] = useState(saved?.result || "");
  const [feedback, setFeedback] = useState(saved?.feedback || "");
  const [evidenceLink, setEvidenceLink] = useState(saved?.evidenceLink || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const draft = { testType: testType.trim(), status, scheduledOn, completedOn, evaluator: evaluator.trim(), score: score.trim(), result, feedback: feedback.trim(), evidenceLink: evidenceLink.trim() };
    const problem = validateQualifyingTest(draft, today);
    if (problem) return setMessage({ ok: false, text: problem });
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id, updates: qualifyingTestUpdate(candidate, { ...draft, updatedAt: new Date().toISOString() }) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      onSaved(json.data);
      setMessage({ ok: true, text: "Test result saved" });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-2.5 py-1.5 bg-white border border-borderline rounded-md text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const label = "block text-[11px] font-semibold text-navy mb-1";
  const done = status !== "Scheduled";

  return (
    <div className="p-4 rounded-xl border border-borderline bg-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Qualifying Test
        </h4>
        {saved && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${saved.status === "Completed" ? RESULT_STYLE[saved.result] || "" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {qualifyingTestLabel(saved)}
          </span>
        )}
      </div>

      {k?.qualifyingTest ? (
        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 space-y-1 text-[11px] text-slate-700">
          <p className="font-semibold text-indigo-900">
            {kit!.roleName} test{k.qualifyingTestType && ` · ${k.qualifyingTestType}`}
          </p>
          <p className="whitespace-pre-wrap">{k.qualifyingTest}</p>
          {k.assessmentInstructions && (
            <p className="whitespace-pre-wrap text-slate-600">
              <strong>How to run and score it:</strong> {k.assessmentInstructions}
            </p>
          )}
          {k.qualifyingTestLink && (
            <a href={k.qualifyingTestLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Open test <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          {kit ? `The ${kit.roleName} Position Kit has no qualifying test yet.` : "No Position Kit matches this position."} Every position should have
          its own approved test — add it in Recruitment → Position Kits.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Test type</label>
          <input value={testType} onChange={(e) => setTestType(e.target.value)} maxLength={80} placeholder="e.g. Practical" className={input} />
        </div>
        <div>
          <label className={label}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as QualifyingTestResult["status"])} className={input}>
            {TEST_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {!done ? (
          <div>
            <label className={label}>Scheduled for</label>
            <input type="date" value={scheduledOn} onChange={(e) => setScheduledOn(e.target.value)} className={input} />
          </div>
        ) : (
          <div>
            <label className={label}>{status === "No-show" ? "Was due on" : "Done on"}</label>
            <input type="date" value={completedOn} max={today} onChange={(e) => setCompletedOn(e.target.value)} className={input} />
          </div>
        )}
        <div>
          <label className={label}>Evaluated by</label>
          <input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} maxLength={120} placeholder="e.g. department head" className={input} />
        </div>
      </div>

      {status === "Completed" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Result</label>
              <div className="flex gap-1">
                {TEST_RESULTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResult(r)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border ${result === r ? RESULT_STYLE[r] : "bg-white text-slate-600 border-borderline hover:bg-slate-50"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label}>Score</label>
              <input value={score} onChange={(e) => setScore(e.target.value)} maxLength={40} placeholder="e.g. 7/10 or 82%" className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Evaluator&apos;s feedback</label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} maxLength={3000} className={`${input} resize-y`} />
          </div>
          <div>
            <label className={label}>Evidence link (photos, video, files, quiz result)</label>
            <input value={evidenceLink} onChange={(e) => setEvidenceLink(e.target.value)} maxLength={500} placeholder="https://drive.google.com/…" className={input} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {message ? <span className={`text-[11px] font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</span> : <span />}
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save test result
        </button>
      </div>
    </div>
  );
}
