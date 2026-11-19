"use client";

import React, { useState } from "react";
import { ExternalLink, FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { FmsCandidate } from "@/types/fms";
import {
  CONTRIBUTION_AREAS,
  CONTRIBUTION_LEVELS,
  MAX_SAMPLES,
  SAMPLE_VERDICTS,
  contributionSummary,
  getWorkSamples,
  validateWorkSample,
  workSampleProgress,
  workSamplesUpdate,
  type ContributionArea,
  type ContributionLevel,
  type WorkSample,
} from "@/lib/work-samples";

const VERDICT_STYLE: Record<string, string> = {
  "Own work": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Mostly team work": "bg-amber-100 text-amber-800 border-amber-300",
  "Unclear – verify": "bg-rose-100 text-rose-800 border-rose-300",
};

/** "Samples 1/2" badge for pipeline cards, shown only where the Position Kit asks for samples. */
export function WorkSamplesBadge({ candidate, required }: { candidate: FmsCandidate; required: boolean }) {
  if (!required) return null;
  const p = workSampleProgress(getWorkSamples(candidate), true);
  return (
    <span
      title="Work samples (Position Kit requires 2–3)"
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
        p.complete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      <FolderOpen className="w-2.5 h-2.5" />
      Samples {p.count}/{p.min}
    </span>
  );
}

export function WorkSamplesPanel({
  candidate,
  required,
  sampleTypes,
  onSaved,
}: {
  candidate: FmsCandidate;
  required: boolean;
  sampleTypes: string;
  onSaved: (c: FmsCandidate) => void;
}) {
  const samples = getWorkSamples(candidate);
  const progress = workSampleProgress(samples, required);
  const [editing, setEditing] = useState<WorkSample | "new" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const persist = async (next: WorkSample[]) => {
    const res = await fetch("/api/recruitment/candidates-fms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: candidate.id, updates: workSamplesUpdate(candidate, next) }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
    onSaved(json.data);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this work sample?")) return;
    setRemoving(id);
    setError("");
    try {
      await persist(samples.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-borderline bg-surface space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5">
          <FolderOpen className="w-4 h-4 text-primary" />
          Work Samples
          {required ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                progress.complete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {progress.count}/{progress.min} required
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-muted">optional for this position</span>
          )}
        </h4>
        {samples.length < MAX_SAMPLES && (
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add sample
          </button>
        )}
      </div>

      {required && sampleTypes && <p className="text-[11px] text-slate-700">Ask for: {sampleTypes}</p>}

      {samples.length === 0 ? (
        <p className="text-[11px] text-muted">
          {required
            ? "Collect 2–3 examples of the candidate's own work and note exactly what they did on each — the idea, script, shoot, edit, design, distribution or results."
            : "For creative and skill-based roles, add examples of the candidate's work here."}
        </p>
      ) : (
        <div className="space-y-2">
          {samples.map((s) => (
            <div key={s.id} className="p-3 rounded-lg border border-borderline bg-canvas/40 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 min-w-0">
                  <span className="truncate">{s.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${VERDICT_STYLE[s.verdict] || ""}`}>{s.verdict}</span>
                  <button onClick={() => setEditing(s)} title="Edit" className="p-1 text-muted hover:text-navy cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(s.id)} disabled={removing === s.id} title="Remove" className="p-1 text-muted hover:text-rose-600 cursor-pointer">
                    {removing === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-600">{contributionSummary(s.contribution) || "No personal contribution marked"}</p>
              <p className="text-[11px] text-slate-700">
                <strong className="text-navy">Their role:</strong> {s.candidateRole}
              </p>
              {s.hrNotes && <p className="text-[11px] text-slate-500">HR: {s.hrNotes}</p>}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-700">{error}</p>}

      {editing && (
        <SampleModal
          sample={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (sample) => {
            const next = editing === "new" ? [...samples, sample] : samples.map((s) => (s.id === sample.id ? sample : s));
            await persist(next);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SampleModal({ sample, onClose, onSave }: { sample: WorkSample | null; onClose: () => void; onSave: (s: WorkSample) => Promise<void> }) {
  const [title, setTitle] = useState(sample?.title || "");
  const [link, setLink] = useState(sample?.link || "");
  const [contribution, setContribution] = useState<WorkSample["contribution"]>(sample?.contribution || {});
  const [candidateRole, setCandidateRole] = useState(sample?.candidateRole || "");
  const [verdict, setVerdict] = useState(sample?.verdict || "");
  const [hrNotes, setHrNotes] = useState(sample?.hrNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setLevel = (area: ContributionArea, level: ContributionLevel) =>
    setContribution((c) => {
      const next = { ...c };
      if (next[area] === level) delete next[area]; // clicking again clears it: "does not apply"
      else next[area] = level;
      return next;
    });

  const submit = async () => {
    const draft = { title, link, contribution, candidateRole, verdict };
    const problem = validateWorkSample(draft);
    if (problem) return setError(problem);
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: sample?.id || `WS-${Date.now().toString(36)}`,
        title: title.trim(),
        link: link.trim(),
        contribution,
        candidateRole: candidateRole.trim(),
        verdict,
        hrNotes: hrNotes.trim(),
        addedAt: sample?.addedAt || new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  };

  const field = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
  const area = "w-full px-3 py-2 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={saving}
      size="lg"
      title={sample ? "Edit work sample" : "Add work sample"}
      subtitle="What did the candidate personally do — not the team?"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-md border border-borderline bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save sample
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Diwali salon offer reel" className={field} />
          </div>
          <div>
            <label className={label}>Link *</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="Drive, YouTube, Instagram, Behance…" className={field} />
          </div>
        </div>

        <div>
          <label className={label}>Who did what? * (click again to clear an area that does not apply)</label>
          <div className="rounded-md border border-borderline divide-y divide-borderline">
            {CONTRIBUTION_AREAS.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-xs text-slate-700">{a.label}</span>
                <div className="flex gap-1">
                  {CONTRIBUTION_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevel(a.key, level)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                        contribution[a.key] === level
                          ? level === "Self"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : level === "Shared"
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-slate-500 text-white border-slate-500"
                          : "bg-white text-slate-600 border-borderline hover:bg-slate-50"
                      }`}
                    >
                      {level === "Self" ? "Themselves" : level === "Shared" ? "With team" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>What exactly did they do? (their words) *</label>
          <textarea value={candidateRole} onChange={(e) => setCandidateRole(e.target.value)} rows={3} maxLength={2000} className={area} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-3">
          <div>
            <label className={label}>Your verdict *</label>
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)} className={field}>
              <option value="">Select</option>
              {SAMPLE_VERDICTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>HR notes</label>
            <input value={hrNotes} onChange={(e) => setHrNotes(e.target.value)} maxLength={1000} placeholder="e.g. Shared the raw footage, edit matches the reel" className={field} />
          </div>
        </div>

        {error && <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
}
