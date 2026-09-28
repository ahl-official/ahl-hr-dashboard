"use client";

import React, { useState, useEffect } from "react";
import { X, Paperclip, Loader2 } from "lucide-react";
import { EmployeeSummary, MeetingType, MeetingStatus } from "@/types";
import { MEETING_TYPES, MEETING_STATUSES } from "@/lib/constants";
import { getTodayLocalIsoDate } from "@/lib/date-utils";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeSummary[];
  prefill?: {
    employeeKey?: string;
    milestone?: string;
    scheduledDate?: string;
    meetingType?: MeetingType;
    warningGiven?: "Yes" | "No";
    discussionNotes?: string;
  } | null;
  onSave: (payload: any) => Promise<boolean>;
}

export function MeetingModal({
  isOpen,
  onClose,
  employees,
  prefill,
  onSave,
}: MeetingModalProps) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("General");
  const [milestone, setMilestone] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [recordStatus, setRecordStatus] = useState<MeetingStatus>("Open");
  const [warningGiven, setWarningGiven] = useState<"Yes" | "No">("No");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [recordedBy, setRecordedBy] = useState("HR Command User");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentLink, setAttachmentLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingId, setMeetingId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMeetingId(`MTG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
      if (prefill) {
        setEmployeeKey(prefill.employeeKey || "");
        setMilestone(prefill.milestone || "");
        setScheduledDate(prefill.scheduledDate || "");
        setMeetingType(prefill.meetingType || "General");
        setMeetingDate(prefill.scheduledDate ? prefill.scheduledDate : getTodayLocalIsoDate());
        setWarningGiven(prefill.warningGiven || (prefill.meetingType === "Warning" ? "Yes" : "No"));
        setDiscussionNotes(prefill.discussionNotes || "");
      } else {
        setEmployeeKey("");
        setMilestone("");
        setScheduledDate("");
        setMeetingDate(getTodayLocalIsoDate());
        setMeetingType("General");
        setWarningGiven("No");
        setDiscussionNotes("");
      }
      setRecordStatus("Open");
      setActionTaken("");
      setNextFollowUpDate("");
      setAttachmentName("");
      setAttachmentLink("");
      setIsSubmitting(false);
    }
  }, [isOpen, prefill]);

  // Handle escape key
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
    if (!employeeKey || !discussionNotes.trim() || !recordedBy.trim()) return;

    setIsSubmitting(true);
    const success = await onSave({
      meetingId,
      employeeKey,
      meetingType,
      milestone: milestone.trim(),
      scheduledDate,
      meetingDate,
      recordStatus,
      warningGiven,
      discussionNotes: discussionNotes.trim(),
      actionTaken: actionTaken.trim(),
      nextFollowUpDate,
      recordedBy: recordedBy.trim(),
      attachmentLink,
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
    setAttachmentName(file.name);
    // Simulate safe client blob link for frontend demo
    setAttachmentLink(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />

      <div className="relative bg-surface rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-borderline z-10 my-8">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderline">
          <div>
            <h3 className="text-lg font-bold text-navy-DEFAULT">Record HR Meeting / Review</h3>
            <p className="text-xs text-muted">Log onboarding milestone, review, warning, or follow-up note.</p>
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
          {/* Employee & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Meeting Type *
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as any)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Milestone & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Milestone Label
              </label>
              <input
                type="text"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                placeholder="e.g. 7-day feedback, 1-year"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Meeting Date
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status & Warning Given */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Record Status
              </label>
              <select
                value={recordStatus}
                onChange={(e) => setRecordStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-indigo-500"
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Formal Warning?
              </label>
              <select
                value={warningGiven}
                onChange={(e) => setWarningGiven(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:border-indigo-500"
              >
                <option value="No">No</option>
                <option value="Yes">Yes (Disciplinary)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Next Follow-Up Date
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Discussion Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Discussion Notes *
              </label>
              <span className="text-[11px] text-muted">{discussionNotes.length} / 5,000 chars</span>
            </div>
            <textarea
              value={discussionNotes}
              onChange={(e) => setDiscussionNotes(e.target.value.slice(0, 5000))}
              required
              rows={3}
              placeholder="Key talking points, feedback discussed, performance observations..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
            />
          </div>

          {/* Action Taken */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Action Taken / Next Steps
              </label>
              <span className="text-[11px] text-muted">{actionTaken.length} / 3,000 chars</span>
            </div>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value.slice(0, 3000))}
              rows={2}
              placeholder="Decisions made, targets set, equipment requested..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
            />
          </div>

          {/* Recorded By & Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Recorded By *
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Optional Attachment (PDF/DOC/PNG/JPG ≤ 5MB)
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer">
                <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{attachmentName || "Select file attachment"}</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
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
              <span>{isSubmitting ? "Saving Record..." : "Save Meeting Record"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
