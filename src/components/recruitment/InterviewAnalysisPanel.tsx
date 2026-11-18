"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Headphones, Link2, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { FmsCandidate } from "@/types/fms";
import { analysisCoverage, MIN_TRANSCRIPT_CHARS, type InterviewAnalysis } from "@/lib/interview-analysis";

const VERDICT_STYLE: Record<string, string> = {
  Proceed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Hold: "bg-amber-100 text-amber-800 border-amber-300",
  Reject: "bg-rose-100 text-rose-800 border-rose-300",
};

export function getInterviewAnalysis(candidate: FmsCandidate): InterviewAnalysis | null {
  return (candidate.stageData?.ps?.interviewAnalysis as InterviewAnalysis) || null;
}

export function InterviewAnalysisPanel({ candidate, onUpdated }: { candidate: FmsCandidate; onUpdated: (c: FmsCandidate) => void }) {
  const analysis = getInterviewAnalysis(candidate);
  const [open, setOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

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

  const coverage = analysis ? analysisCoverage(analysis) : null;

  return (
    <div className="p-4 rounded-xl border border-borderline bg-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-primary" />
          Interview Recording Analysis
        </h4>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {analysis ? "Re-analyse" : "Analyse recording"}
        </button>
      </div>

      {!analysis || !coverage ? (
        <p className="text-[11px] text-muted">
          Upload the telephonic interview recording (with the candidate&apos;s consent). The AI checks that every standard question
          was asked, fills the interview sheet, and flags weak answers, missing information and contradictions.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${VERDICT_STYLE[analysis.recommendation]}`}>
              {analysis.recommendation}
            </span>
            <p className="text-slate-700 leading-relaxed">
              {analysis.summary}
              {analysis.recommendationReason && <span className="block mt-1 text-slate-600">{analysis.recommendationReason}</span>}
            </p>
          </div>

          <div
            className={`p-2.5 rounded-lg border text-[11px] ${
              coverage.notAsked.length ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <strong>
              Standard questions covered: {coverage.asked}/{coverage.total}
            </strong>
            {coverage.notAsked.length > 0 && (
              <ul className="list-disc pl-4 mt-1">
                {coverage.notAsked.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </div>

          {list("Contradictions to clarify", analysis.contradictions, "text-rose-700")}
          {list("Weak answers", analysis.weakAnswers, "text-amber-700")}
          {list("Missing information", analysis.missingInformation, "text-amber-700")}
          {list("Follow-up questions", analysis.followUpQuestions, "text-indigo-700")}
          {list("Strong answers", analysis.strongAnswers, "text-emerald-700")}

          <button onClick={() => setShowTranscript((s) => !s)} className="flex items-center gap-1 text-[11px] font-semibold text-primary cursor-pointer">
            {showTranscript ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Transcript
          </button>
          {showTranscript && (
            <pre className="text-[10px] text-slate-600 whitespace-pre-wrap max-h-64 overflow-y-auto p-2 rounded bg-slate-50 border border-borderline font-sans">
              {analysis.transcript}
              {analysis.transcriptTruncated && "\n\n… (transcript shortened for storage; the full text was analysed)"}
            </pre>
          )}

          <p className="text-[10px] text-muted border-t border-borderline pt-2">
            {analysis.source === "transcript" ? "Pasted transcript" : analysis.sourceName || "Recording"}
            {analysis.transcriptionModel && ` · ${analysis.transcriptionModel}`}
            {" · consent confirmed · "}
            {new Date(analysis.analyzedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      )}

      {open && (
        <AnalyseModal
          candidate={candidate}
          onClose={() => setOpen(false)}
          onDone={(c) => {
            setOpen(false);
            onUpdated(c);
          }}
        />
      )}
    </div>
  );
}

type Method = "upload" | "link" | "transcript";
type Phase = "idle" | "uploading" | "transcribing" | "analysing";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "",
  uploading: "Sending the recording...",
  transcribing: "Transcribing the call (about a quarter of the call's length)...",
  analysing: "Analysing the interview...",
};

function AnalyseModal({ candidate, onClose, onDone }: { candidate: FmsCandidate; onClose: () => void; onDone: (c: FmsCandidate) => void }) {
  const [method, setMethod] = useState<Method>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const cancelled = useRef(false);

  useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const analyse = async (text: string, source: Method, sourceName: string, transcriptionModel = "") => {
    setPhase("analysing");
    const res = await fetch("/api/recruitment/interview-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidate.id, transcript: text, source, sourceName, consent, transcriptionModel }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Analysis failed");
    onDone(json.data.candidate);
  };

  const run = async () => {
    setError("");
    try {
      if (method === "transcript") {
        await analyse(transcript.trim(), "transcript", "");
        return;
      }
      setPhase("uploading");
      const form = new FormData();
      form.append("consent", String(consent));
      if (method === "upload" && file) form.append("file", file);
      if (method === "link") form.append("recordingUrl", link.trim());
      const started = await (await fetch("/api/recruitment/interview-analysis/transcribe", { method: "POST", body: form })).json();
      if (!started.success) throw new Error(started.message || "Could not start transcription");

      setPhase("transcribing");
      const deadline = Date.now() + 20 * 60 * 1000;
      while (!cancelled.current) {
        await new Promise((r) => setTimeout(r, 4000));
        const job = await (await fetch(`/api/recruitment/interview-analysis/transcribe?id=${started.data.jobId}`)).json();
        if (!job.success) throw new Error(job.message || "Could not check transcription");
        if (job.data.status === "error") throw new Error(job.data.error);
        if (job.data.status === "completed") {
          if (!job.data.transcript) throw new Error("No speech was found in the recording.");
          await analyse(job.data.transcript, method, method === "upload" ? file!.name : link.trim(), job.data.model);
          return;
        }
        if (Date.now() > deadline) throw new Error("Transcription is taking too long. Try again later.");
      }
    } catch (e: any) {
      if (!cancelled.current) {
        setError(e.message || "Something went wrong");
        setPhase("idle");
      }
    }
  };

  const busy = phase !== "idle";
  const ready =
    consent &&
    ((method === "upload" && file) || (method === "link" && link.trim()) || (method === "transcript" && transcript.trim().length >= MIN_TRANSCRIPT_CHARS));
  const field = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={busy}
      size="lg"
      title={`Analyse interview · ${candidate.fullName}`}
      subtitle={candidate.position || "Telephonic interview"}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 rounded-md border border-borderline bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || !ready}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? "Working..." : "Analyse"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
          {([
            ["upload", "Upload recording"],
            ["link", "Google Drive link"],
            ["transcript", "Paste transcript"],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => setMethod(m)}
              className={`py-1.5 rounded-md text-xs font-semibold ${method === m ? "bg-white shadow-sm text-indigo-700" : "text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {method === "upload" && (
          <div>
            <label className="flex items-center gap-2 px-3 py-3 rounded-md border border-dashed border-borderline bg-slate-50 cursor-pointer hover:bg-slate-100">
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-slate-700 truncate">{file ? file.name : "Choose the call recording (mp3, m4a, amr, wav… max 4 MB)"}</span>
              <input type="file" accept="audio/*,.amr,.m4a,.3gp" className="hidden" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <p className="mt-1 text-[11px] text-muted">Bigger than 4 MB? Use the Google Drive link option.</p>
          </div>
        )}

        {method === "link" && (
          <div>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input value={link} onChange={(e) => setLink(e.target.value)} disabled={busy} placeholder="https://drive.google.com/file/d/…/view" className={`${field} pl-9`} />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              In Drive, set the file&apos;s sharing to &quot;Anyone with the link&quot;. You can turn sharing off again once the analysis is done.
            </p>
          </div>
        )}

        {method === "transcript" && (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={busy}
            rows={8}
            placeholder="Paste the full transcript of the call"
            className="w-full px-3 py-2 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
          />
        )}

        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600" />
          The candidate agreed to this call being recorded and analysed.
        </label>

        {busy && (
          <p className="flex items-center gap-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {PHASE_TEXT[phase]} Keep this window open.
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
