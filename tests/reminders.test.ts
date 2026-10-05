import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { buildReminders, buildDigest } from "../src/lib/reminders.ts";

// "today" = Mon 2026-10-05
const at = () => mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T12:00:00") });
const emp = (o: Record<string, string>) => ({ employeeKey: "K1", fullName: "Aman Khan", department: "AI", employmentStatus: "Active", doj: "", dob: "", ...o }) as any;
const mtg = (o: Record<string, string>) => ({ meetingId: "M1", employeeKey: "K1", employeeName: "Aman Khan", meetingType: "Quarterly Review", recordStatus: "Open", scheduledDate: "", meetingDate: "", nextFollowUpDate: "", actionTaken: "", discussionNotes: "", ...o }) as any;

test("birthday and review are reminded exactly one day before", () => {
  at();
  const r = buildReminders([emp({ dob: "1990-10-06", doj: "2026-07-06" })], []);
  assert.deepEqual(r.map((x) => x.when), ["tomorrow", "tomorrow"]);
  assert.ok(r.some((x) => /Birthday: Aman Khan.*turning 36/.test(x.text)));
  assert.ok(r.some((x) => /Review: Aman Khan.*3-month/.test(x.text)));
  // birthday today: second reminder, grouped under Today
  assert.deepEqual(buildReminders([emp({ dob: "1990-10-05" })], []).map((x) => x.when), ["today"]);
  // two days away / yesterday: no reminder
  for (const dob of ["1990-10-07", "1990-10-04"]) assert.equal(buildReminders([emp({ dob })], []).length, 0, dob);
  mock.timers.reset();
});

test("meetings today and follow-ups: today vs overdue", () => {
  at();
  const e = [emp({})];
  assert.match(buildReminders(e, [mtg({ scheduledDate: "2026-10-05" })])[0].text, /Meeting: Aman Khan - Quarterly Review/);
  assert.equal(buildReminders(e, [mtg({ meetingDate: "2026-10-06" })]).length, 0, "tomorrow's meeting is not a same-day reminder");
  assert.equal(buildReminders(e, [mtg({ nextFollowUpDate: "2026-10-05", actionTaken: "Sign policy" })])[0].when, "today");
  const od = buildReminders(e, [mtg({ nextFollowUpDate: "2026-10-03", actionTaken: "Sign policy" })])[0];
  assert.equal(od.when, "overdue");
  assert.match(od.text, /2 days overdue/);
  mock.timers.reset();
});

test("completed/cancelled meetings and employees who left are ignored", () => {
  at();
  assert.equal(buildReminders([emp({})], [mtg({ scheduledDate: "2026-10-05", recordStatus: "Completed" })]).length, 0);
  assert.equal(buildReminders([emp({})], [mtg({ scheduledDate: "2026-10-05", recordStatus: "Cancelled" })]).length, 0);
  assert.equal(buildReminders([emp({ employmentStatus: "Left", dob: "1990-10-06" })], []).length, 0);
  assert.equal(buildReminders([emp({ employmentStatus: "Left" })], [mtg({ scheduledDate: "2026-10-05" })]).length, 0);
  mock.timers.reset();
});

test("digest groups by day and is null when nothing is due", () => {
  at();
  assert.equal(buildDigest([]), null);
  const msg = buildDigest(buildReminders([emp({ dob: "1990-10-06" })], [mtg({ scheduledDate: "2026-10-05" }), mtg({ meetingId: "M2", nextFollowUpDate: "2026-10-01", actionTaken: "x" })]))!;
  assert.ok(msg.indexOf("*Tomorrow*") < msg.indexOf("*Today*") && msg.indexOf("*Today*") < msg.indexOf("*Overdue*"));
  mock.timers.reset();
});
