// Single source of truth for turning the joiner's form into master-sheet fields.
// Used by the server when a form is submitted (and unit-tested).
import type { MasterField } from "@/types";

export type OnboardingForm = Record<string, string>;

/** The 45 master-sheet columns, in sheet order. "Employee ID" is filled in by the server. */
export function buildMasterFields(f: OnboardingForm, employeeId = ""): MasterField[] {
  const v = (k: string) => (f[k] ?? "").toString().trim();
  return [
    { label: "Timestamp", value: new Date().toLocaleString("en-IN") },
    { label: "Full Name", value: v("fullName") },
    { label: "Employee ID", value: employeeId },
    { label: "Company", value: v("company") },
    { label: "Current Designation", value: v("designation") },
    { label: "Department", value: v("department") },
    { label: "Reporting Manager", value: v("manager") },
    { label: "Date of Joining (DOJ)", value: v("doj") },
    { label: "Total Years of Experience", value: v("experience") },
    { label: "Company E-mail ID", value: v("companyEmail") },
    { label: "Date of Birth", value: v("dob") },
    { label: "Gender", value: v("gender") },
    { label: "Blood Group", value: v("bloodGroup") },
    { label: "Aadhar Card Number", value: v("aadhar") },
    { label: "PAN Number", value: v("pan").toUpperCase() },
    { label: "Permanent Address", value: v("permAddress") },
    { label: "Current Address", value: v("currAddress") },
    { label: "Mobile Number", value: v("mobile") },
    { label: "Personal E-mail ID", value: v("personalEmail") },
    { label: "Father’s Name", value: v("fatherName") },
    { label: "Mother’s Name", value: v("motherName") },
    { label: "Emergency Contact Name", value: v("emergencyName") },
    { label: "Relationship", value: v("emergencyRel") },
    { label: "Emergency Contact Number", value: v("emergencyNumber") },
    { label: "Number of Siblings", value: v("siblings") },
    { label: "Bank Name", value: v("bankName") },
    { label: "Branch", value: v("branch") },
    { label: "Account Number", value: v("accountNumber") },
    { label: "IFSC Code", value: v("ifsc").toUpperCase() },
    { label: "Current Salary", value: "" }, // set by HR after joining
    { label: "Last Drawn Salary", value: v("lastSalary") },
    { label: "Last Increment Year", value: v("incrementYear") },
    { label: "Increment Percentage", value: v("incrementPercent") },
    { label: "Short-term Goals", value: v("shortTerm") },
    { label: "Core Strengths", value: v("strengths") },
    { label: "Resource Requirements", value: v("resources") },
    { label: "Alignment with Company Vision", value: v("alignment") },
    { label: "Primary Hobbies", value: v("hobbies") },
    { label: "Company Assets", value: v("assets") },
    { label: "Dietary Preference", value: v("dietaryPreference") },
    { label: "Political Background", value: v("politicalBackground") },
    { label: "Political Details", value: v("politicalBackground") === "Yes" ? v("politicalDetails") : "" },
    { label: "Vehicle Ownership", value: v("vehicleOwnership") },
    { label: "Housing Status", value: v("housingStatus") },
    { label: "Digital Signature", value: v("signature") },
    { label: "Date", value: v("signDate") },
    { label: "PDF Link", value: "" },
  ];
}

/** Flat payload for addEmployeeRecord (the store). */
export function toEmployeePayload(f: OnboardingForm, createdBy: string) {
  const v = (k: string) => (f[k] ?? "").toString().trim();
  return {
    fullName: v("fullName"),
    company: v("company"),
    designation: v("designation"),
    department: v("department"),
    manager: v("manager"),
    doj: v("doj"),
    dob: v("dob"),
    gender: v("gender"),
    mobile: v("mobile"),
    companyEmail: v("companyEmail"),
    personalEmail: v("personalEmail"),
    lastIncrementYear: v("incrementYear"),
    masterFields: buildMasterFields(f),
    createdBy,
  };
}
