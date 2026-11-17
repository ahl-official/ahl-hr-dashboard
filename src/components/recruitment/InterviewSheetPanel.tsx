"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import type { FmsCandidate } from "@/types/fms";
import { getTodayLocalIsoDate } from "@/lib/date-utils";
import {
  STANDARD_INTERVIEW_QUESTIONS,
  getInterviewSheet,
  interviewSheetProgress,
  interviewSheetUpdate,
  type InterviewSheet,
} from "@/lib/interview-sheet";
import type { CvScreeningReport } from "@/lib/cv-screening";

const area =
  "w-full px-2.5 py-1.5 bg-white border border-borderline rounded-md text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y";

/** "Questions 6/11" badge for pipeline cards. */
export function InterviewSheetBadge({ candidate }: { candidate: FmsCandidate }) {
  const p = interviewSheetProgress(getInterviewSheet(candidate));
  return (
    <span
      title={p.complete ? "All standard interview questions answered" : `Unanswered: ${p.missing.join(" · ")}`}
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
        p.complete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      <ClipboardList className="w-2.5 h-2.5" />
      Q {p.answered}/{p.total}
    </span>
  );
}

export function InterviewSheetPanel({
  candidate,
  defaultOpen,
  onSaved,
}: {
  candidate: FmsCandidate;
  defaultOpen: boolean;
  onSaved: (candidate: FmsCandidate) => void;
}) {
  const saved = getInterviewSheet(candidate);
  const screening = candidate.stageData?.ar?.cvScreening as CvScreeningReport | undefined;
  const [open, setOpen] = useState(defaultOpen);
  const [answers, setAnswers] = useState<InterviewSheet["answers"]>(saved?.answers || {});
  // Keep answers already given; add any CV questions from a newer screening.
  const [cvQuestions, setCvQuestions] = useState<InterviewSheet["cvQuestions"]>(() => {
    const kept = saved?.cvQuestions || [];
    const fresh = (screening?.interviewQuestions || []).filter((q) => !kept.some((k) => k.question === q));
    return [...kept, ...fresh.map((question) => ({ question, answer: "" }))];
  });
  const [interviewer, setInterviewer] = useState(saved?.interviewer || "");
  const [conductedOn, setConductedOn] = useState(saved?.conductedOn || getTodayLocalIsoDate());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const progress = interviewSheetProgress({ answers, cvQuestions, interviewer, conductedOn, updatedAt: "" });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const sheet: InterviewSheet = { answers, cvQuestions, interviewer: interviewer.trim(), conductedOn, updatedAt: new Date().toISOString() };
      const res = await fetch("/api/recruitment/candidates-fms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id, updates: interviewSheetUpdate(candidate, sheet) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      onSaved(json.data);
      setMessage({ ok: true, text: "Interview answers saved" });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-borderline bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer">
        <span className="text-xs font-bold text-navy flex items-center gap-1.5">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <ClipboardList className="w-4 h-4 text-primary" />
          Telephonic Interview Sheet
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            progress.complete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {progress.complete ? "All standard questions answered" : `${progress.answered}/${progress.total} standard questions`}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="space-y-2.5">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted">Standard questions (ask every candidate)</h5>
            {STANDARD_INTERVIEW_QUESTIONS.map((q, i) => (
              <div key={q.key}>
                <label className="flex items-start gap-1.5 text-[11px] font-semibold text-navy mb-1">
                  {(answers[q.key] || "").trim() ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />
                  ) : (
                    <span className="w-3.5 text-center text-muted shrink-0">{i + 1}.</span>
                  )}
                  {q.question}
                </label>
                <textarea
                  rows={q.key === "takeHomeSalary" || q.key === "expectedSalary" || q.key === "noticePeriod" || q.key === "joiningDate" ? 1 : 2}
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  maxLength={2000}
                  className={area}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted">Questions from the CV screening</h5>
            {cvQuestions.length === 0 ? (
              <p className="text-[11px] text-muted">Screen the CV above to get questions that check this candidate&apos;s claims and gaps.</p>
            ) : (
              cvQuestions.map((q, i) => (
                <div key={i}>
                  <label className="block text-[11px] font-semibold text-navy mb-1">{q.question}</label>
                  <textarea
                    rows={2}
                    value={q.answer}
                    onChange={(e) => setCvQuestions((list) => list.map((item, j) => (j === i ? { ...item, answer: e.target.value } : item)))}
                    maxLength={2000}
                    className={area}
                  />
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-navy mb-1">Interviewed by</label>
              <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} maxLength={120} className={`${area} h-8`} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-navy mb-1">Interview date</label>
              <input type="date" value={conductedOn} max={getTodayLocalIsoDate()} onChange={(e) => setConductedOn(e.target.value)} className={`${area} h-8`} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            {message ? (
              <span className={`text-[11px] font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</span>
            ) : (
              <span className="text-[10px] text-muted">Expected salary and notice period also fill the Confirmation Call columns.</span>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save answers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
