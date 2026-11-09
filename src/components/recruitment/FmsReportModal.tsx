"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Loader2, X } from "lucide-react";
import type { FmsCandidate, FmsRequisition } from "@/types/fms";
import {
  buildFmsReport,
  getCustomReportPeriod,
  getFmsReportPeriods,
  listReportHrNames,
  reportFileName,
  type FmsReportKind,
} from "@/lib/fms-report";

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function FmsReportModal({ onClose }: { onClose: () => void }) {
  const [candidates, setCandidates] = useState<FmsCandidate[]>([]);
  const [requisitions, setRequisitions] = useState<FmsRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [kind, setKind] = useState<FmsReportKind>("weekly");
  // Index 0 is the running week/month, so default to the last completed one.
  const [periodIndex, setPeriodIndex] = useState(1);
  const [hrName, setHrName] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always report on fresh sheet data, independent of the pipeline's filters.
        const [candRes, reqRes] = await Promise.all([
          fetch("/api/recruitment/candidates-fms?refresh=true"),
          fetch("/api/recruitment/requisitions"),
        ]);
        const candJson = await candRes.json();
        const reqJson = await reqRes.json();
        if (cancelled) return;
        if (!candJson.success || !reqJson.success) {
          setError(candJson.message || reqJson.message || "Failed to load report data");
          return;
        }
        setCandidates(candJson.data.candidates || []);
        setRequisitions(reqJson.data.requisitions || []);
      } catch {
        if (!cancelled) setError("Network error loading report data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = localToday();
  const periods = useMemo(() => (kind === "custom" ? [] : getFmsReportPeriods(kind, today)), [kind, today]);
  const period = useMemo(
    () => (kind === "custom" ? getCustomReportPeriod(customStart, customEnd) : periods[periodIndex]),
    [kind, customStart, customEnd, periods, periodIndex]
  );
  const hrNames = useMemo(() => listReportHrNames(requisitions), [requisitions]);
  const report = useMemo(
    () => (period ? buildFmsReport(candidates, requisitions, period, hrName) : null),
    [candidates, requisitions, period, hrName]
  );
  const reversedRange = kind === "custom" && Boolean(customStart && customEnd) && customStart > customEnd;

  // Open the calendar when any part of the field is clicked, not only its icon.
  const openCalendar = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      e.currentTarget.showPicker();
    } catch {
      // Browsers without showPicker still open it from the icon.
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    setError(null);
    try {
      const { renderFmsReportPdf } = await import("@/lib/fms-report-pdf");
      renderFmsReportPdf(report).save(reportFileName(report));
    } catch (err) {
      console.error("Report PDF generation failed:", err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const selectClass =
    "w-full px-3 py-2 rounded-lg border border-borderline bg-surface text-xs text-navy focus:outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface rounded-xl border border-borderline shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy">Download HR Report</h3>
          <button onClick={onClose} title="Close" className="p-1 text-muted hover:text-navy cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-canvas border border-borderline">
          {(["weekly", "monthly", "custom"] as const).map((option) => (
            <button
              key={option}
              onClick={() => {
                setKind(option);
                setPeriodIndex(1);
              }}
              className={`flex-1 py-1.5 rounded-md font-semibold capitalize transition-all cursor-pointer ${
                kind === option ? "bg-primary text-white" : "text-muted hover:text-navy"
              }`}
            >
              {option === "custom" ? "Custom Dates" : option}
            </button>
          ))}
        </div>

        {kind === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold text-navy">From</span>
              <input
                type="date"
                value={customStart}
                max={customEnd || today}
                onChange={(e) => setCustomStart(e.target.value)}
                onClick={openCalendar}
                className={selectClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-navy">To</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={today}
                onChange={(e) => setCustomEnd(e.target.value)}
                onClick={openCalendar}
                className={selectClass}
              />
            </label>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="font-semibold text-navy">{kind === "weekly" ? "Week" : "Month"}</span>
            <select value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))} className={selectClass}>
              {periods.map((option, i) => (
                <option key={option.start} value={i}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1">
          <span className="font-semibold text-navy">HR</span>
          <select value={hrName} onChange={(e) => setHrName(e.target.value)} className={selectClass}>
            <option value="">All HR</option>
            {hrNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading latest FMS data...</span>
          </div>
        ) : (
          !error &&
          report && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Shortlisted", report.totals.shortlisted],
                ["Joined", report.totals.joined],
                ["Required", report.totals.required],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-canvas border border-borderline py-2.5">
                  <div className="text-lg font-bold text-navy">{value}</div>
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          )
        )}

        {reversedRange && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>The From date must be on or before the To date.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={!report || loading || downloading || (Boolean(error) && candidates.length === 0)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  );
}
