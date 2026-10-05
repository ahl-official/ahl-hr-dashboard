// Recurring meeting reminders: the rules of the old "AHL Salon Monthly Meeting Reminder" Apps Script,
// rebuilt as pure functions (no I/O) so they can be unit-tested. All times are India time (IST, UTC+5:30, no DST).
//
// Rules ported unchanged: first Wednesday of the month at 10:00; reminders 3, 2 and 1 day before at 11:00 and on
// the day at 09:00; a reminder that is more than 180 minutes late, or due after the meeting started, is "Missed";
// every reminder has a stable ID and is sent once. New: a Failed reminder is retried until it would be too late.

const IST_OFFSET_MIN = 330;

export type ReminderDef = { code: string; type: string; daysBefore: number; time: string };
export type ReminderSettings = {
  /** Used in reminder IDs, e.g. SALON_MEET_2026-07_R3 */
  key: string;
  meetingTime: string; // "10:00", 24-hour IST
  startMonth: string; // "2026-07": nothing is queued before this month
  monthsAhead: number;
  maxDelayMinutes: number;
  maxAttempts: number;
  reminders: ReminderDef[];
};

export const SALON_MEETING: ReminderSettings = {
  key: "SALON_MEET",
  meetingTime: "10:00",
  startMonth: "2026-07",
  monthsAhead: 2,
  maxDelayMinutes: 180,
  maxAttempts: 6,
  reminders: [
    { code: "R3", type: "3 Days Before", daysBefore: 3, time: "11:00" },
    { code: "R2", type: "2 Days Before", daysBefore: 2, time: "11:00" },
    { code: "R1", type: "1 Day Before", daysBefore: 1, time: "11:00" },
    { code: "R0", type: "Same Day", daysBefore: 0, time: "09:00" },
  ],
};

export type Ymd = { y: number; m0: number; d: number }; // m0 = month index 0..11

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Epoch ms of an IST wall-clock moment. */
export function istMoment(y: number, m0: number, d: number, hh = 0, mm = 0): number {
  return Date.UTC(y, m0, d, hh, mm) - IST_OFFSET_MIN * 60_000;
}

export function parseTime(text: string): { hh: number; mm: number } {
  const m = String(text ?? "").trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`Invalid time: ${text}`);
  return { hh: +m[1], mm: +m[2] };
}

/** IST calendar parts of an epoch moment. */
export function istParts(ms: number): Ymd & { hh: number; mm: number; dow: number } {
  const t = new Date(ms + IST_OFFSET_MIN * 60_000);
  return { y: t.getUTCFullYear(), m0: t.getUTCMonth(), d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes(), dow: t.getUTCDay() };
}

export function firstWednesday(y: number, m0: number): Ymd {
  const firstDow = new Date(Date.UTC(y, m0, 1)).getUTCDay();
  return { y, m0, d: 1 + ((3 - firstDow + 7) % 7) };
}

export function addMonths(y: number, m0: number, n: number) {
  const t = new Date(Date.UTC(y, m0 + n, 1));
  return { y: t.getUTCFullYear(), m0: t.getUTCMonth() };
}

function addDays(date: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(date.y, date.m0, date.d + days));
  return { y: t.getUTCFullYear(), m0: t.getUTCMonth(), d: t.getUTCDate() };
}

export const toIso = (d: Ymd) => `${d.y}-${pad(d.m0 + 1)}-${pad(d.d)}`;

function ordinal(n: number) {
  if (n > 10 && n < 14) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}

/** "Wednesday 1st July 2026" */
export function formatMeetingDate(d: Ymd): string {
  const dow = new Date(Date.UTC(d.y, d.m0, d.d)).getUTCDay();
  return `${DAYS[dow]} ${d.d}${ordinal(d.d)} ${MONTHS[d.m0]} ${d.y}`;
}

