/** Small, dependency-free request validation shared by the API routes and the store. */

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

/** Strict YYYY-MM-DD: rejects rolled-over dates such as 2026-02-30. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Optional date: empty is fine, anything else must be a real ISO date. */
export function assertOptionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return;
  if (!isIsoDate(value)) throw new ValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
}

export function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function isEmail(value: unknown): boolean {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Shared error -> HTTP response mapper for route catch blocks. */
export function errorStatus(error: unknown): number {
  return error instanceof ValidationError ? error.status : 500;
}

/* ---------- Onboarding wizard (pure, shared + unit-tested) ---------- */

const digits = (v: string) => v.replace(/\D/g, "");
/** Indian mobile: 10 digits starting 6-9, optionally prefixed with +91 / 91 / 0. */
export function isPhone(v: string): boolean {
  const d = digits(v);
  const core = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(core);
}
export const isAadhaar = (v: string) => /^\d{12}$/.test(v.replace(/\s/g, ""));
export const isPan = (v: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase());
export const isIfsc = (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase());
export const isAccountNo = (v: string) => /^\d{9,18}$/.test(v.replace(/\s/g, ""));

export type OnboardingData = Record<string, string>;

/** Returns the first problem on the given step, or null when the step is valid. */
export function validateOnboardingStep(step: number, f: OnboardingData): string | null {
  const t = (k: string) => (f[k] ?? "").trim();
  if (step === 1) {
    for (const [k, label] of [["fullName", "Full name"], ["company", "Company"], ["designation", "Designation"], ["department", "Department"], ["manager", "Reporting manager"], ["doj", "Date of joining"]] as const) {
      if (!t(k)) return `${label} is required.`;
    }
    if (!isIsoDate(t("doj"))) return "Date of joining must be a valid date.";
    if (t("companyEmail") && !isEmail(t("companyEmail"))) return "Company email is not a valid email address.";
  }
  if (step === 2) {
    if (!t("dob")) return "Date of birth is required (it drives birthday reminders).";
    if (!isIsoDate(t("dob"))) return "Date of birth must be a valid date.";
    if (t("doj") && t("dob") >= t("doj")) return "Date of birth must be before the date of joining.";
    if (t("doj") && isIsoDate(t("doj"))) {
      const [dy, dm, dd] = t("dob").split("-").map(Number);
      const [jy, jm, jd] = t("doj").split("-").map(Number);
      const age = jy - dy - (jm < dm || (jm === dm && jd < dd) ? 1 : 0);
      if (age < 15) return "Employee would be under 15 at the date of joining; check the date of birth.";
    }
    if (!t("mobile")) return "Mobile number is required.";
    if (!isPhone(t("mobile"))) return "Mobile number must be a valid 10-digit Indian number.";
    if (!t("personalEmail")) return "Personal email is required.";
    if (!isEmail(t("personalEmail"))) return "Personal email is not a valid email address.";
    if (t("emergencyNumber") && !isPhone(t("emergencyNumber"))) return "Emergency contact number must be a valid 10-digit number.";
    if (t("aadhar") && !isAadhaar(t("aadhar"))) return "Aadhaar number must be 12 digits.";
    if (t("pan") && !isPan(t("pan"))) return "PAN must look like ABCDE1234F.";
  }
  if (step === 3) {
    if (t("ifsc") && !isIfsc(t("ifsc"))) return "IFSC must look like HDFC0001234.";
    if (t("accountNumber") && !isAccountNo(t("accountNumber"))) return "Account number must be 9-18 digits.";
    if (t("lastSalary") && !(Number(t("lastSalary").replace(/[,\s₹]/g, "")) >= 0)) return "Last drawn salary must be a number (leave it blank if this is your first job).";
    if (t("incrementYear") && !/^(19|20)\d{2}$/.test(t("incrementYear"))) return "Last increment year must be a 4-digit year.";
    if (t("incrementPercent") && !(Number(t("incrementPercent")) >= 0)) return "Increment percentage must be a number.";
  }
  if (step === 5) {
    if (t("declaration") !== "yes") return "Please tick the box to confirm the declaration.";
    if (!t("signature")) return "Please type your full name.";
    if (!t("signDate") || !isIsoDate(t("signDate"))) return "Signature date is required.";
    if (f.politicalBackground === "Yes" && !t("politicalDetails")) return "Please give political affiliation details when you select Yes.";
  }
  return null;
}
