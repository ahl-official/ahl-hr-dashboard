"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Clock, Copy, Loader2, MonitorSmartphone, Send, ShieldCheck, Smartphone } from "lucide-react";
import { COMPANIES } from "@/lib/constants";
import { formatDateTime } from "@/lib/date-utils";

type Mode = "link" | "device";
type Invite = { inviteId: string; name: string; company: string; mode: Mode; status: string; createdAt: string; employeeId: string };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const EMPTY = { name: "", mobile: "", company: COMPANIES[0] as string, department: "", designation: "", manager: "", doj: today() };

const STATUS_STYLE: Record<string, string> = {
  Invited: "bg-slate-100 text-slate-700",
  Opened: "bg-sky-50 text-sky-700",
  Processing: "bg-amber-50 text-amber-800",
  Submitted: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

const input = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
const lbl = "block text-xs font-medium text-slate-600 mb-1";

const OPTIONS: Array<{ mode: Mode; icon: typeof Send; title: string; blurb: string; points: Array<[typeof Send, string]> }> = [
  {
    mode: "link",
    icon: Send,
    title: "Send form link on WhatsApp",
    blurb: "Best when the employee is not with you.",
    points: [[Smartphone, "They fill it on their own phone"], [Clock, "Link is valid for 7 days"], [BellRing, "You get a WhatsApp when they submit"]],
  },
  {
    mode: "device",
    icon: MonitorSmartphone,
    title: "Hand over this device",
    blurb: "Best when the employee is sitting with you.",
    points: [[MonitorSmartphone, "The form opens full screen here"], [ShieldCheck, "Nothing else on this device is shown"], [Clock, "Link is valid for 24 hours"]],
  },
];

export default function AddEmployeePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-muted">Loading...</p>}>
      <AddEmployeeForm />
    </Suspense>
  );
}

function AddEmployeeForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [departments, setDepartments] = useState<string[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ url: string; sendError: string; sent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadInvites = () => fetch("/api/invites").then((r) => r.json()).then((d) => setInvites(d?.data ?? [])).catch(() => {});
  useEffect(() => {
    fetch("/api/meta/departments").then((r) => r.json()).then((d) => setDepartments((d?.data ?? []).map((x: any) => x.departmentName))).catch(() => {});
    loadInvites();

    const nameParam = searchParams.get("name");
    const mobileParam = searchParams.get("mobile");
    const designationParam = searchParams.get("designation");
    if (nameParam || mobileParam || designationParam) {
      setForm((f) => ({
        ...f,
        name: nameParam || f.name,
        mobile: mobileParam || f.mobile,
        designation: designationParam || f.designation,
      }));
    }
  }, [searchParams]);

  const set = (k: keyof typeof EMPTY, v: string) => { setError(""); setForm((f) => ({ ...f, [k]: v })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, mode }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not create the invitation");
      if (mode === "device") {
        // This screen becomes the employee's form; replace() so Back does not return to the dashboard by accident.
        window.location.replace(`/join/${d.data.token}?device=1`);
        return;
      }
      setSent(d.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setSent(null); setMode(null); setForm(EMPTY); loadInvites(); };

  /* ---------- link sent ---------- */
  if (sent) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-borderline rounded-card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-navy-DEFAULT">{sent.sent ? "Form link sent" : "Link created"}</h2>
        <p className="text-sm text-muted mt-1">
          {sent.sent
            ? `Sent to ${form.name} on WhatsApp. It is valid for 7 days.`
            : `WhatsApp could not be sent${sent.sendError ? ` (${sent.sendError})` : ""}. You can share the link below yourself.`}
        </p>
        <div className="mt-5 flex items-center gap-2 bg-slate-50 border border-borderline rounded-md p-2">
          <input readOnly value={sent.url} className="flex-1 bg-transparent text-xs font-mono text-slate-600 px-2 outline-none min-w-0" onFocus={(e) => e.currentTarget.select()} />
          <button
            onClick={() => { navigator.clipboard?.writeText(sent.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-md border border-borderline bg-white hover:bg-slate-50 shrink-0"
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button onClick={reset} className="mt-6 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Add another employee</button>
      </div>
    );
  }

  /* ---------- details form ---------- */
  if (mode) {
    return (
      <form onSubmit={submit} className="max-w-3xl bg-surface border border-borderline rounded-card">
        <div className="px-6 py-4 border-b border-borderline flex items-center gap-3">
          <button type="button" onClick={() => setMode(null)} className="p-1.5 -ml-1.5 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-navy-DEFAULT">{mode === "link" ? "Send form link on WhatsApp" : "Hand over this device"}</h2>
            <p className="text-xs text-muted">The employee sees these details on the form but cannot change them.</p>
          </div>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className={lbl}>Employee name *</label><input required className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></div>
          {mode === "link" && (
            <div className="sm:col-span-2"><label className={lbl}>WhatsApp number *</label><input required inputMode="numeric" className={input} value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10-digit mobile number" /></div>
          )}
          <div><label className={lbl}>Company *</label>
            <select required className={input} value={form.company} onChange={(e) => set("company", e.target.value)}>{COMPANIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={lbl}>Department *</label>
            <select required className={input} value={form.department} onChange={(e) => set("department", e.target.value)}><option value="">Select department</option>{departments.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className={lbl}>Designation *</label><input required className={input} value={form.designation} onChange={(e) => set("designation", e.target.value)} /></div>
          <div><label className={lbl}>Reporting manager *</label><input required className={input} value={form.manager} onChange={(e) => set("manager", e.target.value)} /></div>
          <div><label className={lbl}>Joining date *</label><input required type="date" className={input} value={form.doj} onChange={(e) => set("doj", e.target.value)} /></div>
        </div>

        {error && <p role="alert" className="mx-6 mb-4 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}

        <div className="px-6 py-4 border-t border-borderline bg-slate-50/60 rounded-b-card flex items-center justify-between gap-3">
          <p className="text-xs text-muted">The Employee ID is created automatically when the form is submitted.</p>
          <button disabled={busy} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 shrink-0">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "link" ? "Send on WhatsApp" : "Open form for the employee"}
          </button>
        </div>
      </form>
    );
  }

  /* ---------- choose ---------- */
  return (
    <div className="max-w-5xl">
      <div className="grid md:grid-cols-2 gap-5">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          return (
            <div key={o.mode} className="bg-surface border border-borderline rounded-card p-6 flex flex-col">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-navy-DEFAULT leading-tight">{o.title}</h2>
                  <p className="text-sm text-muted mt-1">{o.blurb}</p>
                </div>
              </div>
              <ul className="mt-5 pt-5 border-t border-borderline space-y-2.5 text-sm text-slate-700 flex-1">
                {o.points.map(([PIcon, text]) => (
                  <li key={text} className="flex items-center gap-2.5"><PIcon className="w-4 h-4 text-indigo-600 shrink-0" />{text}</li>
                ))}
              </ul>
              <button
                onClick={() => setMode(o.mode)}
                className="mt-6 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-navy-DEFAULT mb-3">Recent invitations</h3>
        {invites.length === 0 ? (
          <p className="text-sm text-muted bg-surface border border-borderline rounded-card px-4 py-6 text-center">No invitations yet.</p>
        ) : (
          <div className="bg-surface border border-borderline rounded-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-muted border-b border-borderline">
                <tr>
                  <th className="text-left py-2.5 px-4">Employee</th>
                  <th className="text-left py-2.5 px-4 hidden sm:table-cell">How</th>
                  <th className="text-left py-2.5 px-4">Status</th>
                  <th className="text-left py-2.5 px-4 hidden md:table-cell">Employee ID</th>
                  <th className="text-right py-2.5 px-4 hidden sm:table-cell">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {invites.map((i) => (
                  <tr key={i.inviteId}>
                    <td className="py-2.5 px-4"><div className="font-medium text-navy-DEFAULT">{i.name}</div><div className="text-xs text-muted">{i.company}</div></td>
                    <td className="py-2.5 px-4 hidden sm:table-cell text-slate-600">{i.mode === "device" ? "On a device" : "WhatsApp"}</td>
                    <td className="py-2.5 px-4"><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_STYLE[i.status] ?? STATUS_STYLE.Invited}`}>{i.status}</span></td>
                    <td className="py-2.5 px-4 hidden md:table-cell font-mono text-xs text-slate-600">{i.employeeId || "-"}</td>
                    <td className="py-2.5 px-4 hidden sm:table-cell text-right text-xs text-muted whitespace-nowrap">{formatDateTime(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
