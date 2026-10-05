// Maps the reminder tabs of the database sheet to and from the rules engine. Pure (no I/O) and unit-tested.
import { SALON_MEETING, istMoment, parseTime, type QueueItem, type ReminderSettings } from "./meeting-reminders.ts";

export const SETTINGS_TAB = "Reminder_Settings";
export const MENTIONS_TAB = "Reminder_Mentions";
export const QUEUE_TAB = "Reminder_Queue";
export const LOG_TAB = "Reminder_Log";

export const SETTINGS_HEADERS = ["Setting", "Value", "Notes"];
export const MENTIONS_HEADERS = ["Active", "Display_Name", "Phone_Number", "Notes"];
export const QUEUE_HEADERS = ["Reminder_ID", "Month", "Meeting_Date", "Meeting_Time", "Reminder_Type", "Reminder_Date", "Reminder_Time", "Due_At", "Mode", "Status", "Sent_At", "Attempt_Count", "Last_Error"];
export const LOG_HEADERS = ["Timestamp", "Reminder_ID", "Month", "Reminder_Type", "Target", "Mode", "Mentions", "Message", "Status", "Response", "Error"];

/** Defaults written the first time the Settings tab is created. Group id and test number are filled in by HR. */
export const DEFAULT_SETTINGS_ROWS: string[][] = [
  ["MODE", "TEST", "TEST sends only to TEST_NUMBER. PROD sends to the live WhatsApp group."],
  ["LIVE_GROUP_NAME", "", "Name of the WhatsApp group (for reference)"],
  ["LIVE_GROUP_ID", "", "Group id, like 1234567890-1234567890@g.us"],
  ["TEST_NUMBER", "", "Phone number (with country code) that receives TEST messages"],
  ["MEETING_TIME", SALON_MEETING.meetingTime, "24-hour, India time. The meeting is on the 1st Wednesday of every month."],
  ["START_MONTH", SALON_MEETING.startMonth, "Nothing is queued before this month (YYYY-MM)"],
  ["MONTHS_AHEAD", String(SALON_MEETING.monthsAhead), "How many upcoming meetings to keep queued"],
  ["MAX_DELAY_MINUTES", String(SALON_MEETING.maxDelayMinutes), "A reminder later than this is skipped as Missed"],
  ["MAX_ATTEMPTS", String(SALON_MEETING.maxAttempts), "Failed sends are retried this many times"],
  ["REMINDER_3_DAYS_BEFORE_TIME", "11:00", ""],
  ["REMINDER_2_DAYS_BEFORE_TIME", "11:00", ""],
  ["REMINDER_1_DAY_BEFORE_TIME", "11:00", ""],
  ["REMINDER_SAME_DAY_TIME", "09:00", ""],
  ["LAST_TICK_AT", "", "Updated by the system every few minutes; the dashboard shows an alert if it goes stale"],
];

export type MeetingReminderConfig = {
  schedule: ReminderSettings;
  mode: "TEST" | "PROD";
  liveGroupId: string;
  testNumber: string;
  lastTickAt: string;
};

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" && Number(v) > 0 ? Math.floor(Number(v)) : fallback);
const time = (v: string, fallback: string) => { try { parseTime(v); return v; } catch { return fallback; } };

export function parseSettings(rows: unknown[][]): MeetingReminderConfig {
  const map = new Map<string, string>();
  for (const r of rows.slice(1)) if (text(r[0])) map.set(text(r[0]), text(r[1]));
  const g = (k: string) => map.get(k) ?? "";
  const D = SALON_MEETING;
  const timeOf = (k: string, def: string) => time(g(k), def);
  const start = /^\d{4}-\d{2}$/.test(g("START_MONTH")) ? g("START_MONTH") : D.startMonth;
  return {
    schedule: {
      ...D,
      meetingTime: timeOf("MEETING_TIME", D.meetingTime),
      startMonth: start,
      monthsAhead: num(g("MONTHS_AHEAD"), D.monthsAhead),
      maxDelayMinutes: num(g("MAX_DELAY_MINUTES"), D.maxDelayMinutes),
      maxAttempts: num(g("MAX_ATTEMPTS"), D.maxAttempts),
      reminders: D.reminders.map((def) => ({
        ...def,
        time: timeOf({ R3: "REMINDER_3_DAYS_BEFORE_TIME", R2: "REMINDER_2_DAYS_BEFORE_TIME", R1: "REMINDER_1_DAY_BEFORE_TIME", R0: "REMINDER_SAME_DAY_TIME" }[def.code] as string, def.time),
      })),
    },
    mode: g("MODE").toUpperCase() === "PROD" ? "PROD" : "TEST", // anything unclear stays in TEST
    liveGroupId: g("LIVE_GROUP_ID"),
    testNumber: g("TEST_NUMBER").replace(/\D/g, ""),
    lastTickAt: g("LAST_TICK_AT"),
  };
}

/** People tagged in every reminder (Active = Yes). Ids are derived from the phone number. */
export function parseMentions(rows: unknown[][]): { numbers: string[]; ids: string[]; names: string[] } {
  const numbers: string[] = [], names: string[] = [];
  for (const r of rows.slice(1)) {
    const digits = text(r[2]).replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    if (text(r[0]).toLowerCase() === "yes" && phone.length >= 11) { numbers.push(phone); names.push(text(r[1])); }
  }
  return { numbers, ids: numbers.map((n) => `${n}@c.us`), names };
}

export type QueueRow = {
  rowNumber: number;
  id: string;
  monthLabel: string;
  meetingDate: string;
  meetingTime: string;
  type: string;
  reminderDate: string;
  reminderTime: string;
  dueAt: number;
  meetingAt: number;
  mode: string;
  status: string;
  sentAt: string;
  attempts: number;
  lastError: string;
};

export const itemToRow = (i: QueueItem, mode: string): string[] => [
  i.id, i.monthLabel, i.meetingDate, i.meetingTime, i.type, i.reminderDate, i.reminderTime, new Date(i.dueAt).toISOString(), mode, "Pending", "", "0", "",
];

export function parseQueue(rows: unknown[][]): QueueRow[] {
  const out: QueueRow[] = [];
  rows.forEach((r, idx) => {
    if (idx === 0 || !text(r[0])) return;
    const [y, m, d] = text(r[2]).split("-").map(Number);
    let meetingAt = NaN;
    try { const t = parseTime(text(r[3])); meetingAt = istMoment(y, m - 1, d, t.hh, t.mm); } catch {}
    out.push({
      rowNumber: idx + 1, id: text(r[0]), monthLabel: text(r[1]), meetingDate: text(r[2]), meetingTime: text(r[3]), type: text(r[4]),
      reminderDate: text(r[5]), reminderTime: text(r[6]), dueAt: Date.parse(text(r[7])), meetingAt,
      mode: text(r[8]), status: text(r[9]) || "Pending", sentAt: text(r[10]), attempts: Number(text(r[11])) || 0, lastError: text(r[12]),
    });
  });
  return out;
}

/** Where a message goes: the live group in PROD, the test number in TEST. Null when that is not configured. */
export function targetFor(c: MeetingReminderConfig): { chatId: string; label: string } | null {
  if (c.mode === "PROD") return c.liveGroupId ? { chatId: c.liveGroupId, label: "live group" } : null;
  return c.testNumber ? { chatId: `${c.testNumber.length === 10 ? "91" : ""}${c.testNumber}@c.us`, label: "test number" } : null;
}
