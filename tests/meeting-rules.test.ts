import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMeetingColumns, validateMeetingForm } from "../src/lib/meeting-rules.ts";

const today = "2026-10-05";
const base = { today, meetingType: "General", warningChecked: false };

test("a meeting held today or earlier is Completed, with the date in meetingDate", () => {
  for (const date of ["2026-10-05", "2026-09-01"]) {
    assert.deepEqual(deriveMeetingColumns({ ...base, date }), { scheduledDate: "", meetingDate: date, recordStatus: "Completed", warningGiven: "No" });
  }
});

test("a future date is a scheduled meeting and stays Open", () => {
  assert.deepEqual(deriveMeetingColumns({ ...base, date: "2026-10-12" }), { scheduledDate: "2026-10-12", meetingDate: "", recordStatus: "Open", warningGiven: "No" });
});

test("a pending follow-up keeps a held meeting Open so reminders and alerts keep working", () => {
  const c = deriveMeetingColumns({ ...base, date: "2026-10-05", followUpDate: "2026-10-20" });
  assert.equal(c.recordStatus, "Open");
  assert.equal(c.meetingDate, "2026-10-05");
});

test("type Warning is always a formal warning; the checkbox covers other types", () => {
  assert.equal(deriveMeetingColumns({ ...base, date: today, meetingType: "Warning" }).warningGiven, "Yes");
  assert.equal(deriveMeetingColumns({ ...base, date: today, warningChecked: true }).warningGiven, "Yes");
  assert.equal(deriveMeetingColumns({ ...base, date: today }).warningGiven, "No");
});

test("form validation", () => {
  const ok = { employeeKey: "K", notes: "Discussed goals", date: today, followUpOn: false, followUpDate: "" };
  assert.equal(validateMeetingForm(ok), null);
  assert.match(validateMeetingForm({ ...ok, employeeKey: "" })!, /employee/);
  assert.match(validateMeetingForm({ ...ok, notes: "  " })!, /note/);
  assert.match(validateMeetingForm({ ...ok, date: "" })!, /date/);
  assert.match(validateMeetingForm({ ...ok, followUpOn: true })!, /due date/);
  assert.match(validateMeetingForm({ ...ok, followUpOn: true, followUpDate: "2026-10-01" })!, /before/);
  assert.equal(validateMeetingForm({ ...ok, followUpOn: true, followUpDate: "2026-10-20" }), null);
});
