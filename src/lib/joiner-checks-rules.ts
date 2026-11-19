// New-joiner evaluations from the recruitment SOP: Day 1, Day 6, 2 weeks and 1 month after joining.
// Pure (no I/O) so the schedule and reminders are unit-tested; joiner-checks-store.ts does the sheet I/O.
import type { EmployeeSummary } from "@/types";
import { addCalendarDays, addMonthsClamped, daysBetween, formatLocalIsoDate, parseIsoDate, startOfDay } from "./date-utils.ts";

export const JOINER_CHECKS = [
  { id: "day1", label: "Day 1", days: 0, months: 0 },
  { id: "day6", label: "Day 6", days: 5, months: 0 }, // the joining day is Day 1
  { id: "week2", label: "2 Weeks", days: 14, months: 0 },
  { id: "month1", label: "1 Month", days: 0, months: 1 },
] as const;

export type JoinerCheckId = (typeof JOINER_CHECKS)[number]["id"];

export const JOINER_RESULTS = ["Pass", "Needs Improvement", "Fail"] as const;

/** Joiners stay on the list until a little after their 1-month check, so a late one is still chased. */
export const JOINER_WINDOW_DAYS = 45;

/** What the SOP says to check at every post-joining assessment, each rated 1–5. */
export const JOINER_RATING_AREAS = [
  { key: "learning", label: "Learning" },
  { key: "practicalSkills", label: "Practical skills" },
  { key: "workQuality", label: "Work quality" },
  { key: "performance", label: "Performance" },
] as const;
export type JoinerRatingArea = (typeof JOINER_RATING_AREAS)[number]["key"];
export type JoinerRatings = Record<JoinerRatingArea, number | null>;

export const JOINER_CHECKS_TAB = "Joiner_Checks";
// Rating columns are last so rows written before they existed keep their positions.
export const JOINER_CHECKS_HEADERS = [
  "Check_ID", "Employee_Key", "Employee_ID", "Employee_Name", "Designation", "Department", "Reporting_Manager",
  "DOJ", "Check", "Due_Date", "Completed_On", "Result", "Score", "Test_Used", "Manager_Feedback", "Evaluated_By",
  "Notes", "Recorded_At", "Learning", "Practical_Skills", "Work_Quality", "Performance",
];
export const JOINER_CHECKS_LAST_COLUMN = "V";

export type JoinerCheckRecord = {
  checkId: string;
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  manager: string;
  doj: string;
  check: JoinerCheckId;
  dueDate: string;
  completedOn: string;
  result: string;
  score: string;
  testUsed: string;
  managerFeedback: string;
  evaluatedBy: string;
  notes: string;
  recordedAt: string;
  ratings: JoinerRatings;
};

export type JoinerCheckState = "done" | "due" | "overdue" | "upcoming";

export type ScheduledJoinerCheck = {
  checkId: string;
  check: JoinerCheckId;
  label: string;
  dueDate: string;
  state: JoinerCheckState;
  daysLate: number;
  record: JoinerCheckRecord | null;
};

export type JoinerSchedule = {
  employee: Pick<EmployeeSummary, "employeeKey" | "employeeId" | "fullName" | "designation" | "department" | "manager" | "doj">;
  checks: ScheduledJoinerCheck[];
};

export const joinerCheckId = (employeeKey: string, check: JoinerCheckId) => `${employeeKey}:${check}`;

export function joinerCheckDueDate(doj: string, check: JoinerCheckId): string {
  const start = parseIsoDate(doj);
  const def = JOINER_CHECKS.find((c) => c.id === check);
  if (!start || !def) return "";
  return formatLocalIsoDate(def.months ? addMonthsClamped(start, def.months) : addCalendarDays(start, def.days));
}

/** Active employees who joined in the last JOINER_WINDOW_DAYS (or join soon), with each check's state. */
export function buildJoinerSchedule(employees: EmployeeSummary[], records: JoinerCheckRecord[], now = new Date()): JoinerSchedule[] {
  const today = startOfDay(now);
  const todayIso = formatLocalIsoDate(today);
  const byId = new Map(records.map((r) => [r.checkId, r]));

  return employees
    .filter((e) => e.employmentStatus === "Active")
    .map((e) => ({ e, doj: parseIsoDate(e.doj) }))
    .filter(({ doj }) => doj && daysBetween(doj, today) <= JOINER_WINDOW_DAYS && daysBetween(today, doj) <= 30)
    .sort((a, b) => b.doj!.getTime() - a.doj!.getTime())
    .map(({ e }) => ({
      employee: {
        employeeKey: e.employeeKey,
        employeeId: e.employeeId,
        fullName: e.fullName,
        designation: e.designation,
        department: e.department,
        manager: e.manager,
        doj: e.doj,
      },
      checks: JOINER_CHECKS.map((def) => {
        const checkId = joinerCheckId(e.employeeKey, def.id);
        const dueDate = joinerCheckDueDate(e.doj, def.id);
        const record = byId.get(checkId) || null;
        const daysLate = Math.max(0, daysBetween(parseIsoDate(dueDate)!, today));
        const state: JoinerCheckState = record?.completedOn
          ? "done"
          : dueDate === todayIso
            ? "due"
            : dueDate < todayIso
              ? "overdue"
              : "upcoming";
        return { checkId, check: def.id, label: def.label, dueDate, state, daysLate, record };
      }),
    }));
}

