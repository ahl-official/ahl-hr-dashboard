import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  buildJoinerSchedule,
  joinerCheckDueDate,
  joinerCheckId,
  joinerCheckReminders,
  joinerCheckToRow,
  parseJoinerCheckRows,
  validateJoinerCheckInput,
  ratingAverage,
  JOINER_CHECKS_HEADERS,
  type JoinerCheckRecord,
} from "../src/lib/joiner-checks-rules.ts";
import { buildReminders, buildDigest } from "../src/lib/reminders.ts";

const NOW = new Date("2026-11-17T12:00:00");
const emp = (o: Record<string, string>) =>
  ({ employeeKey: "K1", employeeId: "AHL-0101", fullName: "Riya Shah", designation: "Sales Consultant", department: "Sales", manager: "Neha", employmentStatus: "Active", doj: "", dob: "", ...o }) as any;

const record = (o: Partial<JoinerCheckRecord>): JoinerCheckRecord => ({
  checkId: "K1:day1", employeeKey: "K1", employeeId: "AHL-0101", employeeName: "Riya Shah", designation: "Sales Consultant",
  department: "Sales", manager: "Neha", doj: "2026-11-10", check: "day1", dueDate: "2026-11-10", completedOn: "2026-11-10",
  result: "Pass", score: "8/10", testUsed: "Product quiz", managerFeedback: "Good start", evaluatedBy: "Neha", notes: "",
  recordedAt: "2026-11-10T10:00:00.000Z",
  ratings: { learning: 4, practicalSkills: 3, workQuality: 5, performance: 4 }, ...o,
});

test("checks fall on Day 1, Day 6, 2 weeks and 1 month after joining", () => {
  assert.equal(joinerCheckDueDate("2026-11-10", "day1"), "2026-11-10");
  assert.equal(joinerCheckDueDate("2026-11-10", "day6"), "2026-11-15");
  assert.equal(joinerCheckDueDate("2026-11-10", "week2"), "2026-11-24");
  assert.equal(joinerCheckDueDate("2026-11-10", "month1"), "2026-12-10");
  assert.equal(joinerCheckDueDate("2026-01-31", "month1"), "2026-02-28", "month end clamps");
  assert.equal(joinerCheckDueDate("", "day1"), "");
});

test("schedule marks each check done, due, overdue or upcoming", () => {
  const [joiner] = buildJoinerSchedule([emp({ doj: "2026-11-10" })], [record({})], NOW);
  assert.deepEqual(
    joiner.checks.map((c) => [c.check, c.state]),
    [["day1", "done"], ["day6", "overdue"], ["week2", "upcoming"], ["month1", "upcoming"]]
  );
  assert.equal(joiner.checks[1].daysLate, 2);
  assert.equal(joiner.checks[0].record?.result, "Pass");

  const [dueToday] = buildJoinerSchedule([emp({ doj: "2026-11-12" })], [], NOW);
  assert.equal(dueToday.checks.find((c) => c.check === "day6")?.state, "due");
});

test("only active, recent joiners are listed, newest first", () => {
  const list = buildJoinerSchedule(
    [
      emp({ employeeKey: "OLD", doj: "2026-09-01" }),
      emp({ employeeKey: "LEFT", doj: "2026-11-10", employmentStatus: "Left" }),
      emp({ employeeKey: "NODOJ", doj: "" }),
      emp({ employeeKey: "A", doj: "2026-10-20" }),
      emp({ employeeKey: "B", doj: "2026-11-16" }),
      emp({ employeeKey: "SOON", doj: "2026-11-20" }),
    ],
    [],
    NOW
  );
  assert.deepEqual(list.map((j) => j.employee.employeeKey), ["SOON", "B", "A"]);
});

test("reminders: a day ahead, on the day, and while overdue; none once recorded", () => {
  const schedule = buildJoinerSchedule([emp({ doj: "2026-11-12" }), emp({ employeeKey: "K2", fullName: "Amit Rao", doj: "2026-11-04" })], [], NOW);
  const r = joinerCheckReminders(schedule, NOW);
  assert.ok(r.some((x) => x.when === "today" && /Day 6 check: Riya Shah \(Sales Consultant\)/.test(x.text)));
  assert.ok(r.some((x) => x.when === "tomorrow" && /2 Weeks check: Amit Rao/.test(x.text)), "Amit's 2-week check is on 18 Nov");
  assert.ok(r.some((x) => x.when === "overdue" && /Day 1 check: Riya Shah .* - 5 days overdue/.test(x.text)));

  const recorded = buildJoinerSchedule([emp({ doj: "2026-11-12" })], [record({ checkId: joinerCheckId("K1", "day6"), check: "day6" })], NOW);
  assert.ok(!joinerCheckReminders(recorded, NOW).some((x) => /Day 6/.test(x.text)));
});

