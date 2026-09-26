"use client";

import React, { useState } from "react";
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
import { EmployeeSummary } from "@/types";

interface AddEmployeeWizardProps {
  onEmployeeCreated: (newEmp: EmployeeSummary) => void;
  onCancel: () => void;
}

export function AddEmployeeWizard({ onEmployeeCreated, onCancel }: AddEmployeeWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmployee, setSubmittedEmployee] = useState<EmployeeSummary | null>(null);

  // Form State matching all Master Sheet columns
  const [formData, setFormData] = useState({
    // Step 1: Employment
    fullName: "",
    employeeId: "",
    company: COMPANIES[0],
    designation: "",
    department: CANONICAL_DEPARTMENTS[0],
    manager: "",
    doj: new Date().toISOString().slice(0, 10),
    experience: "",
    companyEmail: "",

    // Step 2: Personal & Contact
    dob: "",
    gender: "Male",
    bloodGroup: "O+",
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
    currentSalary: "",
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
    signDate: new Date().toISOString().slice(0, 10),
  });

  const updateField = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  // Validation per step
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.fullName.trim() || !formData.employeeId.trim() || !formData.company || !formData.designation.trim() || !formData.department || !formData.manager.trim() || !formData.doj) {
        alert("Please complete all required fields in Step 1 (Full Name, Employee ID, Company, Designation, Department, Manager, Date of Joining).");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.mobile.trim() || !formData.personalEmail.trim()) {
        alert("Please provide both Mobile Number and Personal Email.");
        return false;
      }
    }
    if (step === 5) {
      if (!formData.signature.trim() || !formData.signDate) {
        alert("Digital Signature and Signature Date are required.");
        return false;
      }
      if (formData.politicalBackground === "Yes" && !formData.politicalDetails.trim()) {
        alert("Please specify political affiliation details when selected Yes.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(5)) return;

    setIsSubmitting(true);
    try {
      // Build 47 masterFields array
      const masterFields = [
        { label: "Timestamp", value: new Date().toLocaleString("en-IN") },
        { label: "Full Name", value: formData.fullName },
        { label: "Employee ID", value: formData.employeeId },
        { label: "Company", value: formData.company },
        { label: "Current Designation", value: formData.designation },
        { label: "Department", value: formData.department },
        { label: "Reporting Manager", value: formData.manager },
        { label: "Date of Joining (DOJ)", value: formData.doj },
        { label: "Total Years of Experience", value: formData.experience },
        { label: "Company E-mail ID", value: formData.companyEmail },
        { label: "Date of Birth", value: formData.dob },
        { label: "Gender", value: formData.gender },
        { label: "Blood Group", value: formData.bloodGroup },
        { label: "Aadhar Card Number", value: formData.aadhar },
        { label: "PAN Number", value: formData.pan },
        { label: "Permanent Address", value: formData.permAddress },
        { label: "Current Address", value: formData.currAddress },
        { label: "Mobile Number", value: formData.mobile },
        { label: "Personal E-mail ID", value: formData.personalEmail },
        { label: "Father’s Name", value: formData.fatherName },
        { label: "Mother’s Name", value: formData.motherName },
        { label: "Emergency Contact Name", value: formData.emergencyName },
        { label: "Relationship", value: formData.emergencyRel },
        { label: "Emergency Contact Number", value: formData.emergencyNumber },
        { label: "Number of Siblings", value: formData.siblings },
        { label: "Bank Name", value: formData.bankName },
        { label: "Branch", value: formData.branch },
        { label: "Account Number", value: formData.accountNumber },
        { label: "IFSC Code", value: formData.ifsc },
        { label: "Current Salary", value: formData.currentSalary },
        { label: "Last Increment Year", value: formData.incrementYear },
        { label: "Increment Percentage", value: formData.incrementPercent },
        { label: "Short-term Goals", value: formData.shortTerm },
        { label: "Core Strengths", value: formData.strengths },
        { label: "Resource Requirements", value: formData.resources },
        { label: "Alignment with Company Vision", value: formData.alignment },
        { label: "Primary Hobbies", value: formData.hobbies },
        { label: "Company Assets", value: formData.assets },
        { label: "Dietary Preference", value: formData.dietaryPreference },
        { label: "Political Background", value: formData.politicalBackground },
        { label: "Political Details", value: formData.politicalDetails },
        { label: "Vehicle Ownership", value: formData.vehicleOwnership },
        { label: "Housing Status", value: formData.housingStatus },
        { label: "Digital Signature", value: formData.signature },
        { label: "Date", value: formData.signDate },
        { label: "PDF Link", value: "#" },
      ];

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `EMP-IDEM-${Date.now()}`,
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          employeeId: formData.employeeId,
          company: formData.company,
          designation: formData.designation,
          department: formData.department,
          manager: formData.manager,
          doj: formData.doj,
          dob: formData.dob,
          gender: formData.gender,
          mobile: formData.mobile,
          companyEmail: formData.companyEmail,
          personalEmail: formData.personalEmail,
          lastIncrementYear: formData.incrementYear,
          masterFields,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Submission failed");

      setSubmittedEmployee(data.data);
      onEmployeeCreated(data.data);
    } catch (err: any) {
      alert("Error saving employee: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client-side PDF print / snapshot helper
  const handlePrintPdf = () => {
    window.print();
  };

  if (submittedEmployee) {
    return (
      <div className="bg-surface rounded-card p-6 sm:p-10 border border-borderline shadow-card text-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-black text-navy-DEFAULT mb-1">
          Employee Onboarded Successfully
        </h2>
        <p className="text-sm text-muted mb-6">
          Record appended to Master Database with stable employee key.
        </p>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 mb-6 font-medium">
          <div className="flex justify-between">
            <span className="text-slate-500">Employee Key:</span>
            <span className="font-mono font-bold text-indigo-700">{submittedEmployee.employeeKey}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Full Name:</span>
            <span className="font-bold text-navy-DEFAULT">{submittedEmployee.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Employee ID:</span>
            <span className="font-bold text-navy-DEFAULT">{submittedEmployee.employeeId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Department:</span>
            <span className="font-bold text-navy-DEFAULT">{submittedEmployee.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Company:</span>
            <span className="font-bold text-navy-DEFAULT">{submittedEmployee.company}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handlePrintPdf}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-borderline font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            <FileDown className="w-4 h-4 text-indigo-600" />
            <span>Print / Save PDF</span>
          </button>
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
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
      {/* Wizard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-borderline">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
            New Joiner Onboarding
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-navy-DEFAULT tracking-tight">
            Employee Master Database & Alignment Form
          </h2>
          <p className="text-xs text-muted mt-0.5">
            5-step official HR onboarding compliance & profile creation wizard.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderline text-slate-600 hover:bg-slate-50 self-start sm:self-center"
        >
          Cancel
        </button>
      </div>

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
                  Employee ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.employeeId}
                  onChange={(e) => updateField("employeeId", e.target.value)}
                  placeholder="e.g. AHL-1025"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company *
                </label>
                <select
                  value={formData.company}
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
                  onChange={(e) => updateField("designation", e.target.value)}
                  placeholder="e.g. Senior Hair Technician"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department * (Canonical 24)
                </label>
                <select
                  value={formData.department}
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
                  Date of Birth
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
                <input
                  type="text"
                  value={formData.bloodGroup}
                  onChange={(e) => updateField("bloodGroup", e.target.value)}
                  placeholder="e.g. O+, B+"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
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
                  Current Salary (Per Month)
                </label>
                <input
                  type="text"
                  value={formData.currentSalary}
                  onChange={(e) => updateField("currentSalary", e.target.value)}
                  placeholder="₹ 60,000 / month"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Last Increment Year
                </label>
                <input
                  type="text"
                  value={formData.incrementYear}
                  onChange={(e) => updateField("incrementYear", e.target.value)}
                  placeholder="e.g. 2025"
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
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Digital Signature (Type Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.signature}
                  onChange={(e) => updateField("signature", e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-serif focus:bg-white focus:border-indigo-500"
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
