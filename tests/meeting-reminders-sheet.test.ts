import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSettings, parseMentions, parseQueue, itemToRow, targetFor, nextFreeRow, DEFAULT_SETTINGS_ROWS, SETTINGS_HEADERS, QUEUE_HEADERS } from "../src/lib/meeting-reminders-sheet.ts";
import { buildQueue, SALON_MEETING, istMoment } from "../src/lib/meeting-reminders.ts";

const withHeader = (rows: string[][]) => [SETTINGS_HEADERS, ...rows];

test("default settings reproduce the old script's rules", () => {
  const c = parseSettings(withHeader(DEFAULT_SETTINGS_ROWS));
  assert.deepEqual(c.schedule, SALON_MEETING);
  assert.equal(c.mode, "TEST", "starts safely in TEST");
});

test("settings: overrides, junk values fall back to defaults, anything but PROD stays TEST", () => {
  const rows = withHeader([
    ["MODE", "prod", ""], ["LIVE_GROUP_ID", "123-456@g.us", ""], ["TEST_NUMBER", "+91 80000 00000", ""],
    ["MEETING_TIME", "10.30", ""], ["MAX_DELAY_MINUTES", "abc", ""], ["REMINDER_SAME_DAY_TIME", "8:00", ""], ["REMINDER_1_DAY_BEFORE_TIME", "99:99", ""],
  ]);
  const c = parseSettings(rows);
  assert.equal(c.mode, "PROD");
  assert.equal(c.liveGroupId, "123-456@g.us");
  assert.equal(c.testNumber, "918000000000");
  assert.equal(c.schedule.meetingTime, "10.30");
  assert.equal(c.schedule.maxDelayMinutes, 180, "junk number -> default");
  assert.equal(c.schedule.reminders.find((r) => r.code === "R0")!.time, "8:00");
  assert.equal(c.schedule.reminders.find((r) => r.code === "R1")!.time, "11:00", "invalid time -> default");
  for (const m of ["", "TEST", "production", "yes"]) assert.equal(parseSettings(withHeader([["MODE", m, ""]])).mode, "TEST", m);
});

test("mentions: only Active=Yes, phone normalised, ids built", () => {
  const m = parseMentions([
    ["Active", "Display_Name", "Phone_Number", "Notes"],
    ["No", "Meet", "919000000003", ""],
    ["Yes", "Sanjana Roy", "919000000001", ""],
    ["yes", "Ten Digit", "98765 43210", ""],
    ["Yes", "Bad", "123", ""],
  ]);
  assert.deepEqual(m.numbers, ["919000000001", "919876543210"]);
  assert.deepEqual(m.ids, ["919000000001@c.us", "919876543210@c.us"]);
  assert.deepEqual(m.names, ["Sanjana Roy", "Ten Digit"]);
});

test("queue rows round-trip through the sheet format", () => {
  const items = buildQueue(istMoment(2026, 9, 5, 12), SALON_MEETING);
  const rows = [QUEUE_HEADERS, ...items.map((i) => itemToRow(i, "TEST"))];
  const parsed = parseQueue(rows);
  assert.equal(parsed.length, items.length);
  parsed.forEach((p, k) => {
    assert.equal(p.id, items[k].id);
    assert.equal(p.dueAt, items[k].dueAt);
    assert.equal(p.meetingAt, items[k].meetingAt);
    assert.equal(p.status, "Pending");
    assert.equal(p.attempts, 0);
    assert.equal(p.rowNumber, k + 2, "row numbers match the sheet (header is row 1)");
  });
  assert.deepEqual(parseQueue([QUEUE_HEADERS, [], ["", "x"]]), [], "blank rows are ignored");
});

test("target: the live group only in PROD; TEST goes to the test number", () => {
  const base = parseSettings(withHeader([["LIVE_GROUP_ID", "123-456@g.us", ""], ["TEST_NUMBER", "8000000000", ""]]));
  assert.deepEqual(targetFor(base), { chatId: "918000000000@c.us", label: "test number" });
  assert.deepEqual(targetFor({ ...base, mode: "PROD" }), { chatId: "123-456@g.us", label: "live group" });
  assert.equal(targetFor({ ...base, mode: "PROD", liveGroupId: "" }), null);
  assert.equal(targetFor({ ...base, testNumber: "" }), null);
});

test("next free row ignores nothing: blank rows inside the tab still count, so data is never overwritten or misplaced", () => {
  assert.equal(nextFreeRow([["Reminder_ID"]]), 2, "only the header -> row 2");
  assert.equal(nextFreeRow([["Reminder_ID"], ["A"], ["B"]]), 4);
  assert.equal(nextFreeRow([["Reminder_ID"], [], ["B"]]), 4, "a blank row in the middle counts");
  assert.equal(nextFreeRow([]), 1);
});