/** Reminder lines for the daily HR digest: a day ahead, on the day, and every day while overdue. */
export function joinerCheckReminders(schedule: JoinerSchedule[], now = new Date()) {
  const tomorrowIso = formatLocalIsoDate(addCalendarDays(startOfDay(now), 1));
  const todayIso = formatLocalIsoDate(startOfDay(now));
  const out: Array<{ id: string; when: "tomorrow" | "today" | "overdue"; text: string }> = [];
  for (const { employee, checks } of schedule) {
    const who = `${employee.fullName} (${employee.designation || employee.department})`;
    for (const c of checks) {
      if (c.state === "done") continue;
      if (c.state === "upcoming" && c.dueDate === tomorrowIso) {
        out.push({ id: `joiner:${c.checkId}:tomorrow`, when: "tomorrow", text: `${c.label} check: ${who}` });
      } else if (c.state === "due") {
        out.push({ id: `joiner:${c.checkId}:today`, when: "today", text: `${c.label} check: ${who}` });
      } else if (c.state === "overdue") {
        const late = `${c.daysLate} ${c.daysLate === 1 ? "day" : "days"} overdue`;
        out.push({ id: `joiner:${c.checkId}:${todayIso}`, when: "overdue", text: `${c.label} check: ${who} - ${late}` });
      }
    }
  }
  return out;
}

// ── sheet rows ───────────────────────────────────────────

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Sheets returns dates as serial numbers; the app works in YYYY-MM-DD. */
function isoDate(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000).toISOString().slice(0, 10);
  }
  return text(v).slice(0, 10);
}

export function parseJoinerCheckRows(rows: unknown[][]): Array<JoinerCheckRecord & { rowNumber: number }> {
  return rows
    .slice(1)
    .map((r, i) => ({
      rowNumber: i + 2,
      checkId: text(r[0]),
      employeeKey: text(r[1]),
      employeeId: text(r[2]),
      employeeName: text(r[3]),
      designation: text(r[4]),
      department: text(r[5]),
      manager: text(r[6]),
      doj: isoDate(r[7]),
      check: text(r[8]) as JoinerCheckId,
      dueDate: isoDate(r[9]),
      completedOn: isoDate(r[10]),
      result: text(r[11]),
      score: text(r[12]),
      testUsed: text(r[13]),
      managerFeedback: text(r[14]),
      evaluatedBy: text(r[15]),
      notes: text(r[16]),
      recordedAt: text(r[17]),
      ratings: {
        learning: rating(r[18]),
        practicalSkills: rating(r[19]),
        workQuality: rating(r[20]),
        performance: rating(r[21]),
      },
    }))
    .filter((r) => r.checkId);
}

/** A 1–5 rating, or null when absent (records saved before ratings existed) or out of range. */
export function rating(v: unknown): number | null {
  const n = Number(text(v));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export const emptyRatings = (): JoinerRatings => ({ learning: null, practicalSkills: null, workQuality: null, performance: null });

/** Average of the given ratings to one decimal, or null when none are set. */
export function ratingAverage(ratings: JoinerRatings | undefined): number | null {
  const values = Object.values(ratings || {}).filter((v): v is number => typeof v === "number");
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

export function joinerCheckToRow(r: JoinerCheckRecord): string[] {
  const rt = r.ratings || emptyRatings();
  const out = (v: number | null) => (v === null ? "" : String(v));
  return [
    r.checkId, r.employeeKey, r.employeeId, r.employeeName, r.designation, r.department, r.manager, r.doj, r.check,
    r.dueDate, r.completedOn, r.result, r.score, r.testUsed, r.managerFeedback, r.evaluatedBy, r.notes, r.recordedAt,
    out(rt.learning), out(rt.practicalSkills), out(rt.workQuality), out(rt.performance),
  ];
}

/** Checks HR input for recording a check. Returns an error message, or null when valid. */
export function validateJoinerCheckInput(input: {
  check: string;
  completedOn: string;
  result: string;
  managerFeedback: string;
  ratings: Partial<Record<JoinerRatingArea, unknown>>;
}, todayIso: string): string | null {
  if (!JOINER_CHECKS.some((c) => c.id === input.check)) return "Unknown check.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.completedOn)) return "Completed date is required.";
  if (input.completedOn > todayIso) return "Completed date cannot be in the future.";
  if (!JOINER_RESULTS.includes(input.result as (typeof JOINER_RESULTS)[number])) return "Choose a result.";
  const unrated = JOINER_RATING_AREAS.filter((a) => rating(input.ratings?.[a.key]) === null).map((a) => a.label);
  if (unrated.length) return `Rate ${unrated.join(", ")} from 1 to 5.`;
  if (!input.managerFeedback.trim()) return "Add the reporting manager's feedback.";
  return null;
}
