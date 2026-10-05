import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SALON_MEETING, queueForMonth, teamMeetingReminders, CLAIM_STALE_MS, firstWednesday, formatMeetingDate, formatDisplayTime, baseMonth, buildQueue, buildMessage, decide, istMoment, istParts, ymdFromIso,
} from "../src/lib/meeting-reminders.ts";

const ist = (y: number, m: number, d: number, hh = 0, mm = 0) => istMoment(y, m - 1, d, hh, mm);

test("first Wednesday of the month", () => {
  const cases: Array<[number, number, number]> = [[2026, 7, 1], [2026, 8, 5], [2026, 9, 2], [2026, 10, 7], [2026, 11, 4], [2026, 12, 2], [2027, 1, 6]];
  for (const [y, m, d] of cases) assert.equal(firstWednesday(y, m - 1).d, d, `${y}-${m}`);
  // always a Wednesday, always within the first 7 days
  for (let m0 = 0; m0 < 36; m0++) {
    const w = firstWednesday(2026 + Math.floor(m0 / 12), m0 % 12);
    assert.equal(new Date(Date.UTC(w.y, w.m0, w.d)).getUTCDay(), 3);
    assert.ok(w.d >= 1 && w.d <= 7);
  }
});

test("date and time wording matches the old messages", () => {
  assert.equal(formatMeetingDate({ y: 2026, m0: 6, d: 1 }), "Wednesday 1st July 2026");
  assert.equal(formatMeetingDate({ y: 2026, m0: 7, d: 5 }), "Wednesday 5th August 2026");
  assert.equal(formatMeetingDate({ y: 2026, m0: 9, d: 7 }), "Wednesday 7th October 2026");
  for (const [d, o] of [[11, "th"], [12, "th"], [13, "th"], [21, "st"], [22, "nd"], [23, "rd"]] as const) {
    assert.ok(formatMeetingDate({ y: 2026, m0: 0, d }).includes(`${d}${o} `), `${d}`);
  }
  assert.equal(formatDisplayTime("10:00"), "10.00 am");
  assert.equal(formatDisplayTime("09:00"), "9.00 am");
  assert.equal(formatDisplayTime("12:30"), "12.30 pm");
  assert.equal(formatDisplayTime("00:15"), "12.15 am");
  assert.throws(() => formatDisplayTime("25:00"));
});

test("IST conversion is exact (no daylight saving, UTC+5:30)", () => {
  assert.equal(new Date(ist(2026, 10, 5, 11, 0)).toISOString(), "2026-10-05T05:30:00.000Z");
  const p = istParts(ist(2026, 10, 7, 9, 0));
  assert.deepEqual([p.y, p.m0, p.d, p.hh, p.mm, p.dow], [2026, 9, 7, 9, 0, 3]);
});

test("base month: the first meeting that is still ahead, never before the start month", () => {
  const m = (now: number) => baseMonth(now, SALON_MEETING);
  assert.deepEqual(m(ist(2026, 10, 5, 12)), { y: 2026, m0: 9 }); // Oct 7 meeting still ahead
  assert.deepEqual(m(ist(2026, 10, 7, 9, 59)), { y: 2026, m0: 9 }); // meeting not started yet
  assert.deepEqual(m(ist(2026, 10, 7, 10, 1)), { y: 2026, m0: 10 }); // started -> next month
  assert.deepEqual(m(ist(2026, 6, 15)), { y: 2026, m0: 6 }); // before the start month -> July
});

