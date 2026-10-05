"use client";

import React, { useState, useEffect } from "react";
import { X, UserCheck, UserX, AlertTriangle, Loader2, Paperclip } from "lucide-react";
import { EmployeeSummary, EmploymentStatus } from "@/types";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeSummary[];
  prefillEmployeeKey?: string;
  onSave: (payload: any) => Promise<boolean>;
}

export function StatusModal({
  isOpen,
  onClose,
  employees,
  prefillEmployeeKey,
  onSave,
}: StatusModalProps) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>("Active");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [exitReason, setExitReason] = useState("");
  const updatedBy = "HR"; // becomes the signed-in user once there is a login
  const [relievingName, setRelievingName] = useState("");
  const [relievingLetterLink, setRelievingLetterLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const selectedKey = prefillEmployeeKey || "";
      setEmployeeKey(selectedKey);
      const emp = employees.find((e) => e.employeeKey === selectedKey);
      if (emp) {
        setEmploymentStatus(emp.employmentStatus);
        setLastWorkingDate(emp.statusRecord?.lastWorkingDate || "");
        setExitReason(emp.statusRecord?.exitReason || "");
      } else {
        setEmploymentStatus("Active");
        setLastWorkingDate("");
        setExitReason("");
      }
      setRelievingName("");
      setRelievingLetterLink("");
      setIsSubmitting(false);
    }
  }, [isOpen, prefillEmployeeKey, employees]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeKey) return;

    if (employmentStatus === "Left" && !lastWorkingDate) {
      alert("Last working date is mandatory when changing status to Left.");
      return;
    }

    setIsSubmitting(true);
    const success = await onSave({
      operationId: `STS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      employeeKey,
      employmentStatus,
      lastWorkingDate,
      exitReason: exitReason.trim(),
      updatedBy: updatedBy.trim(),
      relievingLetterLink,
    });

    setIsSubmitting(false);
    if (success) onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File must be smaller than 5 MB.");
      return;
    }
    setRelievingName(file.name);
    setRelievingLetterLink(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-navy-900/60" onClick={!isSubmitting ? onClose : undefined} />

      <div className="relative bg-surface rounded-2xl max-w-lg w-full p-6 shadow-md border border-borderline z-10 my-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderline">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${employmentStatus === "Left" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {employmentStatus === "Left" ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-DEFAULT">Employment Status</h3>
              <p className="text-xs text-muted">Update active employment or record exit details.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Employee *
            </label>
            <select
              value={employeeKey}
              onChange={(e) => {
                setEmployeeKey(e.target.value);
                const emp = employees.find((x) => x.employeeKey === e.target.value);
                if (emp) setEmploymentStatus(emp.employmentStatus);
              }}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500"
            >
              <option value="">Select Employee...</option>
              {employees.map((emp) => (
                <option key={emp.employeeKey} value={emp.employeeKey}>
                  {emp.fullName} ({emp.employeeId || "No ID"}) — Current: {emp.employmentStatus}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Employment Status *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEmploymentStatus("Active")}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  employmentStatus === "Active"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Active Employee</span>
              </button>

              <button
                type="button"
                onClick={() => setEmploymentStatus("Left")}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  employmentStatus === "Left"
                    ? "bg-rose-50 text-rose-800 border-rose-500 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <UserX className="w-4 h-4 text-rose-600" />
                <span>Relieved / Left</span>
              </button>
            </div>
          </div>

          {employmentStatus === "Left" && (
            <div className="space-y-4 p-4 rounded-xl bg-rose-50/60 border border-rose-200">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Exit Protocol Required</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Last Working Date *
                </label>
                <input
                  type="date"
                  value={lastWorkingDate}
                  onChange={(e) => setLastWorkingDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exit Reason / Separation Notes
                </label>
                <textarea
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value.slice(0, 2000))}
                  rows={2}
                  placeholder="e.g. Higher education, personal relocation, career progression..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Relieving Letter (PDF, DOC ≤ 5MB)
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-white border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{relievingName || "Attach Relieving Letter"}</span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-borderline flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? "Updating..." : "Save Employment Status"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