test("joiner checks reach the daily HR digest", () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    const msg = buildDigest(buildReminders([emp({ doj: "2026-11-12" })], []))!;
    assert.match(msg, /\*Today\*\n- Day 6 check: Riya Shah/);
    assert.match(msg, /\*Overdue\*\n- Day 1 check: Riya Shah/);
    // without joiner records passed in, existing callers still work
    assert.equal(buildReminders([emp({ doj: "2025-01-01" })], []).length, 0);
  } finally {
    mock.timers.reset();
  }
});

test("sheet rows round-trip, including date serials", () => {
  const r = record({ checkId: "K1:week2", check: "week2", dueDate: "2026-11-24", completedOn: "2026-11-24" });
  const row = joinerCheckToRow(r);
  assert.equal(row.length, JOINER_CHECKS_HEADERS.length);
  const [parsed] = parseJoinerCheckRows([JOINER_CHECKS_HEADERS, row]);
  assert.deepEqual({ ...parsed, rowNumber: undefined }, { ...r, rowNumber: undefined });

  const serial: unknown[] = [...row];
  serial[10] = 46350; // 2026-11-24 as a Sheets date serial
  assert.equal(parseJoinerCheckRows([JOINER_CHECKS_HEADERS, serial])[0].completedOn, "2026-11-24");
});

test("recording a check needs a date, a result and manager feedback", () => {
  const ok = { check: "day1", completedOn: "2026-11-17", result: "Pass", managerFeedback: "Settling in well", ratings: { learning: 4, practicalSkills: 3, workQuality: 5, performance: 4 } };
  assert.equal(validateJoinerCheckInput(ok, "2026-11-17"), null);
  assert.match(validateJoinerCheckInput({ ...ok, check: "day3" }, "2026-11-17")!, /Unknown check/);
  assert.match(validateJoinerCheckInput({ ...ok, completedOn: "" }, "2026-11-17")!, /date is required/);
  assert.match(validateJoinerCheckInput({ ...ok, completedOn: "2026-11-18" }, "2026-11-17")!, /future/);
  assert.match(validateJoinerCheckInput({ ...ok, result: "Great" }, "2026-11-17")!, /result/);
  assert.match(validateJoinerCheckInput({ ...ok, managerFeedback: " " }, "2026-11-17")!, /feedback/);
});

test("all four SOP areas must be rated 1-5", () => {
  const base = { check: "day6", completedOn: "2026-11-17", result: "Pass", managerFeedback: "Good" };
  const all = { learning: 4, practicalSkills: 3, workQuality: 5, performance: 4 };
  assert.equal(validateJoinerCheckInput({ ...base, ratings: all }, "2026-11-17"), null);
  assert.match(validateJoinerCheckInput({ ...base, ratings: {} }, "2026-11-17")!, /Rate Learning, Practical skills, Work quality, Performance from 1 to 5/);
  assert.match(validateJoinerCheckInput({ ...base, ratings: { ...all, workQuality: 6 } }, "2026-11-17")!, /Rate Work quality/);
  assert.match(validateJoinerCheckInput({ ...base, ratings: { ...all, performance: 2.5 } }, "2026-11-17")!, /Rate Performance/);
  assert.equal(validateJoinerCheckInput({ ...base, ratings: { ...all, learning: "5" } }, "2026-11-17"), null, "numbers sent as text are fine");
});

test("ratings round-trip, rows saved before ratings still load, and the average is shown", () => {
  const r = record({ ratings: { learning: 4, practicalSkills: 3, workQuality: 5, performance: 4 } });
  const row = joinerCheckToRow(r);
  assert.deepEqual(row.slice(-4), ["4", "3", "5", "4"]);
  assert.deepEqual(parseJoinerCheckRows([JOINER_CHECKS_HEADERS, row])[0].ratings, r.ratings);

  const legacy = row.slice(0, 18); // written when the tab had 18 columns
  assert.deepEqual(parseJoinerCheckRows([JOINER_CHECKS_HEADERS.slice(0, 18), legacy])[0].ratings, {
    learning: null, practicalSkills: null, workQuality: null, performance: null,
  });

  assert.equal(ratingAverage(r.ratings), 4);
  assert.equal(ratingAverage({ learning: 4, practicalSkills: 3, workQuality: 3, performance: null }), 3.3);
  assert.equal(ratingAverage({ learning: null, practicalSkills: null, workQuality: null, performance: null }), null);
  assert.equal(ratingAverage(undefined), null);
});
