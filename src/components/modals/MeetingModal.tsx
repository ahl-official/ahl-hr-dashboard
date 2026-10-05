"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { EmployeeSummary, MeetingType } from "@/types";
import { MEETING_TYPES } from "@/lib/constants";
import { getTodayLocalIsoDate } from "@/lib/date-utils";
import { deriveMeetingColumns, validateMeetingForm } from "@/lib/meeting-rules";
import { Modal } from "@/components/ui/Modal";

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

const field = "w-full h-10 px-3 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
const label = "block text-xs font-medium text-slate-600 mb-1";

export function MeetingModal({ isOpen, onClose, employees, prefill, onSave }: MeetingModalProps) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("General");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [warningChecked, setWarningChecked] = useState(false);
  const [followUpOn, setFollowUpOn] = useState(false);
  const [action, setAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [milestone, setMilestone] = useState(""); // set only when opened from a review; not shown
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingId, setMeetingId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMeetingId(`MTG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    setEmployeeKey(prefill?.employeeKey || "");
    setMeetingType(prefill?.meetingType || "General");
    setDate(prefill?.scheduledDate || getTodayLocalIsoDate());
    setNotes(prefill?.discussionNotes || "");
    setWarningChecked(prefill?.warningGiven === "Yes");
    setMilestone(prefill?.milestone || "");
    setFollowUpOn(false);
    setAction("");
    setFollowUpDate("");
    setError("");
    setIsSubmitting(false);
  }, [isOpen, prefill]);

  const isWarningType = meetingType === "Warning";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateMeetingForm({ employeeKey, notes, date, followUpOn, followUpDate });
    if (problem) return setError(problem);

    setIsSubmitting(true);
    const cols = deriveMeetingColumns({ date, followUpDate: followUpOn ? followUpDate : "", today: getTodayLocalIsoDate(), meetingType, warningChecked });
    const ok = await onSave({
      meetingId,
      employeeKey,
      meetingType,
      milestone,
      ...cols,
      discussionNotes: notes.trim(),
      actionTaken: followUpOn ? action.trim() : "",
      nextFollowUpDate: followUpOn ? followUpDate : "",
      recordedBy: "HR", // becomes the signed-in user's name once there is a login
      attachmentLink: "",
    });
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      busy={isSubmitting}
      title="Record meeting"
      subtitle="Log a review, discussion, warning or follow-up."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="h-10 px-4 rounded-md border border-borderline bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" form="meeting-form" disabled={isSubmitting} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save record
          </button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Employee *</label>
          <select value={employeeKey} onChange={(e) => { setError(""); setEmployeeKey(e.target.value); }} className={field} autoFocus={!prefill?.employeeKey}>
            <option value="">Select employee</option>
            {employees.filter((e) => e.employmentStatus === "Active").map((e) => (
              <option key={e.employeeKey} value={e.employeeKey}>{e.fullName} ({e.employeeId || "no ID"})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Type *</label>
            <select value={meetingType} onChange={(e) => setMeetingType(e.target.value as MeetingType)} className={field}>
              {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Date *</label>
            <input type="date" value={date} onChange={(e) => { setError(""); setDate(e.target.value); }} className={field} />
          </div>
        </div>

        <div>
          <label className={label}>Notes *</label>
          <textarea
            value={notes}
            onChange={(e) => { setError(""); setNotes(e.target.value); }}
            rows={4}
            maxLength={5000}
            placeholder="What was discussed or decided"
            className="w-full px-3 py-2 bg-white border border-borderline rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
          />
        </div>

        <div className="space-y-2.5 pt-1">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={isWarningType || warningChecked} disabled={isWarningType} onChange={(e) => setWarningChecked(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            This is a formal warning
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={followUpOn} onChange={(e) => { setError(""); setFollowUpOn(e.target.checked); }} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Add a follow-up
          </label>
        </div>

        {followUpOn && (
          <div className="grid sm:grid-cols-[1fr_11rem] gap-4 p-4 rounded-md bg-slate-50 border border-borderline">
            <div>
              <label className={label}>Action / next step</label>
              <input value={action} onChange={(e) => setAction(e.target.value)} maxLength={3000} placeholder="e.g. Collect signed policy" className={field} />
            </div>
            <div>
              <label className={label}>Due date *</label>
              <input type="date" value={followUpDate} min={date} onChange={(e) => { setError(""); setFollowUpDate(e.target.value); }} className={field} />
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
