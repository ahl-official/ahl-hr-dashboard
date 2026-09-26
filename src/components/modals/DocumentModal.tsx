"use client";

import React, { useState, useEffect } from "react";
import { X, Paperclip, Loader2, FileCheck } from "lucide-react";
import { EmployeeSummary, DocumentType, DocumentStatus } from "@/types";
import { DOCUMENT_TYPES, DOCUMENT_STATUSES } from "@/lib/constants";

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeSummary[];
  prefillEmployeeKey?: string;
  onSave: (payload: any) => Promise<boolean>;
}

export function DocumentModal({
  isOpen,
  onClose,
  employees,
  prefillEmployeeKey,
  onSave,
}: DocumentModalProps) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("Joining Letter");
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>("Pending");
  const [notes, setNotes] = useState("");
  const [uploadedBy, setUploadedBy] = useState("HR Command User");
  const [fileName, setFileName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentId, setDocumentId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDocumentId(`DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
      setEmployeeKey(prefillEmployeeKey || "");
      setDocumentType("Joining Letter");
      setDocumentStatus("Pending");
      setNotes("");
      setFileName("");
      setDriveLink("");
      setIsSubmitting(false);
    }
  }, [isOpen, prefillEmployeeKey]);

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
    if (!employeeKey || !uploadedBy.trim()) return;

    if ((documentStatus === "Uploaded" || documentStatus === "Verified") && !fileName) {
      alert("Please attach a document file before marking status as Uploaded or Verified.");
      return;
    }

    setIsSubmitting(true);
    const success = await onSave({
      documentId,
      employeeKey,
      documentType,
      documentStatus,
      fileName,
      driveLink,
      notes: notes.trim(),
      uploadedBy: uploadedBy.trim(),
    });

    setIsSubmitting(false);
    if (success) onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Attachment must be smaller than 5 MB.");
      return;
    }
    setFileName(file.name);
    setDriveLink(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />

      <div className="relative bg-surface rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-borderline z-10 my-8">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderline">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-DEFAULT">Employee Document</h3>
              <p className="text-xs text-muted">Upload and track verification of official HR files.</p>
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
              onChange={(e) => setEmployeeKey(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500"
            >
              <option value="">Select Employee...</option>
              {employees.map((emp) => (
                <option key={emp.employeeKey} value={emp.employeeKey}>
                  {emp.fullName} ({emp.employeeId || "No ID"}) — {emp.department}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Document Type *
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Verification Status *
              </label>
              <select
                value={documentStatus}
                onChange={(e) => setDocumentStatus(e.target.value as any)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-indigo-500"
              >
                {DOCUMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Attach Document (PDF, DOC, PNG, JPG ≤ 5MB)
            </label>
            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer transition">
              <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{fileName || "Click to browse or drop document"}</span>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={2}
              placeholder="e.g. Countersigned copy on file in locker, original Aadhaar verified..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Uploaded / Verified By *
            </label>
            <input
              type="text"
              value={uploadedBy}
              onChange={(e) => setUploadedBy(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
            />
          </div>

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
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? "Saving Document..." : "Save Document Record"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
