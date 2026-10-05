"use client";

import React, { useState, useEffect } from "react";
import {
  UserPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Building,
  User,
  CreditCard,
  Target,
  FileSignature,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { CANONICAL_DEPARTMENTS, COMPANIES, GENDERS, DIETARY_PREFERENCES, VEHICLE_OWNERSHIPS, HOUSING_STATUSES } from "@/lib/constants";
import { getTodayLocalIsoDate } from "@/lib/date-utils";
import { validateOnboardingStep } from "@/lib/validate";
import { SignaturePad } from "./SignaturePad";
import { EmployeeSummary } from "@/types";

const SENSITIVE_FIELDS = ["aadhar", "pan", "accountNumber", "ifsc", "lastSalary", "signature"];

// Fields HR sets on the invitation; the joiner sees them but cannot change them (the server enforces this too).
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const LOCKED_FIELDS = ["company", "department", "designation", "manager", "doj"];

export type JoinerPrefill = { name: string; mobile: string; company: string; department: string; designation: string; manager: string; doj: string };

interface AddEmployeeWizardProps {
  /** What HR filled in on the invitation. */
  prefill: JoinerPrefill;
  /** Where the finished form is posted (the personal link of the joiner). */
  submitUrl: string;
  /** Called after the form was accepted. */
  onSubmitted: () => void;
}

export function AddEmployeeWizard({ prefill, submitUrl, onSubmitted }: AddEmployeeWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [done, setDone] = useState(false);
  const DRAFT_KEY = `ahl-onboarding-draft-v2:${submitUrl}`;
  const isLocked = (field: string) => LOCKED_FIELDS.includes(field);

  // Form State matching all Master Sheet columns
  const [formData, setFormData] = useState({
    // Step 1: Employment
    fullName: "",
    company: COMPANIES[0],
    designation: "",
    department: CANONICAL_DEPARTMENTS[0],
    manager: "",
    doj: getTodayLocalIsoDate(),
    experience: "",
    companyEmail: "",

    // Step 2: Personal & Contact
    dob: "",
    gender: "Male",
    bloodGroup: "",
    aadhar: "",
    pan: "",
    permAddress: "",
    currAddress: "",
    mobile: "",
    personalEmail: "",
    fatherName: "",
    motherName: "",
    emergencyName: "",
    emergencyRel: "",
    emergencyNumber: "",
    siblings: "0",

    // Step 3: Banking & Compensation
    bankName: "",
    branch: "",
    accountNumber: "",
    ifsc: "",
    lastSalary: "",
    incrementYear: "",
    incrementPercent: "",

    // Step 4: Alignment & Goals
    shortTerm: "",
    strengths: "",
    resources: "",
    alignment: "",
    hobbies: "",
    assets: "",

    // Step 5: Declarations
    dietaryPreference: "Veg",
    politicalBackground: "No",
    politicalDetails: "",
    vehicleOwnership: "None",
    housingStatus: "Rented Property",
    signature: "",
    signDate: getTodayLocalIsoDate(),
  });

  const updateField = (field: string, val: string) => {
    setStepError(null);
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  // Validation per step (pure rules live in lib/validate.ts and are unit-tested)
  const validateStep = (step: number): boolean => {
    const problem = validateOnboardingStep(step, { ...(formData as Record<string, string>), signatureImage: signatureImage ? "yes" : "" });
    setStepError(problem);
    return problem === null;
  };

  // Draft autosave. Sensitive fields (ID numbers, bank details, signature) are never stored in the browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const { step, data } = JSON.parse(raw);
        setFormData((prev) => ({ ...prev, ...data }));
        if (step) setCurrentStep(step);
        setDraftRestored(true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      try {
        const data: Record<string, string> = { ...(formData as Record<string, string>) };
        for (const k of SENSITIVE_FIELDS) delete data[k];
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: currentStep, data }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [formData, currentStep, done]);

  // The details HR entered always win over anything restored from a draft
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      fullName: prev.fullName || prefill.name,
      mobile: prev.mobile || prefill.mobile,
      company: prefill.company, department: prefill.department, designation: prefill.designation, manager: prefill.manager, doj: prefill.doj,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill.company, prefill.department, prefill.designation, prefill.manager, prefill.doj]);

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setStepError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(5)) return;
    setIsSubmitting(true);
    setStepError(null);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: formData, signatureImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Submission failed");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDone(true);
      onSubmitted();
    } catch (err: any) {
      setStepError(err?.message || "Could not submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-surface rounded-card p-8 sm:p-12 border border-borderline text-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-semibold text-navy-DEFAULT mb-2">Thank you!</h2>
        <p className="text-sm text-muted">Your details have been submitted. HR will take it from here. You can close this page now.</p>
      </div>
    );
  }

  const stepLabels = [
    { num: 1, title: "Employment", icon: Building },
    { num: 2, title: "Personal & Contact", icon: User },
    { num: 3, title: "Banking & Payroll", icon: CreditCard },
    { num: 4, title: "Alignment & Goals", icon: Target },
    { num: 5, title: "Declarations", icon: FileSignature },
  ];

  return (
    <div className="bg-surface rounded-card p-5 sm:p-8 border border-borderline shadow-card max-w-4xl mx-auto my-6">
      {/* Welcome */}
      <div className="pb-5 mb-6 border-b border-borderline">
        <h2 className="text-xl sm:text-2xl font-semibold text-navy-DEFAULT tracking-tight">Welcome{prefill.name ? `, ${prefill.name.split(" ")[0]}` : ""}</h2>
        <p className="text-sm text-muted mt-1">Please fill in your joining details. It takes about 10 minutes and your progress is saved on this device.</p>
      </div>

      {draftRestored && (
        <p className="mb-4 text-xs text-slate-600 bg-slate-50 border border-borderline rounded-md px-3 py-2 flex items-center justify-between gap-3">
          <span>Continuing your saved draft. ID numbers, bank details and signature are never saved in the browser, so re-enter those.</span>
          <button type="button" onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} window.location.reload(); }} className="font-medium text-indigo-700 hover:underline shrink-0">Start over</button>
        </p>
      )}

      {/* Steps Progress Tracker */}
      <div className="grid grid-cols-5 gap-2 mb-8 select-none">
        {stepLabels.map((s) => {
          const Icon = s.icon;
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <div
              key={s.num}
              onClick={() => {
                if (isDone) setCurrentStep(s.num);
              }}
              className={`p-2 sm:p-3 rounded-xl border text-center transition cursor-pointer ${
                isCurrent
                  ? "bg-indigo-50 border-indigo-500 text-indigo-800"
                  : isDone
                  ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  : "bg-white border-slate-100 text-slate-400 opacity-60 pointer-events-none"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" />
                ) : (
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="text-[11px] font-bold hidden sm:inline">Step {s.num}</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold block truncate">{s.title}</span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* STEP 1: Employment */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-DEFAULT border-b border-borderline pb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              1. Employment & Tenure Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company *
                </label>
                <select
                  value={formData.company}
                  disabled={isLocked("company")}
                  onChange={(e) => updateField("company", e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                >
                  {COMPANIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Current Designation *
                </label>
                <input
                  type="text"
                  required
                  value={formData.designation}
                  disabled={isLocked("designation")}
                  onChange={(e) => updateField("designation", e.target.value)}
                  placeholder="e.g. Senior Hair Technician"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department *
                </label>
                <select
                  value={formData.department}
                  disabled={isLocked("department")}
                  onChange={(e) => updateField("department", e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                >
                  {CANONICAL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reporting Manager *
                </label>
                <input
                  type="text"
                  required
                  value={formData.manager}
                  disabled={isLocked("manager")}
                  onChange={(e) => updateField("manager", e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date of Joining (DOJ) *
                </label>
                <input
                  type="date"
                  required
                  value={formData.doj}
                  disabled={isLocked("doj")}
                  onChange={(e) => updateField("doj", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Total Experience
                </label>
                <input
                  type="text"
                  value={formData.experience}
                  onChange={(e) => updateField("experience", e.target.value)}
                  placeholder="e.g. 4.5 Years"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company Email
                </label>
                <input
                  type="email"
                  value={formData.companyEmail}
                  onChange={(e) => updateField("companyEmail", e.target.value)}
                  placeholder="name@americanhairline.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Personal & Contact */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-DEFAULT border-b border-borderline pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              2. Personal & Statutory Identification
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => updateField("dob", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => updateField("bloodGroup", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Aadhaar Card Number
                </label>
                <input
                  type="text"
                  value={formData.aadhar}
                  onChange={(e) => updateField("aadhar", e.target.value)}
                  placeholder="12 digit Aadhaar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PAN Number (Auto Uppercase)
                </label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase font-mono focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={(e) => updateField("mobile", e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Personal Email ID *
                </label>
                <input
                  type="email"
                  required
                  value={formData.personalEmail}
                  onChange={(e) => updateField("personalEmail", e.target.value)}
                  placeholder="personal@gmail.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Permanent Address
                </label>
                <textarea
                  value={formData.permAddress}
                  onChange={(e) => updateField("permAddress", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Current Address
                </label>
                <textarea
                  value={formData.currAddress}
                  onChange={(e) => updateField("currAddress", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyName}
                  onChange={(e) => updateField("emergencyName", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={formData.emergencyRel}
                  onChange={(e) => updateField("emergencyRel", e.target.value)}
                  placeholder="e.g. Spouse / Mother"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Emergency Contact Number
                </label>
                <input
                  type="text"
                  value={formData.emergencyNumber}
                  onChange={(e) => updateField("emergencyNumber", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Banking & Payroll */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-DEFAULT border-b border-borderline pb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              3. Banking, Payroll & Compensation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => updateField("bankName", e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => updateField("branch", e.target.value)}
                  placeholder="e.g. Andheri West"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => updateField("accountNumber", e.target.value)}
                  placeholder="Account number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={formData.ifsc}
                  onChange={(e) => updateField("ifsc", e.target.value.toUpperCase())}
                  placeholder="HDFC0000249"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase font-mono focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Last Drawn Salary (Per Month)
                </label>
                <input
                  type="text"
                  value={formData.lastSalary}
                  onChange={(e) => updateField("lastSalary", e.target.value)}
                  placeholder="At your previous company. Leave blank if this is your first job"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Alignment & Goals */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-DEFAULT border-b border-borderline pb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              4. Alignment, Strengths & Vision
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Short-term Professional Goals (1-2 Years)
              </label>
              <textarea
                value={formData.shortTerm}
                onChange={(e) => updateField("shortTerm", e.target.value)}
                rows={2}
                placeholder="Key technical, operational or leadership targets..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Core Strengths
              </label>
              <textarea
                value={formData.strengths}
                onChange={(e) => updateField("strengths", e.target.value)}
                rows={2}
                placeholder="Clinical precision, client relationship, workflow speed..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Resource Requirements
              </label>
              <textarea
                value={formData.resources}
                onChange={(e) => updateField("resources", e.target.value)}
                rows={2}
                placeholder="Software tools, specialized equipment, team support..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Hobbies
                </label>
                <input
                  type="text"
                  value={formData.hobbies}
                  onChange={(e) => updateField("hobbies", e.target.value)}
                  placeholder="e.g. Sports, Music, Reading"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Company Assets
                </label>
                <input
                  type="text"
                  value={formData.assets}
                  onChange={(e) => updateField("assets", e.target.value)}
                  placeholder="e.g. Laptop, ID Badge, SIM"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Declarations */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-DEFAULT border-b border-borderline pb-2 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-indigo-600" />
              5. Official Declarations & Verification
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dietary Preference
                </label>
                <select
                  value={formData.dietaryPreference}
                  onChange={(e) => updateField("dietaryPreference", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                >
                  {DIETARY_PREFERENCES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vehicle Ownership
                </label>
                <select
                  value={formData.vehicleOwnership}
                  onChange={(e) => updateField("vehicleOwnership", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                >
                  {VEHICLE_OWNERSHIPS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Housing Status
                </label>
                <select
                  value={formData.housingStatus}
                  onChange={(e) => updateField("housingStatus", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                >
                  {HOUSING_STATUSES.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Political Background (Conditional) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Political Background?
                  </label>
                  <select
                    value={formData.politicalBackground}
                    onChange={(e) => updateField("politicalBackground", e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {formData.politicalBackground === "Yes" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Political Affiliation Details *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.politicalDetails}
                      onChange={(e) => updateField("politicalDetails", e.target.value)}
                      placeholder="Please specify details"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Declaration statement */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
              <strong className="block mb-1 text-indigo-950 font-bold">Declaration Statement:</strong>
              I hereby declare that the information provided above is true and accurate to the best of my knowledge. Any misrepresentation may lead to cancellation of employment under company policies.
            </div>

            {/* Digital Signature & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Signature *
                </label>
                <SignaturePad onChange={(v) => { setStepError(null); setSignatureImage(v); }} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name (under signature) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.signature}
                  onChange={(e) => updateField("signature", e.target.value)}
                  placeholder="Type your full name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date of Signature *
                </label>
                <input
                  type="date"
                  required
                  value={formData.signDate}
                  onChange={(e) => updateField("signDate", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {stepError && (
          <p role="alert" className="mt-6 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            {stepError}
          </p>
        )}

        {/* Wizard Navigation Footer */}
        <div className="flex items-center justify-between pt-6 mt-8 border-t border-borderline">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
            >
              <span>Next: {stepLabels[currentStep].title}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? "Submitting..." : "Submit & Generate Record"}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
