// Employee ID format:  <COMPANY>-<DEPT>-<NNNN>   e.g. AHL-AI-0093
//  - COMPANY: short company code
//  - DEPT:    short code of the department the person joins (a label only; it never changes later)
//  - NNNN:    running number PER COMPANY, first come first served, never reused
// Legacy IDs (plain numbers like "40", or messy values) are left untouched and are IGNORED when numbering:
// real data holds values such as 14050298 and 123456, so "highest + 1" would be meaningless. New IDs
// start their own clean sequence per company (0001, 0002, ...); the different format means they can
// never collide with a legacy ID.

export const COMPANY_CODES: Record<string, string> = {
  "American Hairline (AHL)": "AHL",
  "Alchemane (ALC)": "ALC",
  YDigital: "YD",
};

export const DEPARTMENT_CODES: Record<string, string> = {
  "Human Resources (HR)": "HR",
  Accounts: "ACC",
  "Video Editor": "VED",
  "Graphic Designer": "GFX",
  "Digital Marketing": "DM",
  "Artificial Intelligence (AI)": "AI",
  "MIS Executive": "MIS",
  "Content Writer": "CW",
  "Influencer Marketing": "IM",
  Videographer: "VID",
  Purchase: "PUR",
  "Customer Service Executive": "CSE",
  Labour: "LAB",
  Maintenance: "MNT",
  Housekeeping: "HK",
  "Process Coordinator": "PC",
  Inventory: "INV",
  "Floor Manager": "FM",
  "Business Development": "BD",
  "AHL Technician": "TEC",
  CRR: "CRR",
  "ALC Technician": "TEC",
  Consultant: "CON",
  PMU: "PMU",
};

const norm = (s: string) => s.trim().toLowerCase();

/** Fallback for a department/company that has no configured code: initials, max 3 letters. */
function deriveCode(name: string, max = 3): string {
  const words = name.replace(/\(.*?\)/g, " ").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const code = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "")).toUpperCase().slice(0, max);
  return code || "GEN";
}

function lookup(table: Record<string, string>, name: string, max: number): string {
  const hit = Object.entries(table).find(([k]) => norm(k) === norm(name));
  return hit ? hit[1] : deriveCode(name, max);
}

export const companyCode = (company: string) => lookup(COMPANY_CODES, company, 3);
export const departmentCode = (department: string) => lookup(DEPARTMENT_CODES, department, 3);

/** Number part of a NEW-format ID ("AHL-AI-0093" -> 93). Legacy / free-text IDs -> null. */
export function idNumber(id: string): number | null {
  const m = (id ?? "").trim().match(/^[A-Za-z0-9]+-[A-Za-z0-9]+-(\d{1,6})$/);
  return m ? Number(m[1]) : null;
}

/** Next free number for a company: one above the highest NEW-format number of that company. */
export function nextEmployeeNumber(employees: Array<{ company: string; employeeId: string }>, company: string): number {
  const prefix = companyCode(company) + "-";
  let max = 0;
  for (const e of employees) {
    const id = (e.employeeId ?? "").trim().toUpperCase();
    if (!id.startsWith(prefix)) continue; // other company's IDs and legacy IDs never count
    const n = idNumber(id);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

export function formatEmployeeId(company: string, department: string, number: number): string {
  return `${companyCode(company)}-${departmentCode(department)}-${String(number).padStart(4, "0")}`;
}
