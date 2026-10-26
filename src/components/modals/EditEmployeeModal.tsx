"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  UserCheck,
  Building,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  Shield,
  Edit3,
} from "lucide-react";
import { EmployeeSummary } from "@/types";
import { COMPANIES, CANONICAL_DEPARTMENTS } from "@/lib/constants";

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeSummary | null;
  departments?: string[];
  companies?: string[];
  onSave: (payload: Partial<EmployeeSummary> & { employeeKey: string }) => Promise<boolean>;
}

export function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  departments = [],
  companies = [],
  onSave,
}: EditEmployeeModalProps) {
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [manager, setManager] = useState("");
  const [doj, setDoj] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [lastIncrementYear, setLastIncrementYear] = useState("");

  const [activeTab, setActiveTab] = useState<"role" | "personal" | "statutory">("role");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Merge available companies and departments
  const availableCompanies = Array.from(new Set([...COMPANIES, ...companies])).filter(Boolean);
  const availableDepartments = Array.from(
    new Set([...CANONICAL_DEPARTMENTS, ...departments])
  ).filter(Boolean);

  useEffect(() => {
    if (isOpen && employee) {
      setFullName(employee.fullName || "");
      setEmployeeId(employee.employeeId || "");
      setCompany(employee.company || availableCompanies[0] || "");
      setDepartment(employee.department || availableDepartments[0] || "");
      setDesignation(employee.designation || "");
      setManager(employee.manager || "");
      setDoj(employee.doj ? employee.doj.slice(0, 10) : "");
      setDob(employee.dob ? employee.dob.slice(0, 10) : "");
      setGender(employee.gender || "Male");
      setMobile(employee.mobile || "");
      setCompanyEmail(employee.companyEmail || "");
      setPersonalEmail(employee.personalEmail || "");
      setLastIncrementYear(employee.lastIncrementYear || "");
      setActiveTab("role");
      setErrorMessage("");
      setIsSubmitting(false);
    }
  }, [isOpen, employee]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Full name is required.");
      setActiveTab("personal");
      return;
    }
    if (!company.trim()) {
      setErrorMessage("Company is required.");
      setActiveTab("role");
      return;
    }
    if (!department.trim()) {
      setErrorMessage("Department is required.");
      setActiveTab("role");
      return;
    }

    if (dob && doj && dob >= doj) {
      setErrorMessage("Date of birth must be before date of joining.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<EmployeeSummary> & { employeeKey: string } = {
        employeeKey: employee.employeeKey,
        fullName: fullName.trim(),
        employeeId: employeeId.trim(),
        company: company.trim(),
        department: department.trim(),
        designation: designation.trim(),
        manager: manager.trim(),
        doj: doj || "",
        dob: dob || "",
        gender: gender || "",
        mobile: mobile.trim(),
        companyEmail: companyEmail.trim(),
        personalEmail: personalEmail.trim(),
        lastIncrementYear: lastIncrementYear.trim(),
      };

      const success = await onSave(payload);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save employee changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition";
  const labelClass = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-900/60 backdrop-blur-xs transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-navy-800 to-navy-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  Edit Employee Record
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
                  {employee.employeeId || employee.employeeKey}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Update master profile details for {employee.fullName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 gap-4 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("role")}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "role"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Role & Organization</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "personal"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal & Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statutory")}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "statutory"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Compensation & Dates</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: Role & Organization */}
          {activeTab === "role" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Company *</label>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputClass}
                    required
                  >
                    {availableCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Department *</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={inputClass}
                    required
                  >
                    {availableDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Current Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Hair Stylist"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Reporting Manager</label>
                  <input
                    type="text"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder="e.g. Salon Director"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. AHL-1045"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    System identifier in Master Sheet
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Company E-mail</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="name@americanhairline.com"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Personal & Contact */}
          {activeTab === "personal" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Full Legal Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name as per official documents"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Mobile Phone Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Personal E-mail ID</label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="personal@gmail.com"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Compensation & Dates */}
          {activeTab === "statutory" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date of Joining (DOJ)</label>
                  <input
                    type="date"
                    value={doj}
                    onChange={(e) => setDoj(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Date of Birth (DOB)</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Last Increment Year</label>
                  <input
                    type="text"
                    value={lastIncrementYear}
                    onChange={(e) => setLastIncrementYear(e.target.value)}
                    placeholder="e.g. 2024 or 2025"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Current Status</label>
                  <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        employee.employmentStatus === "Left"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {employee.employmentStatus}
                    </span>
                    <span className="text-xs text-muted ml-2">
                      (Change via Status Action)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Saves directly to Master Sheet</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/25 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