/** "10:00" -> "10.00 am" */
export function formatDisplayTime(text: string): string {
  const { hh, mm } = parseTime(text);
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h}.${pad(mm)} ${hh >= 12 ? "pm" : "am"}`;
}

/** First month whose meeting is still ahead (never before the configured start month). */
export function baseMonth(now: number, s: ReminderSettings): { y: number; m0: number } {
  const p = istParts(now);
  const [sy, sm] = s.startMonth.split("-").map(Number);
  let base = { y: p.y, m0: p.m0 };
  if (base.y * 12 + base.m0 < sy * 12 + (sm - 1)) base = { y: sy, m0: sm - 1 };
  const { hh, mm } = parseTime(s.meetingTime);
  const w = firstWednesday(base.y, base.m0);
  if (base.y === p.y && base.m0 === p.m0 && now > istMoment(w.y, w.m0, w.d, hh, mm)) base = addMonths(base.y, base.m0, 1);
  return base;
}

export type QueueItem = {
  id: string; // SALON_MEET_2026-07_R3
  monthKey: string; // 2026-07
  monthLabel: string; // July 2026
  meetingDate: string; // 2026-07-01
  meetingTime: string;
  meetingAt: number;
  code: string;
  type: string;
  reminderDate: string;
  reminderTime: string;
  dueAt: number;
};

/** The reminders that should exist for the next few meetings. IDs are stable, so re-running adds nothing new. */
export function buildQueue(now: number, s: ReminderSettings): QueueItem[] {
  const base = baseMonth(now, s);
  const { hh, mm } = parseTime(s.meetingTime);
  const out: QueueItem[] = [];
  for (let i = 0; i < s.monthsAhead; i++) {
    const { y, m0 } = addMonths(base.y, base.m0, i);
    const meeting = firstWednesday(y, m0);
    const monthKey = `${y}-${pad(m0 + 1)}`;
    for (const def of s.reminders) {
      const when = addDays(meeting, -def.daysBefore);
      const t = parseTime(def.time);
      out.push({
        id: `${s.key}_${monthKey}_${def.code}`,
        monthKey,
        monthLabel: `${MONTHS[m0]} ${y}`,
        meetingDate: toIso(meeting),
        meetingTime: s.meetingTime,
        meetingAt: istMoment(meeting.y, meeting.m0, meeting.d, hh, mm),
        code: def.code,
        type: def.type,
        reminderDate: toIso(when),
        reminderTime: def.time,
        dueAt: istMoment(when.y, when.m0, when.d, t.hh, t.mm),
      });
    }
  }
  return out;
}

/** The WhatsApp text, identical to the old script. mentionNumbers are digits only, e.g. 919000000001. */
export function buildMessage(type: string, meetingDate: Ymd, meetingTime: string, mentionNumbers: string[]): string {
  const action =
    type === "3 Days Before"
      ? "*Please start taking confirmation of staff presence for the meeting and keep the attendance confirmation ready ☝️*"
      : type === "2 Days Before"
        ? "*Please confirm presence from all salon staff members and make sure everyone is informed about the meeting ☝️*"
        : type === "1 Day Before"
          ? "*Tomorrow plzz take confirm presence for meeting & get it sign from all salon staff members ☝️*"
          : "*Today please make sure all salon staff members are present on time. Attendance confirmation/signature should be ready before meeting ☝️*";
  const tags = mentionNumbers.map((n) => "@" + n).join(" & ");
  return `*TO ALL - Salon floor staff,*\n\n*Salon Monthly Staff Meeting 👇*\n\n*On ${formatMeetingDate(meetingDate)} @ ${formatDisplayTime(meetingTime)} (Please note) ☝️*\n\n${tags}\n\n${action}`;
}

export function ymdFromIso(iso: string): Ymd {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m0: m - 1, d };
}

export type Decision = { action: "wait" | "send" | "missed" | "skip"; reason?: string };

/**
 * What to do with one queue row right now.
 * Pending and Failed rows are eligible (Failed ones are retried); Sent, Missed and gave-up rows are final.
 */
export function decide(
  row: { status: string; dueAt: number; meetingAt: number; attempts: number },
  now: number,
  s: Pick<ReminderSettings, "maxDelayMinutes" | "maxAttempts">,
): Decision {
  if (row.status !== "Pending" && row.status !== "Failed") return { action: "skip" };
  if (now < row.dueAt) return { action: "wait" };
  if (now > row.meetingAt) return { action: "missed", reason: "Skipped because meeting time already passed." };
  const late = Math.round((now - row.dueAt) / 60_000);
  if (late > s.maxDelayMinutes) return { action: "missed", reason: `Skipped because reminder was too late. Delay minutes: ${late}` };
  if (row.attempts >= s.maxAttempts) return { action: "missed", reason: `Gave up after ${row.attempts} failed attempts.` };
  return { action: "send" };
}
