"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, BookOpen, CheckCircle2, Circle, Loader2, Plus, Save } from "lucide-react";
import {
  ICP_FIELDS,
  QUALIFYING_TEST_TYPES,
  emptyKit,
  kitApprovalProblems,
  kitChecklist,
  type PositionKit,
  type PositionKitRecord,
} from "@/lib/position-kit";

const input =
  "w-full px-3 py-2 bg-white border border-borderline rounded-lg text-xs text-navy focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

const PLACEHOLDERS: Partial<Record<keyof PositionKit, string>> = {
  vacancies: "e.g. 3",
  requiredExperience: "e.g. 2–5 years in salon or clinic sales",
  keyResponsibilities: "One per line",
  mustHaveSkills: "One per line",
  preferredIndustry: "e.g. Salons, aesthetics clinics, premium retail",
  nonNegotiables: "One per line — a candidate who fails one is rejected",
  redFlags: "One per line, e.g. more than 3 jobs in 2 years",
  rejectionCriteria: "One per line",
  salaryRange: "e.g. ₹25,000–35,000 per month + incentives",
};

const MULTILINE = new Set<keyof PositionKit>([
  "keyResponsibilities", "mustHaveSkills", "nonNegotiables", "redFlags", "rejectionCriteria",
]);

// Defined outside the editor so its inputs keep focus while typing.
function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 p-4 rounded-xl border border-borderline bg-canvas/40">
      <div>
        <h4 className="text-xs font-bold text-navy">{title}</h4>
        <p className="text-[10px] text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function ApprovalBadge({ record }: { record: Pick<PositionKitRecord, "approval" | "version"> }) {
  return record.approval === "Approved" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
      <BadgeCheck className="w-3 h-3" /> Approved v{record.version}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
      Draft v{record.version}
    </span>
  );
}

