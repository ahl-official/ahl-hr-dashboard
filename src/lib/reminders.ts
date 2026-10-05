// Pure reminder rules: what should HR be told today? No I/O, so it is unit-tested.
import type { EmployeeSummary, MeetingRecord } from "@/types";
import { calculateBirthdays, calculateMilestones, daysBetween, formatLocalIsoDate, parseIsoDate, startOfDay } from "./date-utils.ts";

export type Reminder = {
  id: string; // stable, for future de-duplication
  when: "tomorrow" | "today" | "overdue";
  text: string;
};

const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "..." : s);

export function buildReminders(employees: EmployeeSummary[], meetings: MeetingRecord[]): Reminder[] {
  const today = startOfDay(new Date());
  const todayIso = formatLocalIsoDate(today);
  const active = employees.filter((e) => e.employmentStatus === "Active");
  const activeKeys = new Set(active.map((e) => e.employeeKey));
  const out: Reminder[] = [];

  // Reviews and birthdays: one day ahead
  for (const r of calculateMilestones(active, 1).filter((m) => m.daysUntil === 1)) {
    out.push({ id: `review:${r.employeeKey}:${r.date}`, when: "tomorrow", text: `Review: ${r.employeeName} (${r.department}) - ${r.label}` });
  }
  // Birthdays: heads-up the day before, and again on the day itself
  for (const b of calculateBirthdays(active, 1)) {
    out.push({
      id: `birthday:${b.employeeKey}:${b.date}:${b.daysUntil}`,
      when: b.daysUntil === 0 ? "today" : "tomorrow",
      text: `Birthday: ${b.employeeName} (${b.department}) - turning ${b.age}`,
    });
  }

  // Meetings and follow-ups that are still open
  for (const m of meetings.filter((x) => x.recordStatus === "Open" && activeKeys.has(x.employeeKey))) {
    if ((m.meetingDate || m.scheduledDate) === todayIso) {
      out.push({ id: `meeting:${m.meetingId}`, when: "today", text: `Meeting: ${m.employeeName} - ${m.meetingType}` });
    }
    if (m.nextFollowUpDate === todayIso) {
      out.push({ id: `followup:${m.meetingId}:${todayIso}`, when: "today", text: `Action due: ${m.employeeName} - ${clip(m.actionTaken || m.discussionNotes || "follow-up")}` });
    } else if (m.nextFollowUpDate && m.nextFollowUpDate < todayIso) {
      const due = parseIsoDate(m.nextFollowUpDate);
      const late = due ? daysBetween(due, today) : 0;
      out.push({ id: `overdue:${m.meetingId}:${todayIso}`, when: "overdue", text: `${m.employeeName} - ${late} ${late === 1 ? "day" : "days"} overdue: ${clip(m.actionTaken || m.discussionNotes || "follow-up")}` });
    }
  }
  return out;
}

const HEADINGS: Record<Reminder["when"], string> = { tomorrow: "Tomorrow", today: "Today", overdue: "Overdue" };

/** One WhatsApp message per recipient instead of one per event. Null when nothing is due. */
export function buildDigest(reminders: Reminder[]): string | null {
  if (!reminders.length) return null;
  const date = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  const parts = [`*AHL HR reminders - ${date}*`];
  for (const when of ["tomorrow", "today", "overdue"] as const) {
    const items = reminders.filter((r) => r.when === when);
    if (items.length) parts.push(`\n*${HEADINGS[when]}*\n` + items.map((r) => `- ${r.text}`).join("\n"));
  }
  return parts.join("\n");
}
