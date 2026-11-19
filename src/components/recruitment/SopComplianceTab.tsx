"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardCheck, Loader2, MinusCircle, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type { FmsCandidate, FmsRequisition } from "@/types/fms";
import type { PositionKitRecord } from "@/lib/position-kit";
import type { JoinerSchedule } from "@/lib/joiner-checks-rules";
import { buildComplianceRows, complianceSummary, positionsWithoutApprovedKit, type ComplianceStatus } from "@/lib/sop-compliance";

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  "Skipped steps": "bg-rose-100 text-rose-800 border-rose-300",
  "In progress": "bg-slate-100 text-slate-700 border-slate-200",
  Complete: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Dropped: "bg-slate-50 text-slate-400 border-slate-200",
};

const STEP_COLUMNS = [
  { key: "cv", label: "CV" },
  { key: "questions", label: "Questions" },
  { key: "recording", label: "Recording" },
  { key: "samples", label: "Samples" },
  { key: "test", label: "Test" },
];

type Filter = "Attention" | "All" | ComplianceStatus;

export default function SopComplianceTab() {
  const [candidates, setCandidates] = useState<FmsCandidate[]>([]);
  const [requisitions, setRequisitions] = useState<FmsRequisition[]>([]);
  const [kits, setKits] = useState<PositionKitRecord[]>([]);
  const [overdueJoinerChecks, setOverdueJoinerChecks] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("Attention");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, r, k, j] = await Promise.all([
        fetch("/api/recruitment/candidates-fms?refresh=true").then((x) => x.json()),
        fetch("/api/recruitment/requisitions").then((x) => x.json()),
        fetch("/api/recruitment/icp").then((x) => x.json()),
        fetch("/api/joiner-checks").then((x) => x.json()).catch(() => null),
      ]);
      if (!c.success) throw new Error(c.message || "Failed to load candidates");
      setCandidates(c.data.candidates || []);
      setRequisitions(r.data?.requisitions || []);
      setKits(k.data || []);
      setOverdueJoinerChecks(
        j?.success ? (j.data as JoinerSchedule[]).reduce((n, s) => n + s.checks.filter((x) => x.state === "overdue").length, 0) : null
      );
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => buildComplianceRows(candidates, kits, requisitions), [candidates, kits, requisitions]);
  const summary = useMemo(() => complianceSummary(rows), [rows]);
  const noKit = useMemo(() => positionsWithoutApprovedKit(requisitions, kits), [requisitions, kits]);

  const order: Record<ComplianceStatus, number> = { "Skipped steps": 0, "In progress": 1, Complete: 2, Dropped: 3 };
  const shown = rows
    .filter((r) =>
      filter === "All" ? true : filter === "Attention" ? r.status === "Skipped steps" || r.status === "In progress" : r.status === filter
    )
    .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  const card = (label: string, value: number | string, Icon: any, tone: string, hint?: string) => (
    <div className="bg-surface p-4 rounded-xl border border-borderline shadow-2xs">
      <div className="flex items-center justify-between text-slate-500 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <div className="text-xl font-bold text-navy">{loading ? "–" : value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );

  const cell = (item: { required: boolean; done: boolean; detail: string } | undefined) => {
    if (!item) return null;
    const Icon = !item.required ? MinusCircle : item.done ? CheckCircle2 : XCircle;
    const tone = !item.required ? "text-slate-300" : item.done ? "text-emerald-600" : "text-rose-500";
    return (
      <span title={item.detail} className="inline-flex">
        <Icon className={`w-4 h-4 ${tone}`} />
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" /> Recruitment SOP compliance
          </h3>
          <p className="text-xs text-muted max-w-2xl">
            Every candidate should go through CV screening, the standard interview, the recording analysis, work samples and the
            qualifying test (where the Position Kit asks for them) and get the hiring manager&apos;s decision before moving past
            Interview Updates. Hover a mark to see the detail.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borderline bg-surface text-xs font-semibold text-navy hover:bg-canvas cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {card("In pipeline", summary.inPipeline, ClipboardCheck, "text-indigo-600", `${summary.inProgress} in progress`)}
        {card("Followed SOP", summary.complete, CheckCircle2, "text-emerald-600", "past interviews, nothing skipped")}
        {card("Skipped steps", summary.skipped, AlertTriangle, "text-rose-600", "moved on with gaps")}
        {card("Positions without approved kit", noKit.length, BookOpen, "text-amber-600", "ICP not approved yet")}
        {card("Overdue joiner checks", overdueJoinerChecks ?? "–", AlertTriangle, "text-amber-600", "Day 1 / 6 / 2 wk / 1 mo")}
      </div>

      {noKit.length > 0 && !loading && (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <strong>No approved Position Kit:</strong> {noKit.join(", ")}. The SOP asks for an approved ICP before recruiting for a position.
        </p>
      )}

      {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex flex-wrap gap-1">
        {(["Attention", "Skipped steps", "In progress", "Complete", "Dropped", "All"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
              filter === f ? "bg-primary text-white border-primary" : "bg-surface text-muted border-borderline hover:text-navy"
            }`}
          >
            {f === "Attention" ? "Needs attention" : f}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading candidates...
          </div>
        ) : shown.length === 0 ? (
          <p className="text-center text-xs text-muted py-10">No candidates in this view.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-canvas text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left py-2.5 px-3">Candidate</th>
                <th className="text-left py-2.5 px-3">Stage</th>
                <th className="text-left py-2.5 px-3">Kit</th>
                {STEP_COLUMNS.map((s) => (
                  <th key={s.key} className="py-2.5 px-2 text-center">{s.label}</th>
                ))}
                <th className="text-left py-2.5 px-3">Decision</th>
                <th className="text-left py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderline">
              {shown.map((r) => (
                <tr key={r.candidateId} className="hover:bg-slate-50/70 align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-navy">{r.name}</div>
                    <div className="text-[10px] text-muted">
                      {r.candidateId} · {r.position || "—"}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{r.stage}</td>
                  <td className="py-2.5 px-3">
                    {r.kit ? (
                      <span className={`text-[10px] font-semibold ${r.kit.approved ? "text-emerald-700" : "text-amber-700"}`}>
                        {r.kit.approved ? "Approved" : "Draft"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-rose-600">None</span>
                    )}
                  </td>
                  {STEP_COLUMNS.map((s) => (
                    <td key={s.key} className="py-2.5 px-2 text-center">
                      {cell(r.checklist.find((i) => i.key === s.key))}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-slate-700">{r.decision || "—"}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    {r.skipped.length > 0 && <div className="text-[10px] text-rose-700 mt-1 max-w-[16rem]">Skipped: {r.skipped.join(", ")}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