test("queue for two meetings: stable IDs and exact due moments", () => {
  const q = buildQueue(ist(2026, 10, 5, 12), SALON_MEETING);
  assert.deepEqual(q.map((r) => r.id), [
    "SALON_MEET_2026-10_R3", "SALON_MEET_2026-10_R2", "SALON_MEET_2026-10_R1", "SALON_MEET_2026-10_R0",
    "SALON_MEET_2026-11_R3", "SALON_MEET_2026-11_R2", "SALON_MEET_2026-11_R1", "SALON_MEET_2026-11_R0",
  ]);
  const oct = Object.fromEntries(q.filter((r) => r.monthKey === "2026-10").map((r) => [r.code, r]));
  assert.equal(oct.R3.dueAt, ist(2026, 10, 4, 11)); // Sunday before
  assert.equal(oct.R2.dueAt, ist(2026, 10, 5, 11));
  assert.equal(oct.R1.dueAt, ist(2026, 10, 6, 11));
  assert.equal(oct.R0.dueAt, ist(2026, 10, 7, 9));
  assert.equal(oct.R0.meetingAt, ist(2026, 10, 7, 10));
  assert.equal(oct.R3.meetingDate, "2026-10-07");
  const nov3 = q.find((r) => r.id === "SALON_MEET_2026-11_R3")!;
  assert.equal(nov3.reminderDate, "2026-11-01");
  // re-running later the same day gives the same IDs (so nothing is duplicated)
  assert.deepEqual(buildQueue(ist(2026, 10, 5, 18), SALON_MEETING).map((r) => r.id), q.map((r) => r.id));
});

test("queue crosses month and year ends correctly", () => {
  const q = buildQueue(ist(2026, 12, 20), SALON_MEETING);
  assert.deepEqual([...new Set(q.map((r) => r.monthKey))], ["2027-01", "2027-02"]);
  const jan = q.find((r) => r.id === "SALON_MEET_2027-01_R3")!; // meeting Wed 6 Jan 2027 -> reminder Sun 3 Jan
  assert.equal(jan.reminderDate, "2027-01-03");
  const mar = buildQueue(ist(2026, 2, 10), { ...SALON_MEETING, startMonth: "2026-01" }); // Mar 4 meeting: R3 falls on Feb 29? (2026 is not leap)
  assert.equal(mar.find((r) => r.id === "SALON_MEET_2026-03_R3")!.reminderDate, "2026-03-01");
});

test("message text keeps the old wording for every reminder type", () => {
  const d = ymdFromIso("2026-11-04");
  const tags = ["919000000001", "919000000002"];
  const r3 = buildMessage("3 Days Before", d, "10:00", tags);
  assert.ok(r3.startsWith("*TO ALL - Salon floor staff,*\n\n*Salon Monthly Staff Meeting 👇*\n\n*On Wednesday 4th November 2026 @ 10.00 am (Please note) ☝️*\n\n@919000000001 & @919000000002\n\n"));
  assert.ok(r3.endsWith("*Please start taking confirmation of staff presence for the meeting and keep the attendance confirmation ready ☝️*"));
  assert.ok(buildMessage("2 Days Before", d, "10:00", tags).includes("Please confirm presence from all salon staff members"));
  assert.ok(buildMessage("1 Day Before", d, "10:00", tags).includes("Tomorrow plzz take confirm presence"));
  assert.ok(buildMessage("Same Day", d, "10:00", tags).includes("Today please make sure all salon staff members are present on time"));
  assert.ok(buildMessage("Same Day", d, "10:00", []).startsWith("*TO ALL - Salon floor staff,*"), "still a valid message when nobody is tagged");
});

