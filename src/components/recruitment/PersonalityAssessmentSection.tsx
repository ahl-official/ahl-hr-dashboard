"use client";

import React, { useState } from "react";
import { ChevronRight, MessageCircle, Loader2, Sparkles, UserCheck } from "lucide-react";

const DISC_BAR_STYLES: Record<string, { label: string; track: string; fill: string }> = {
  D: { label: "Dominance", track: "bg-rose-100", fill: "bg-rose-500" },
  I: { label: "Influence", track: "bg-amber-100", fill: "bg-amber-500" },
  S: { label: "Steadiness", track: "bg-emerald-100", fill: "bg-emerald-500" },
  C: { label: "Conscientiousness", track: "bg-sky-100", fill: "bg-sky-500" },
};

function DiscBar({ dim, value }: { dim: string; value: number }) {
  const style = DISC_BAR_STYLES[dim] || { label: dim, track: "bg-slate-100", fill: "bg-slate-500" };
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">
          {dim} · {style.label}
        </span>
        <span className="font-bold text-navy">{pct}%</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${style.track}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${style.fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PersonalityAssessmentSection({
  psychometric,
  loading = false,
  onResend,
}: {
  psychometric: any;
  loading?: boolean;
  onResend?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [sending, setSending] = useState(false);

  const status = String(psychometric?.status || "Not Started").toLowerCase();
  const hasCompleted = status === "completed";
  const isPending = status === "pending";

  const handleSendLink = async () => {
    if (!onResend || sending) return;
    setSending(true);
    try {
      await onResend();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3.5 bg-canvas/70 border-b border-borderline flex items-center justify-between text-left hover:bg-canvas transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-primary flex items-center justify-center font-bold text-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider">
              DISC Personality & Behavioral Profile
            </h4>
            <p className="text-[11px] text-muted">
              Workplace behavioral tendencies, communication style, and role fit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCompleted ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-primary">
              Profile: {psychometric?.discProfile || "Completed"}
            </span>
          ) : isPending ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
              Pending Candidate Response
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              Not Started
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-5">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading DISC profile...
            </div>
          ) : hasCompleted ? (
            <>
              {/* Profile Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-canvas p-4 rounded-xl border border-borderline space-y-1.5">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Primary Style</span>
                  <div className="text-xl font-extrabold text-primary flex items-center gap-2">
                    {psychometric?.discProfile}
                    {psychometric?.roleFitLabel && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {psychometric.roleFitLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                    {psychometric?.discSummary || "Strong alignment with collaborative and goal-driven team settings."}
                  </p>
                </div>

                {/* DISC Bars */}
                <div className="space-y-3 bg-canvas p-4 rounded-xl border border-borderline">
                  <DiscBar dim="D" value={psychometric?.discD || 35} />
                  <DiscBar dim="I" value={psychometric?.discI || 65} />
                  <DiscBar dim="S" value={psychometric?.discS || 75} />
                  <DiscBar dim="C" value={psychometric?.discC || 50} />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-canvas p-4 rounded-xl border border-borderline text-center space-y-3">
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Candidate has not yet completed their DISC behavioral assessment. You can trigger an instant WhatsApp invitation.
              </p>
              {onResend && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={handleSendLink}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-3.5 h-3.5" />
                      {isPending ? "Resend DISC WhatsApp Invite" : "Send DISC Assessment Link"}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