export default function PositionKitsTab() {
  const [kits, setKits] = useState<PositionKitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [status, setStatus] = useState("active");
  const [kit, setKit] = useState<PositionKit>(emptyKit());
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvedBy, setApprovedBy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = kits.find((k) => k.icpId === selectedId) || null;

  const load = async (selectId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/icp", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const list: PositionKitRecord[] = json.data || [];
      setKits(list);
      if (selectId) open(list.find((k) => k.icpId === selectId) || null);
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to load Position Kits" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = (rec: PositionKitRecord | null) => {
    setSelectedId(rec?.icpId || null);
    setRoleName(rec?.roleName || "");
    setStatus(rec?.status || "active");
    setKit(rec?.kit ? { ...rec.kit } : emptyKit());
    setApprovedBy(rec?.kit?.departmentHead || "");
    setMessage(null);
  };

  const dirty = useMemo(() => {
    if (!selected) return Boolean(roleName.trim()) || JSON.stringify(kit) !== JSON.stringify(emptyKit());
    return selected.roleName !== roleName.trim() || selected.status !== status || JSON.stringify(selected.kit || emptyKit()) !== JSON.stringify(kit);
  }, [selected, roleName, status, kit]);

  const set = (key: keyof PositionKit, value: string) => setKit((k) => ({ ...k, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recruitment/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", icpId: selected?.icpId, roleName, status, kit }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save");
      const wasApproved = selected?.approval === "Approved";
      await load(json.data.icpId);
      setMessage({
        ok: true,
        text: wasApproved && json.data.approval !== "Approved"
          ? `Saved as version ${json.data.version}. It needs the department head's approval again.`
          : "Saved.",
      });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setApproving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recruitment/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", icpId: selected.icpId, approvedBy }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to approve");
      await load(selected.icpId);
      setMessage({ ok: true, text: `Approved by ${json.data.approvedBy}.` });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "Failed to approve" });
    } finally {
      setApproving(false);
    }
  };

  const missing = kitApprovalProblems(roleName, kit);
  const checklist = kitChecklist({ kit, approval: selected?.approval || "Draft" });
  const editorOpen = selected !== null || selectedId === "new";

  const Field = ({ k, label, rows }: { k: keyof PositionKit; label: string; rows?: number }) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-navy">{label}</span>
      {rows || MULTILINE.has(k) ? (
        <textarea rows={rows || 3} value={kit[k]} onChange={(e) => set(k, e.target.value)} placeholder={PLACEHOLDERS[k]} className={`${input} resize-y`} />
      ) : (
        <input value={kit[k]} onChange={(e) => set(k, e.target.value)} placeholder={PLACEHOLDERS[k]} className={input} />
      )}
    </label>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4">
      {/* Kit list */}
      <div className="bg-surface rounded-xl border border-borderline shadow-card p-3 space-y-2 self-start">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-navy flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-primary" /> Position Kits
          </h3>
          <button
            onClick={() => {
              open(null);
              setSelectedId("new");
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
        {loading && !kits.length ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading...
          </div>
        ) : kits.length === 0 ? (
          <p className="text-[11px] text-muted px-1 py-4">No Position Kits yet. Create one for each open position.</p>
        ) : (
          kits.map((k) => {
            const c = kitChecklist(k);
            return (
              <button
                key={k.icpId}
                onClick={() => open(k)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  k.icpId === selectedId ? "border-primary bg-indigo-50/60" : "border-borderline hover:bg-canvas"
                } ${k.status !== "active" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-navy truncate">{k.roleName}</span>
                  <ApprovalBadge record={k} />
                </div>
                <div className="text-[10px] text-muted mt-1">
                  {k.kit ? `${c.done}/${c.total} kit items` : "Old free-text profile — open to complete"}
                  {k.status !== "active" && " · inactive"}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Editor */}
      {!editorOpen ? (
        <div className="bg-surface rounded-xl border border-borderline shadow-card p-10 text-center text-xs text-muted">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          Pick a position on the left or create a new kit. Each kit holds the Ideal Candidate Profile, the interview and
          qualifying test, and the after-joining tests — approved by the department head before recruiting starts.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-borderline shadow-card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-[14rem] space-y-1">
              <span className="text-[11px] font-semibold text-navy">Position name *</span>
              <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Sales Consultant" className={`${input} text-sm font-semibold`} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              {selected && <ApprovalBadge record={selected} />}
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} w-auto`}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {selected && !selected.kit && selected.icpContent && (
            <div className="p-3 rounded-lg bg-slate-50 border border-borderline">
              <p className="text-[11px] font-semibold text-navy mb-1">Profile text from before (read-only) — copy what you need into the fields below</p>
              <pre className="text-[10px] text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans">{selected.icpContent}</pre>
            </div>
          )}

          {/* SOP step 8 checklist */}
          <div className="flex flex-wrap gap-1.5">
            {checklist.items.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  item.done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {item.done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                {item.label}
              </span>
            ))}
          </div>

          <Section title="1. Ideal Candidate Profile" hint="Collected from the department head (SOP step 1). All of these are needed for approval.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Field({ k: "department", label: "Department" })}
              {Field({ k: "departmentHead", label: "Department head (approver) *" })}
              {ICP_FIELDS.filter((f) => !MULTILINE.has(f.key)).map((f) => (
                <React.Fragment key={f.key}>{Field({ k: f.key, label: `${f.label} *` })}</React.Fragment>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ICP_FIELDS.filter((f) => MULTILINE.has(f.key)).map((f) => (
                <React.Fragment key={f.key}>{Field({ k: f.key, label: `${f.label} *` })}</React.Fragment>
              ))}
            </div>
          </Section>

          <Section title="2. Interview & qualifying test" hint="SOP steps 3 and 6. The eight standard questions are always asked; add the role-specific ones here.">
            {Field({ k: "interviewQuestions", label: "Role-specific interview questions (one per line)", rows: 4 })}
            <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-navy">Test type</span>
                <select value={kit.qualifyingTestType} onChange={(e) => set("qualifyingTestType", e.target.value)} className={input}>
                  <option value="">Select type</option>
                  {QUALIFYING_TEST_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              {Field({ k: "qualifyingTestLink", label: "Test link (if any)" })}
            </div>
            {Field({ k: "qualifyingTest", label: "Qualifying test — what the candidate must do", rows: 3 })}
            {Field({ k: "assessmentInstructions", label: "Assessment instructions — how to run and score it", rows: 3 })}
          </Section>

          <Section title="3. Tests after joining" hint="SOP step 9. Shown to HR when recording that check on the Joiner Checks page.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Field({ k: "day1Test", label: "Day 1 test", rows: 2 })}
              {Field({ k: "day6Test", label: "Day 6 test", rows: 2 })}
              {Field({ k: "week2Test", label: "2-week test", rows: 2 })}
              {Field({ k: "month1Test", label: "1-month test", rows: 2 })}
            </div>
          </Section>

          {message && (
            <p className={`text-xs font-semibold px-3 py-2 rounded-lg border ${message.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving || !roleName.trim() || !dirty}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {selected?.approval === "Approved" && dirty ? "Save as new version" : "Save"}
            </button>

            {selected && selected.approval !== "Approved" && (
              <div className="flex flex-col items-end gap-1.5">
                {missing.length > 0 ? (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-800 max-w-md text-right">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Before approval, fill: {missing.join(", ")}.
                  </p>
                ) : dirty ? (
                  <p className="text-[11px] text-muted">Save your changes before approving.</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Approved by (department head)" className={`${input} w-56`} />
                  <button
                    onClick={approve}
                    disabled={approving || dirty || missing.length > 0 || !approvedBy.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                    Mark approved
                  </button>
                </div>
              </div>
            )}
            {selected?.approval === "Approved" && (
              <p className="text-[11px] text-emerald-700">
                Approved by {selected.approvedBy} on {new Date(selected.approvedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}.
                Editing creates version {Number(selected.version) + 1}, which needs approval again.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Kit status for a position, shown on job requisitions: recruiting should start only once it is approved. */
export function KitStatusChip({ kit }: { kit: PositionKitRecord | null }) {
  if (!kit) {
    return (
      <span title="Create a Position Kit before recruiting (SOP step 1)" className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3 h-3" /> No Position Kit
      </span>
    );
  }
  return <ApprovalBadge record={kit} />;
}
