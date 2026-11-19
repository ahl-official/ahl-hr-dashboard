"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, Gavel, Loader2, MinusCircle, Sparkles } from "lucide-react";
import type { FmsCandidate } from "@/types/fms";
import type { PositionKitRecord } from "@/lib/position-kit";
import {
  HIRING_DECISIONS,
  evaluationChecklist,
  getFinalReport,
  getHiringDecision,
  missingSteps,
  validateHiringDecision,
  type HiringDecisionValue,
} from "@/lib/final-evaluation";

const DECISION_STYLE: Record<string, string> = {
  Hire: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Hold: "bg-amber-100 text-amber-800 border-amber-300",
  Reject: "bg-rose-100 text-rose-800 border-rose-300",
};

/** "Hire" / "Hold" / "Reject" badge for cards once the hiring manager has decided. */
export function HiringDecisionBadge({ candidate }: { candidate: FmsCandidate }) {
  const d = getHiringDecision(candidate);
  if (!d) return null;
  return (
    <span title={`Decided by ${d.decidedBy}`} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${DECISION_STYLE[d.decision]}`}>
      <Gavel className="w-2.5 h-2.5" />
      {d.decision}
    </span>
  );
}

export function FinalEvaluationPanel({
  candidate,
  kit,
  hiringManager,
  onUpdated,
}: {
  candidate: FmsCandidate;
  kit: PositionKitRecord | null;
  hiringManager: string;
  onUpdated: (c: FmsCandidate) => void;
}) {
  const items = evaluationChecklist(candidate, kit?.kit);
  const missing = missingSteps(items);
  const report = getFinalReport(candidate);
  const decision = getHiringDecision(candidate);

  const [generating, setGenerating] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [choice, setChoice] = useState<HiringDecisionValue | "">("");
  const [decidedBy, setDecidedBy] = useState(hiringManager);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/recruitment/final-evaluation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidate.id, ...body }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Request failed");
    onUpdated(json.data.candidate);
    return json.data;
  };

  const generate = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      await call({ action: "report" });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const decide = async () => {
    if (!choice) return;
    const problem = validateHiringDecision({ decision: choice, decidedBy, reason }, items);
    if (problem) return setMessage({ ok: false, text: problem });
    if (choice === "Reject" && !window.confirm(`Reject ${candidate.fullName}? They will be dropped from the pipeline.`)) return;
    setDeciding(true);
    setMessage(null);
    try {
      await call({ action: "decide", decision: choice, decidedBy, reason });
      setMessage({ ok: true, text: `Decision recorded: ${choice}` });
      setChoice("");
      setReason("");
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    } finally {
      setDeciding(false);
    }
  };

  const section = (title: string, text: string) => (
    <p className="text-slate-700">
      <strong className="text-navy">{title}:</strong> {text}
    </p>
  );
  const list = (title: string, values: string[], tone: string) =>
    values.length > 0 && (
      <div>
        <h5 className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${tone}`}>{title}</h5>
        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
          {values.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </div>
    );
  const input = "w-full px-2.5 py-1.5 bg-white border border-borderline rounded-md text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="p-4 rounded-xl border-2 border-indigo-100 bg-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
          <Gavel className="w-4 h-4 text-primary" />
          Final Evaluation &amp; Hiring Decision
        </h4>
        {decision && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DECISION_STYLE[decision.decision]}`}>{decision.decision}</span>
        )}
      </div>

      {/* SOP process checklist */}
      <div className="rounded-lg border border-borderline divide-y divide-borderline">
        {items.map((i) => (
          <div key={i.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-700">
              {!i.required ? (
                <MinusCircle className="w-3.5 h-3.5 text-slate-300" />
              ) : i.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-amber-500" />
              )}
              {i.label}
              {!i.required && <span className="text-muted">(not required for this position)</span>}
            </span>
            <span className="text-muted text-right">{i.detail}</span>
          </div>
        ))}
      </div>

      {/* AI consolidated report */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          {report
            ? `Report written ${new Date(report.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : "The AI combines the CV, interview, samples and test into one report."}
        </span>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {report ? "Rewrite report" : "Write final report"}
        </button>
      </div>

      {report && (
        <div className="space-y-2 p-3 rounded-lg bg-canvas/50 border border-borderline">
          <div className="flex items-start gap-2">
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${DECISION_STYLE[report.recommendation]}`}>
              AI: {report.recommendation}
            </span>
            <p className="text-slate-700">{report.recommendationReason}</p>
          </div>
          {section("CV match", report.cvMatch)}
          {section("Interview", report.interviewPerformance)}
          {section("Portfolio", report.portfolio)}
          {section("Test", report.testResults)}
          {list("Strengths", report.strengths, "text-emerald-700")}
          {list("Weaknesses", report.weaknesses, "text-amber-700")}
          {list("Red flags", report.redFlags, "text-rose-700")}
          {report.missingSteps.length > 0 && (
            <p className="text-[10px] text-amber-800">Written while these steps were still missing: {report.missingSteps.join(", ")}.</p>
          )}
        </div>
      )}

      {/* Hiring manager's decision */}
      {decision && (
        <p className="text-[11px] text-slate-700">
          <strong className="text-navy">{decision.decision}</strong> — decided by {decision.decidedBy} on{" "}
          {new Date(decision.decidedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}: {decision.reason}
        </p>
      )}
      <div className="space-y-2 pt-1 border-t border-borderline">
        <span className="block text-[11px] font-semibold text-navy pt-2">{decision ? "Change the decision" : "Hiring manager's decision"}</span>
        <div className="flex gap-1">
          {HIRING_DECISIONS.map((d) => {
            const blocked = d === "Hire" && missing.length > 0;
            return (
              <button
                key={d}
                type="button"
                disabled={blocked}
                title={blocked ? `Missing: ${missing.join(", ")}` : undefined}
                onClick={() => setChoice(d)}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border disabled:opacity-40 disabled:cursor-not-allowed ${
                  choice === d ? DECISION_STYLE[d] : "bg-white text-slate-600 border-borderline hover:bg-slate-50"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        {missing.length > 0 && <p className="text-[10px] text-amber-800">Hire unlocks once these are done: {missing.join(", ")}.</p>}
        {choice && (
          <>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <input value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} maxLength={120} placeholder="Hiring manager" className={input} />
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Reason for the decision" className={input} />
            </div>
            <button
              onClick={decide}
              disabled={deciding}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-navy text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {deciding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Record decision: {choice}
            </button>
          </>
        )}
        {message && <p className={`text-[11px] font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
