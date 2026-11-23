import "server-only";

const HAZRI_URL = process.env.HAZRI_BOX_URL || "https://103.204.169.245.sslip.io/api";
const ADMIN_PHONE = process.env.HAZRI_BOX_ADMIN_PHONE || "9372897938";

export interface HazriEmployee {
  id: number;
  name: string;
  phone: number | string;
  role: string;
  department?: string;
  branch?: string;
  designation?: string;
  created_at?: string;
  monthly_salary?: number;
  joining_date?: string;
  late_monthly_allowance?: number;
  shift_start?: string;
  shift_end?: string;
  working_days?: string;
}

export interface HazriLateDay {
  is_late: boolean;
  late_minutes: number;
  late_day_number: number;
  half_day_deduction?: boolean;
  forgiven?: boolean;
  penalty_reason?: string | null;
  late_policy_type?: string;
}

export interface HazriLateSummary {
  year: number;
  month: number;
  late_policy_type?: string;
  late_grace_minutes?: number;
  late_monthly_allowance?: number;
  late_days_count: number;
  forgiven_late_days?: number;
  half_day_deductions?: number;
  days: Record<string, HazriLateDay>;
}

export interface HazriPunch {
  id: number;
  emp_id: number;
  emp_name?: string;
  punch_type: "in" | "out";
  timestamp: string;
  lat?: number;
  lng?: number;
  status?: string;
}

export interface HazriHoliday {
  id: number;
  name: string;
  date: string;
  type?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Log into Hazri Box via admin phone and cache the JWT token.
 */
export async function getHazriToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  // Clean phone to last 10 digits
  const cleanPhone = String(ADMIN_PHONE).replace(/\D/g, "").slice(-10);

  const res = await fetch(`${HAZRI_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: cleanPhone }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Hazri Box login failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (!data?.token) {
    throw new Error("No token returned by Hazri Box login.");
  }

  // Tokens are valid for at least several hours; cache for 2 hours
  cachedToken = {
    value: data.token,
    expiresAt: now + 2 * 60 * 60 * 1000,
  };

  return cachedToken.value;
}

/**
 * Make an authenticated request to Hazri Box API.
 */
async function hazriFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getHazriToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(`${HAZRI_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hazri API request failed for ${path} (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch all registered employees from Hazri Box.
 */
export async function getHazriEmployees(): Promise<HazriEmployee[]> {
  return hazriFetch<HazriEmployee[]>("/employees/");
}

/**
 * Fetch late summary for a specific employee and month.
 */
export async function getHazriLateSummary(
  employeeId: number | string,
  year: number,
  month: number
): Promise<HazriLateSummary> {
  return hazriFetch<HazriLateSummary>(
    `/attendance/employee/${employeeId}/late-summary?year=${year}&month=${month}`
  );
}

/**
 * Fetch detailed punch logs for an employee for a specific month.
 */
export async function getHazriMonthAttendance(
  employeeId: number | string,
  year: number,
  month: number
): Promise<HazriPunch[]> {
  return hazriFetch<HazriPunch[]>(
    `/attendance/employee/${employeeId}/month?year=${year}&month=${month}`
  );
}

/**
 * Fetch list of official holidays from Hazri Box.
 */
export async function getHazriHolidays(month?: string): Promise<HazriHoliday[]> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return hazriFetch<HazriHoliday[]>(`/holidays/${query}`);
}

/**
 * Fetch today's real-time attendance overview.
 */
export async function getHazriTodayStatus(): Promise<any> {
  return hazriFetch<any>("/attendance/today");
}
