"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Unlock,
  FileText,
  Calendar,
  ShieldCheck,
  Building,
  User,
  CreditCard,
  Target,
  FileCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { EmployeeSummary, DocumentRecord, MeetingRecord } from "@/types";
import { initials, formatExactTenure, formatDisplayDate, getTodayLocalIsoDate } from "@/lib/date-utils";
import { SENSITIVE_FIELDS_HR_MASK } from "@/lib/constants";

interface EmployeeProfileDrawerProps {
  employee: EmployeeSummary | null;
  documents: DocumentRecord[];
  meetings?: MeetingRecord[];
  onClose: () => void;
  onOpenMeeting: (employeeKey: string, prefill?: any) => void;
  onOpenDocument: (employeeKey: string) => void;
  onOpenStatus: (employeeKey: string) => void;
}

export function EmployeeProfileDrawer({
  employee,
  documents,
  meetings = [],
  onClose,
  onOpenMeeting,
  onOpenDocument,
  onOpenStatus,
}: EmployeeProfileDrawerProps) {
  const [unmasked, setUnmasked] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && employee) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [employee, onClose]);

  if (!employee) return null;

  // Filter meetings for this employee
  const employeeMeetings = meetings.filter((m) => m.employeeKey === employee.employeeKey);
  const redFlagMeetings = employeeMeetings.filter(
    (m) => m.warningGiven === "Yes" || m.meetingType === "Warning"
  );
  const activeRedFlag = redFlagMeetings.find((m) => m.recordStatus === "Open") || redFlagMeetings[0];

  const todayStr = getTodayLocalIsoDate();
  const pendingActions = employeeMeetings.filter(
    (m) => m.nextFollowUpDate && m.recordStatus === "Open"
  );

  // Categorize master fields into the 6 canonical groups
  const masterFields = employee.masterFields || [];
  const groups: Record<string, { label: string; value: string }[]> = {
    "Employment & role": [],
    "Personal & contact": [],
    "Payroll & banking": [],
    "Goals & company": [],
    "Documents & declarations": [],
    "Other master data": [],
  };

  masterFields.forEach((field) => {
    const lbl = String(field.label || "Other").toLowerCase();
    let group = "Other master data";
    if (/employee id|company$|designation|department|reporting manager|joining|experience/.test(lbl)) {
      group = "Employment & role";
    } else if (/full name|birth|gender|blood|address|mobile|e-mail|email|father|mother|emergency|relationship|siblings|hobbies/.test(lbl)) {
      group = "Personal & contact";
    } else if (/bank|branch|account|ifsc|salary|increment/.test(lbl)) {
      group = "Payroll & banking";
    } else if (/goal|strength|resource requirement|company vision|company assets/.test(lbl)) {
      group = "Goals & company";
    } else if (/aadhar|pan |pan$|dietary|political|vehicle|housing|digital signature|pdf link|^date$/.test(lbl)) {
      group = "Documents & declarations";
    }
    groups[group].push(field);
  });

  // Required HR documents check
  const employeeDocs = documents.filter((d) => d.employeeKey === employee.employeeKey);
  const requiredDocs = ["Joining Letter", "Policy Signing"];
  const docChecklist = requiredDocs.map((type) => {
    const record = employeeDocs.find((d) => d.documentType === type);
    return {
      type,
      status: record ? record.documentStatus : "Missing",
      link: record?.driveLink || null,
    };
  });

  const isLeft = employee.employmentStatus === "Left";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-900/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-surface h-full shadow-md flex flex-col z-10 overflow-hidden border-l border-borderline">
        {/* Header Bar */}
        <div className="p-4 sm:px-6 border-b border-borderline flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Employee Dossier
            </span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
              {employee.employeeId || employee.employeeKey}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sensitive Data Reveal Toggle */}
            <button
              onClick={() => setUnmasked(!unmasked)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition ${
                unmasked
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-surface text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
              title="Reveal confidential statutory & compensation details"
            >
              {unmasked ? <Unlock className="w-3.5 h-3.5 text-amber-700" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
              <span>{unmasked ? "Confidential Unmasked" : "Mask Sensitive"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Hero Profile Header */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-300 flex items-center justify-center text-white font-semibold text-xl shadow-md shrink-0">
                  {initials(employee.fullName)}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {employee.fullName}
                  </h2>
                  <p className="text-sm text-slate-300">
                    {employee.designation} · {employee.department}
                  </p>
                  <p className="text-xs text-indigo-300 font-medium mt-0.5">{employee.company}</p>
                </div>
              </div>

              <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    isLeft
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {employee.employmentStatus}
                </span>
                <div>
                  <span className="text-[11px] text-slate-400 block">Exact Tenure</span>
                  <span className="text-xs font-bold text-white">
                    {formatExactTenure(employee.doj)}
                  </span>
                </div>
              </div>
            </div>

            {/* Phone number */}
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-mono">
                📱 {employee.mobile || "No phone listed"}
              </span>
            </div>
          </div>

          {/* 🚩 PROMINENT RED FLAG BANNER (If Active Warning Exists) */}
          {activeRedFlag && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-rose-600 text-white">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-900">
                    Active HR Red Flag / Behavioral Concern
                  </span>
                </div>
                <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {formatDisplayDate(activeRedFlag.meetingDate || activeRedFlag.scheduledDate)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/90 border border-rose-200 text-xs text-rose-900 leading-relaxed font-medium">
                <strong className="text-rose-950 block mb-0.5">HR Concern Note:</strong>
                "{activeRedFlag.discussionNotes}"
              </div>

              {activeRedFlag.actionTaken && (
                <div className="mt-2.5 text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                    Required Action
                  </span>
                  <span>{activeRedFlag.actionTaken}</span>
                </div>
              )}

              {activeRedFlag.recordedBy && (
                <span className="block mt-2 text-[10px] text-rose-600 font-medium">
                  Recorded by: {activeRedFlag.recordedBy}
                </span>
              )}
            </div>
          )}

          {/* ⏰ PENDING ACTION NOTES CALLOUT (If Present) */}
          {pendingActions.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                    Pending Follow-Up Action ({pendingActions.length})
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {pendingActions.map((pa) => {
                  const isOverdue = pa.nextFollowUpDate < todayStr;
                  return (
                    <div
                      key={pa.meetingId}
                      className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-navy-DEFAULT">{pa.meetingType}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isOverdue ? "⚠️ Overdue: " : "Due: "}
                          {formatDisplayDate(pa.nextFollowUpDate)}
                        </span>
                      </div>
                      <p className="text-slate-700">{pa.actionTaken || pa.discussionNotes}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Action Buttons (4 Action Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => onOpenMeeting(employee.employeeKey, { meetingType: "General" })}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition border border-indigo-200"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Meeting</span>
            </button>

            {/* 🚩 Log Red Flag / Concern Button */}
            <button
              onClick={() =>
                onOpenMeeting(employee.employeeKey, {
                  meetingType: "Warning",
                  warningGiven: "Yes",
                })
              }
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold text-xs transition border border-rose-200"
              title="Record conduct or performance Red Flag note"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 group-hover:text-white" />
              <span>Log Red Flag</span>
            </button>

            <button
              onClick={() => onOpenDocument(employee.employeeKey)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-700 text-slate-700 hover:text-white font-bold text-xs transition border border-slate-200"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Document</span>
            </button>

            <button
              onClick={() => onOpenStatus(employee.employeeKey)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-700 text-slate-700 hover:text-white font-bold text-xs transition border border-slate-200"
            >
              <User className="w-3.5 h-3.5" />
              <span>Status</span>
            </button>
          </div>

          {/* Required HR Documents Checklist */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-borderline">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mandatory HR Documents
              </span>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docChecklist.map((doc) => (
                <div
                  key={doc.type}
                  className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-navy-DEFAULT block">{doc.type}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                        doc.status === "Verified"
                          ? "bg-emerald-100 text-emerald-800"
                          : doc.status === "Uploaded"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                  {doc.link && (
                    <a
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 6 Master Sections */}
          {Object.entries(groups).map(([groupTitle, fields]) => {
            if (!fields.length) return null;
            return (
              <div key={groupTitle} className="space-y-3">
                <div className="flex items-center justify-between border-b border-borderline pb-2">
                  <h3 className="font-bold text-sm text-navy-DEFAULT flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    {groupTitle}
                  </h3>
                  <span className="text-xs text-muted">{fields.length} fields</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {fields.map((field) => {
                    const isSensitive = SENSITIVE_FIELDS_HR_MASK.some((sf) =>
                      field.label.toLowerCase().includes(sf.toLowerCase())
                    );
                    const shouldMask = isSensitive && !unmasked;
                    const val = field.value || "—";
                    const isLink = /^https?:\/\//i.test(val);

                    return (
                      <div
                        key={field.label}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60"
                      >
                        <span className="text-[11px] font-medium text-muted block mb-1">
                          {field.label}
                        </span>
                        {shouldMask ? (
                          <div className="flex items-center gap-1 text-slate-400 font-mono">
                            <Lock className="w-3 h-3" />
                            <span>••••••••••</span>
                          </div>
                        ) : isLink ? (
                          <a
                            href={val}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                          >
                            Open Document <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-bold text-navy-DEFAULT break-words leading-relaxed">
                            {val}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