test("decide: wait, send, missed, retry and final states", () => {
  const due = ist(2026, 10, 6, 11), meet = ist(2026, 10, 7, 10);
  const row = (status: string, attempts = 0) => ({ status, dueAt: due, meetingAt: meet, attempts });
  const D = (r: ReturnType<typeof row>, now: number) => decide(r, now, SALON_MEETING);
  assert.equal(D(row("Pending"), due - 60_000).action, "wait");
  assert.equal(D(row("Pending"), due).action, "send");
  assert.equal(D(row("Pending"), due + 4 * 60_000).action, "send", "the usual 4-minute lag is fine");
  assert.equal(D(row("Pending"), due + 180 * 60_000).action, "send", "exactly 180 minutes is still allowed");
  assert.equal(D(row("Pending"), due + 181 * 60_000).action, "missed");
  assert.equal(D(row("Pending"), meet + 1).action, "missed");
  // a failed reminder is retried while still inside the window (the old script lost these)
  assert.equal(D(row("Failed", 1), due + 30 * 60_000).action, "send");
  assert.equal(D(row("Failed", 6), due + 30 * 60_000).action, "missed", "gives up after 6 attempts");
  assert.equal(D(row("Failed", 1), due + 200 * 60_000).action, "missed", "too late to retry");
  for (const s of ["Sent", "Missed"]) assert.equal(D(row(s), due + 60_000).action, "skip");
});

test("queueForMonth gives any month's meeting and its four reminders (used by the calendar)", () => {
  const q = queueForMonth(2027, 2, SALON_MEETING); // March 2027
  assert.equal(q.length, 4);
  assert.ok(q.every((r) => r.meetingDate === "2027-03-03"), "first Wednesday of March 2027 is the 3rd");
  assert.deepEqual(q.map((r) => r.reminderDate), ["2027-02-28", "2027-03-01", "2027-03-02", "2027-03-03"]);
  assert.deepEqual(q.map((r) => r.id), ["SALON_MEET_2027-03_R3", "SALON_MEET_2027-03_R2", "SALON_MEET_2027-03_R1", "SALON_MEET_2027-03_R0"]);
});

test("HR digest: the team meeting is Tomorrow the day before and Today on the day", () => {
  const eve = teamMeetingReminders(ist(2026, 10, 6, 9), SALON_MEETING); // Tue 6 Oct 09:00, meeting is Wed 7 Oct
  assert.deepEqual(eve.map((r) => r.when), ["tomorrow"]);
  assert.equal(eve[0].text, "Team meeting: Salon Monthly Staff Meeting at 10.00 am (Wednesday 7th October 2026)");
  const day = teamMeetingReminders(ist(2026, 10, 7, 9), SALON_MEETING);
  assert.deepEqual(day.map((r) => r.when), ["today"]);
  assert.equal(teamMeetingReminders(ist(2026, 10, 7, 10, 30), SALON_MEETING).length, 0, "not after it has started");
  assert.equal(teamMeetingReminders(ist(2026, 10, 5, 9), SALON_MEETING).length, 0, "two days before: nothing");
  assert.equal(teamMeetingReminders(ist(2026, 10, 8, 9), SALON_MEETING).length, 0, "day after: nothing");
  // the next month's meeting is found across a month boundary: Tue 3 Nov -> Wed 4 Nov
  assert.deepEqual(teamMeetingReminders(ist(2026, 11, 3, 9), SALON_MEETING).map((r) => r.when), ["tomorrow"]);
  // month boundary: first Wednesday of Dec 2026 is the 2nd; the 1st is the day before
  assert.deepEqual(teamMeetingReminders(ist(2026, 12, 1, 9), SALON_MEETING).map((r) => r.when), ["tomorrow"]);
});

test("a reminder being sent by another run is not sent twice; a dead claim is retried", () => {
  const due = ist(2026, 10, 6, 11), meet = ist(2026, 10, 7, 10);
  const claimed = (ago: number) => ({ status: "Sending", dueAt: due, meetingAt: meet, attempts: 0, sentAt: new Date(due + 60_000 - ago).toISOString() });
  const now = due + 60_000;
  assert.equal(decide(claimed(30_000), now, SALON_MEETING).action, "skip", "claimed 30 s ago: leave it");
  assert.equal(decide(claimed(CLAIM_STALE_MS + 1000), now, SALON_MEETING).action, "send", "claimed long ago and never finished: retry");
  assert.equal(decide({ status: "Sending", dueAt: due, meetingAt: meet, attempts: 0 }, now, SALON_MEETING).action, "skip", "no claim time: do not risk a double send");
});
