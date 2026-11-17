"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDisplayDate, getTodayLocalIsoDate } from "@/lib/date-utils";
import {
  JOINER_RESULTS,
  JOINER_WINDOW_DAYS,
  type JoinerCheckState,
  type JoinerSchedule,
  type ScheduledJoinerCheck,
} from "@/lib/joiner-checks-rules";

const field = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
const area = "w-full px-3 py-2 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y";
const label = "block text-xs font-medium text-slate-600 mb-1";

const STATE_STYLE: Record<JoinerCheckState, { chip: string; text: string }> = {
  done: { chip: "bg-emerald-50 border-emerald-200 text-emerald-800", text: "Done" },
  due: { chip: "bg-amber-50 border-amber-300 text-amber-900", text: "Due today" },
  overdue: { chip: "bg-rose-50 border-rose-200 text-rose-800", text: "Overdue" },
  upcoming: { chip: "bg-slate-50 border-borderline text-slate-600", text: "Upcoming" },
};

type Editing = { joiner: JoinerSchedule; check: ScheduledJoinerCheck };

export function JoinerChecksSection() {
  const { showToast } = useToast();
  const [schedule, setSchedule] = useState<JoinerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/joiner-checks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load joiner checks");
      setSchedule(json.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load joiner checks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const all = schedule.flatMap((j) => j.checks);
    return {
      overdue: all.filter((c) => c.state === "overdue").length,
      due: all.filter((c) => c.state === "due").length,
      upcoming: all.filter((c) => c.state === "upcoming").length,
      done: all.filter((c) => c.state === "done").length,
    };
  }, [schedule]);

  return (
    <section className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">After joining</span>
          <h2 className="text-xl sm:text-2xl font-semibold text-navy-DEFAULT tracking-tight">New joiner checks</h2>
          <p className="text-xs sm:text-sm text-muted">
            Day 1, Day 6, 2 Weeks and 1 Month evaluations for everyone who joined in the last {JOINER_WINDOW_DAYS} days.
            Record the test result and the reporting manager&apos;s feedback for each one.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-borderline bg-surface hover:bg-slate-50 text-navy-DEFAULT self-start sm:self-center"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Overdue", value: counts.overdue, icon: AlertTriangle, tone: "text-rose-600" },
          { label: "Due today", value: counts.due, icon: CalendarClock, tone: "text-amber-600" },
          { label: "Upcoming", value: counts.upcoming, icon: UserPlus, tone: "text-indigo-600" },
          { label: "Completed", value: counts.done, icon: CheckCircle2, tone: "text-emerald-600" },
        ].map(({ label: name, value, icon: Icon, tone }) => (
          <div key={name} className="bg-surface p-4 rounded-2xl border border-borderline shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">{name}</span>
              <Icon className={`w-4 h-4 ${tone}`} />
            </div>
            <div className="text-2xl font-semibold text-navy-DEFAULT">{loading ? "–" : value}</div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          Loading new joiners...
        </div>
      ) : schedule.length === 0 && !error ? (
        <div className="bg-surface rounded-2xl border border-borderline p-10 text-center text-sm text-muted">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No active employees joined in the last {JOINER_WINDOW_DAYS} days.
        </div>
      ) : (
        <div className="space-y-3">
          {schedule.map((joiner) => (
            <div key={joiner.employee.employeeKey} className="bg-surface rounded-2xl border border-borderline shadow-sm p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy-DEFAULT">
                    {joiner.employee.fullName}
                    {joiner.employee.employeeId && <span className="ml-2 text-xs font-mono text-slate-500">{joiner.employee.employeeId}</span>}
                  </h3>
                  <p className="text-xs text-muted">
                    {[joiner.employee.designation, joiner.employee.department].filter(Boolean).join(" · ")}
                    {joiner.employee.manager && <> · Manager: {joiner.employee.manager}</>}
                  </p>
                </div>
                <span className="text-xs text-slate-600">Joined {formatDisplayDate(joiner.employee.doj)}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {joiner.checks.map((check) => {
                  const style = STATE_STYLE[check.state];
                  return (
                    <button
                      key={check.checkId}
                      onClick={() => setEditing({ joiner, check })}
                      className={`text-left rounded-xl border px-3 py-2.5 transition hover:shadow-sm cursor-pointer ${style.chip}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{check.label}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          {check.state === "overdue" ? `${check.daysLate}d late` : style.text}
                        </span>
                      </div>
                      <div className="text-[11px] mt-1 opacity-80">
                        {check.record?.completedOn
                          ? `${check.record.result} · ${formatDisplayDate(check.record.completedOn)}`
                          : `Due ${formatDisplayDate(check.dueDate)}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RecordCheckModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showToast("Check recorded", "success");
            load();
          }}
        />
      )}
    </section>
  );
}

function RecordCheckModal({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const { joiner, check } = editing;
  const existing = check.record;
  const today = getTodayLocalIsoDate();
  const [completedOn, setCompletedOn] = useState(existing?.completedOn || (check.dueDate <= today ? today : ""));
  const [result, setResult] = useState(existing?.result || "");
  const [score, setScore] = useState(existing?.score || "");
  const [testUsed, setTestUsed] = useState(existing?.testUsed || "");
  const [managerFeedback, setManagerFeedback] = useState(existing?.managerFeedback || "");
  const [evaluatedBy, setEvaluatedBy] = useState(existing?.evaluatedBy || joiner.employee.manager || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/joiner-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeKey: joiner.employee.employeeKey,
          check: check.check,
          completedOn,
          result,
          score,
          testUsed,
          managerFeedback,
          evaluatedBy,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save");
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save");
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      busy={saving}
      title={`${check.label} check · ${joiner.employee.fullName}`}
      subtitle={`Due ${formatDisplayDate(check.dueDate)} · ${joiner.employee.designation || joiner.employee.department}`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-md border border-borderline bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" form="joiner-check-form" disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {existing ? "Update" : "Save"}
          </button>
        </>
      }
    >
      <form id="joiner-check-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Completed on *</label>
            <input type="date" value={completedOn} max={today} onChange={(e) => setCompletedOn(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Result *</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} className={field}>
              <option value="">Select result</option>
              {JOINER_RESULTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-4">
          <div>
            <label className={label}>Test / assessment used</label>
            <input value={testUsed} onChange={(e) => setTestUsed(e.target.value)} maxLength={300} placeholder="e.g. Product knowledge quiz" className={field} />
          </div>
          <div>
            <label className={label}>Score</label>
            <input value={score} onChange={(e) => setScore(e.target.value)} maxLength={30} placeholder="e.g. 8/10" className={field} />
          </div>
        </div>
        <div>
          <label className={label}>Reporting manager&apos;s feedback *</label>
          <textarea value={managerFeedback} onChange={(e) => setManagerFeedback(e.target.value)} rows={4} maxLength={3000} placeholder="How is the new joiner doing? Strengths, gaps, concerns" className={area} />
        </div>
        <div>
          <label className={label}>Evaluated by</label>
          <input value={evaluatedBy} onChange={(e) => setEvaluatedBy(e.target.value)} maxLength={120} className={field} />
        </div>
        <div>
          <label className={label}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="Next steps, support needed" className={area} />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
