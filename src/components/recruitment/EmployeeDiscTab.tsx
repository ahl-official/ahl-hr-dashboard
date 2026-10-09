"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  MessageCircle,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Loader2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  X,
  Filter,
} from "lucide-react";

interface EmployeeDiscItem {
  employeeId: string;
  fullName: string;
  designation: string;
  department: string;
  company: string;
  mobile: string;
  companyEmail: string;
  discStatus: "Completed" | "Pending" | "Not Started";
  discProfile: string;
  discD: number;
  discI: number;
  discS: number;
  discC: number;
  discSummary: string;
  roleFitScore: number;
  roleFitLabel: string;
  testSentAt: string | null;
  testCompletedAt: string | null;
}

export default function EmployeeDiscTab() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDiscItem[]>([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    completed: 0,
    pending: 0,
    notStarted: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<EmployeeDiscItem | null>(null);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/recruitment/employee-disc");
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data.list || []);
        setStats(json.data.stats || { totalActive: 0, completed: 0, pending: 0, notStarted: 0 });
      }
    } catch (err) {
      console.error("Failed to load employee DISC roster:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const getTestUrl = (employeeId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/psychometric/${encodeURIComponent(employeeId)}?entity=Employee`;
  };

  const getWhatsAppLink = (emp: EmployeeDiscItem) => {
    const cleanPhone = String(emp.mobile || "").replace(/\D/g, "");
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const testUrl = getTestUrl(emp.employeeId);
    const firstName = emp.fullName.split(" ")[0] || emp.fullName;
    const msg = `Hi ${firstName},\n\nPlease take this short DISC personality & workplace assessment (~10 minutes). Your assessment link:\n\n${testUrl}\n\n– American Hairline HR`;
    return waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}` : "";
  };

  const handleCopyLink = (emp: EmployeeDiscItem) => {
    const url = getTestUrl(emp.employeeId);
    navigator.clipboard.writeText(url);
    setCopiedId(emp.employeeId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendSingle = async (emp: EmployeeDiscItem) => {
    setSendingId(emp.employeeId);
    try {
      const res = await fetch("/api/recruitment/employee-disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.employeeId }),
      });
      const json = await res.json();
      if (json.success) {
        // Open WhatsApp web if phone available
        const waLink = getWhatsAppLink(emp);
        if (waLink) {
          window.open(waLink, "_blank");
        }
        await fetchRoster();
      } else {
        alert(json.message || "Failed to trigger invite");
      }
    } catch (e) {
      alert("Error sending invitation");
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkSend = async () => {
    const pendingEmployees = employees.filter((e) => e.discStatus !== "Completed");
    if (pendingEmployees.length === 0) {
      alert("All active employees have already completed their DISC assessments!");
      return;
    }

    if (
      !window.confirm(
        `This will record DISC assessment invitations for ${pendingEmployees.length} employees with pending or unstarted tests. Proceed?`
      )
    ) {
      return;
    }

    setBulkSending(true);
    try {
      const res = await fetch("/api/recruitment/employee-disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: pendingEmployees.map((e) => e.employeeId) }),
      });
      const json = await res.json();
      if (json.success) {
        alert(
          `Successfully recorded invitations for ${json.data.sentCount} employees! You can now send WhatsApp invites directly via the table buttons.`
        );
        await fetchRoster();
      } else {
        alert(json.message || "Bulk send failed");
      }
    } catch (e) {
      alert("Error executing bulk invitation");
    } finally {
      setBulkSending(false);
    }
  };

  // Departments list for filter dropdown
  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  // Filtered list
  const filtered = employees.filter((e) => {
    const matchesSearch =
      search === "" ||
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()) ||
      e.mobile.includes(search);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && e.discStatus === "Completed") ||
      (statusFilter === "pending" && e.discStatus === "Pending") ||
      (statusFilter === "not_started" && e.discStatus === "Not Started");

    const matchesDept = departmentFilter === "all" || e.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold">
            <span>Total Active Staff</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-navy mt-1">{stats.totalActive}</div>
          <span className="text-[11px] text-muted">Active in employee roster</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold">
            <span>Completed DISC</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{stats.completed}</div>
          <span className="text-[11px] text-muted">
            {stats.totalActive ? Math.round((stats.completed / stats.totalActive) * 100) : 0}% completion rate
          </span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold">
            <span>Pending Response</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{stats.pending}</div>
          <span className="text-[11px] text-muted">Test link sent, awaiting answers</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card">
          <div className="flex items-center justify-between text-muted text-xs font-semibold">
            <span>Not Started</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700 mt-1">{stats.notStarted}</div>
          <span className="text-[11px] text-muted">No assessment link sent yet</span>
        </div>
      </div>

      {/* Filters and Actions Bar */}
      <div className="bg-surface p-4 rounded-xl border border-borderline shadow-card flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff, ID, role, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed ({stats.completed})</option>
            <option value="pending">Pending Response ({stats.pending})</option>
            <option value="not_started">Not Sent ({stats.notStarted})</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchRoster}
            title="Refresh Roster"
            className="p-2 border border-borderline rounded-lg text-muted hover:text-navy hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bulk Action */}
        <div className="w-full md:w-auto flex justify-end">
          <button
            type="button"
            onClick={handleBulkSend}
            disabled={bulkSending || stats.notStarted + stats.pending === 0}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {bulkSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Preparing Bulk Invites...
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Batch Invite All Pending & Unsent ({stats.notStarted + stats.pending})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-surface rounded-xl border border-borderline shadow-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Loading employee DISC roster from Google Sheets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted">
            No employees match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-borderline text-muted uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role & Dept</th>
                  <th className="px-4 py-3">Mobile (WhatsApp)</th>
                  <th className="px-4 py-3">DISC Status</th>
                  <th className="px-4 py-3">Profile Code</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {filtered.map((emp) => {
                  const isCompleted = emp.discStatus === "Completed";
                  const isPending = emp.discStatus === "Pending";
                  const isSending = sendingId === emp.employeeId;
                  const isCopied = copiedId === emp.employeeId;

                  return (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name & ID */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-navy group-hover:text-primary transition-colors">
                          {emp.fullName}
                        </div>
                        <div className="text-[11px] text-muted font-mono">{emp.employeeId}</div>
                      </td>

                      {/* Designation */}
                      <td className="px-4 py-3.5">
                        <div className="text-navy font-medium">{emp.designation}</div>
                        <div className="text-[11px] text-muted">{emp.department}</div>
                      </td>

                      {/* Mobile */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-slate-700">{emp.mobile || "—"}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending Response
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Not Sent
                          </span>
                        )}
                      </td>

                      {/* Profile Badge */}
                      <td className="px-4 py-3.5">
                        {isCompleted ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProfile(emp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-primary font-black text-xs hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            {emp.discProfile || "Profile"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Link Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(emp)}
                            title="Copy Employee Test Link"
                            className="p-1.5 rounded-lg border border-borderline hover:bg-slate-100 text-muted hover:text-navy transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* WhatsApp Action Button */}
                          {isCompleted ? (
                            <button
                              type="button"
                              onClick={() => setSelectedProfile(emp)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-primary bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                              View Profile
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => handleSendSingle(emp)}
                              className={`px-3 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs ${
                                isPending
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                              }`}
                            >
                              {isSending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <MessageCircle className="w-3 h-3" />
                              )}
                              {isPending ? "Resend Invite" : "Send WhatsApp"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Employee DISC Profile Drawer/Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-borderline shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-borderline bg-canvas flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy">{selectedProfile.fullName}</h3>
                <p className="text-xs text-muted">
                  {selectedProfile.designation} • {selectedProfile.employeeId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="p-1 rounded-lg text-muted hover:text-navy hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  DISC Style
                </span>
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-primary font-black text-sm rounded-lg">
                  {selectedProfile.discProfile}
                </span>
              </div>

              <p className="text-xs text-navy leading-relaxed bg-canvas p-3.5 rounded-xl border border-borderline">
                {selectedProfile.discSummary || "Strong alignment with collaborative and goal-driven team settings."}
              </p>

              {/* Dimension Bars */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-rose-700">
                    <span>D · Dominance</span>
                    <span>{selectedProfile.discD}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${selectedProfile.discD}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-amber-700">
                    <span>I · Influence</span>
                    <span>{selectedProfile.discI}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${selectedProfile.discI}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-emerald-700">
                    <span>S · Steadiness</span>
                    <span>{selectedProfile.discS}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${selectedProfile.discS}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-sky-700">
                    <span>C · Conscientiousness</span>
                    <span>{selectedProfile.discC}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${selectedProfile.discC}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted pt-2 border-t border-borderline flex justify-between">
                <span>Completed: {selectedProfile.testCompletedAt ? new Date(selectedProfile.testCompletedAt).toLocaleDateString() : "Saved"}</span>
                <span>Mobile: {selectedProfile.mobile}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
