// Run with: npm test   (node:test, Node 22+ strips the TypeScript types natively)
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  parseIsoDate,
  calculateBirthdays,
  calculateMilestones,
  getNextEmployeeReview,
  formatTenure,
  formatExactTenure,
  formatAverageTenure,
  safeAnniversaryDate,
  initials,
  humanCountdown,
} from "../src/lib/date-utils.ts";
import { cleanPhoneNumber } from "../src/lib/whatsapp.ts";
import { isIsoDate, assertOneOf, ValidationError, isEmail, isPhone, isPan, isIfsc, isAadhaar, isAccountNo, validateOnboardingStep } from "../src/lib/validate.ts";

const at = (iso: string) => mock.timers.enable({ apis: ["Date"], now: new Date(`${iso}T12:00:00`) });
const emp = (over: Record<string, string>) =>
  ({ employeeKey: "K", fullName: "T", employeeId: "1", department: "D", doj: "", dob: "", ...over }) as any;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("parseIsoDate rejects malformed and rolled-over dates", () => {
  assert.ok(parseIsoDate("2026-10-05"));
  assert.equal(parseIsoDate("05/10/2026"), null);
  assert.equal(parseIsoDate(""), null);
  assert.equal(parseIsoDate("2026-02-30"), null, "Feb 30 must not roll to Mar 2");
  assert.equal(parseIsoDate("2026-13-01"), null);
  assert.ok(parseIsoDate("2028-02-29"), "leap day is valid");
  assert.equal(parseIsoDate("2027-02-29"), null);
});

test("isIsoDate is strict", () => {
  assert.ok(isIsoDate("2026-10-05"));
  assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("2026-1-5"));
  assert.ok(!isIsoDate(20261005));
});

test("birthdays: today, tomorrow, 30-day boundary, year wrap, leap day", () => {
  at("2026-10-05");
  const r = (dob: string, h = 30) => calculateBirthdays([emp({ dob })], h);
  assert.equal(r("1990-10-05")[0].daysUntil, 0);
  assert.equal(r("1990-10-05")[0].age, 36);
  assert.equal(r("1990-10-06")[0].daysUntil, 1);
  assert.equal(r("1990-11-04").length, 1, "day 30 included");
  assert.equal(r("1990-11-05").length, 0, "day 31 excluded");
  assert.equal(r("1990-10-04").length, 0, "yesterday is not within 30 days");
  mock.timers.reset();

  at("2026-12-20");
  const wrap = calculateBirthdays([emp({ dob: "1990-01-05" })], 30)[0];
  assert.equal(wrap.daysUntil, 16);
  assert.equal(wrap.age, 37);
  mock.timers.reset();

  at("2027-02-27");
  const leap = calculateBirthdays([emp({ dob: "1992-02-29" })], 30)[0];
  assert.equal(iso(leap.dateObj), "2027-02-28", "leap-day birthday falls on Feb 28 in non-leap years");
  mock.timers.reset();
});

test("birthdays ignore missing / invalid DOB and sort soonest first", () => {
  at("2026-10-05");
  const list = calculateBirthdays(
    [emp({ dob: "" }), emp({ dob: "garbage" }), emp({ fullName: "B", dob: "1990-10-20" }), emp({ fullName: "A", dob: "1990-10-10" })],
    30
  );
  assert.deepEqual(list.map((e) => e.employeeName), ["A", "B"]);
  mock.timers.reset();
});

test("review cycle: 7D, 15D, 1M then quarterly", () => {
  at("2026-10-05");
  const next = (doj: string) => {
    const r = getNextEmployeeReview(parseIsoDate(doj)!, new Date());
    return `${r.shortLabel}@${iso(r.date)}`;
  };
  assert.equal(next("2026-10-05"), "7D@2026-10-12", "joined today");
  assert.equal(next("2026-09-28"), "7D@2026-10-05", "7D falls today");
  assert.equal(next("2026-09-20"), "15D@2026-10-05", "15D falls today");
  assert.equal(next("2026-09-05"), "1M@2026-10-05", "1M falls today");
  assert.equal(next("2026-08-31"), "3M@2026-11-30", "after 1M next is 3M (Aug 31 + 3M clamps to Nov 30)");
  assert.equal(next("2026-01-31"), "9M@2026-10-31", "month-end DOJ clamps (Jan 31 + 9M = Oct 31)");
  assert.equal(next("2026-05-31"), "6M@2026-11-30", "May 31 + 6M = Nov 30");
  assert.equal(next("2025-10-05"), "1Y@2026-10-05", "exact first anniversary is today");
  assert.equal(next("2025-10-06"), "1Y@2026-10-06");
  assert.equal(next("2025-07-05"), "1Y+3M@2026-10-05", "15 months");
  mock.timers.reset();
});

test("review never lands in the past and gaps are at most 3 months", () => {
  at("2026-10-05");
  const today = new Date();
  for (let back = 0; back < 3000; back += 7) {
    const doj = new Date(2026, 9, 5 - back, 12);
    const r = getNextEmployeeReview(doj, today);
    assert.ok(r.date >= new Date(2026, 9, 5, 12), `review before today for doj=${iso(doj)}`);
    const days = Math.round((r.date.getTime() - today.getTime()) / 86400000);
    assert.ok(days <= 93, `next review too far (${days}d) for doj=${iso(doj)}`);
  }
  mock.timers.reset();
});

test("milestones: future joiners skipped, horizon respected, sorted", () => {
  at("2026-10-05");
  const list = calculateMilestones(
    [emp({ fullName: "Future", doj: "2026-11-01" }), emp({ fullName: "Soon", doj: "2026-09-28" }), emp({ fullName: "Far", doj: "2026-06-05" })],
    7
  );
  assert.deepEqual(list.map((e) => e.employeeName), ["Soon"]);
  assert.equal(calculateMilestones([emp({ doj: "2026-09-28" })], Infinity).length, 1);
  mock.timers.reset();
});

test("tenure formatters agree on exact anniversaries", () => {
  at("2026-10-05");
  assert.equal(formatExactTenure("2025-10-05"), "1 year");
  assert.equal(formatTenure("2025-10-05"), "1y 0m", "was '11 months' because of day-count math");
  assert.equal(formatTenure("2026-09-05"), "1 month");
  assert.equal(formatTenure("2026-10-01"), "4 days");
  assert.equal(formatTenure("2023-10-09"), "2y 11m");
  assert.equal(formatTenure(""), "DOJ missing");
  mock.timers.reset();
});

test("average tenure formatting", () => {
  assert.equal(formatAverageTenure(0), "0 months");
  assert.equal(formatAverageTenure(365.2425 * 2), "2 years");
});

test("helpers", () => {
  assert.equal(iso(safeAnniversaryDate(2027, 1, 29)), "2027-02-28");
  assert.equal(initials("Aman Khan"), "AK");
  assert.equal(initials("Anita"), "A");
  assert.equal(initials(""), "?");
  assert.equal(humanCountdown(0), "Today");
  assert.equal(humanCountdown(1), "Tomorrow");
});

test("cleanPhoneNumber builds correct wa.me numbers", () => {
  assert.equal(cleanPhoneNumber("98765 43210"), "919876543210");
  assert.equal(cleanPhoneNumber("+91 98765-43210"), "919876543210");
  assert.equal(cleanPhoneNumber("09876543210"), "919876543210");
  assert.equal(cleanPhoneNumber("919876543210"), "919876543210");
  assert.equal(cleanPhoneNumber("0091 9876543210"), "919876543210");
  assert.equal(cleanPhoneNumber(""), "");
  assert.equal(cleanPhoneNumber("12345"), "", "too short to be a real number");
  assert.equal(cleanPhoneNumber("98765 43210 / 91234 56789"), "919876543210", "takes the first of two numbers");
  assert.equal(cleanPhoneNumber("9876543210, 9123456789"), "919876543210");
});

test("validators", () => {
  assert.equal(assertOneOf("Open", ["Open", "Completed"] as const, "Status"), "Open");
  assert.throws(() => assertOneOf("Bogus", ["Open"] as const, "Status"), ValidationError);
  assert.ok(isEmail("a@b.co"));
  assert.ok(!isEmail("a@b"));
});

test("format validators", () => {
  assert.ok(isPhone("98765 43210") && isPhone("+91 98765-43210") && isPhone("09876543210"));
  assert.ok(!isPhone("12345") && !isPhone("5876543210") && !isPhone("987654321"));
  assert.ok(isPan("abcde1234f") && !isPan("ABCDE12345"));
  assert.ok(isIfsc("HDFC0001234") && !isIfsc("HDFC1001234"));
  assert.ok(isAadhaar("1234 5678 9012") && !isAadhaar("12345"));
  assert.ok(isAccountNo("123456789012") && !isAccountNo("1234"));
});

test("onboarding wizard validation per step", () => {
  const ok = {
    fullName: "A B", employeeId: "10", company: "AHL", designation: "X", department: "Accounts", manager: "M", doj: "2026-10-01", companyEmail: "",
    dob: "1995-05-05", mobile: "9876543210", personalEmail: "a@b.co", emergencyNumber: "", aadhar: "", pan: "",
    ifsc: "", accountNumber: "", currentSalary: "", incrementYear: "", incrementPercent: "",
    signature: "A B", signatureImage: "data", signDate: "2026-10-01", politicalBackground: "No", politicalDetails: "",
  };
  for (const step of [1, 2, 3, 4, 5]) assert.equal(validateOnboardingStep(step, ok), null, `step ${step}`);
  assert.match(validateOnboardingStep(1, { ...ok, fullName: " " })!, /Full name/);
  assert.match(validateOnboardingStep(1, { ...ok, doj: "2026-02-30" })!, /joining/);
  assert.match(validateOnboardingStep(2, { ...ok, dob: "" })!, /birth/);
  assert.match(validateOnboardingStep(2, { ...ok, dob: "2026-10-01" })!, /before/);
  assert.match(validateOnboardingStep(2, { ...ok, dob: "2020-01-01" })!, /under 15/);
  assert.match(validateOnboardingStep(2, { ...ok, mobile: "12345" })!, /Mobile/);
  assert.match(validateOnboardingStep(2, { ...ok, personalEmail: "nope" })!, /email/);
  assert.match(validateOnboardingStep(3, { ...ok, ifsc: "BAD" })!, /IFSC/);
  assert.match(validateOnboardingStep(5, { ...ok, politicalBackground: "Yes" })!, /political/i);
  assert.match(validateOnboardingStep(5, { ...ok, signatureImage: "" })!, /draw your signature/);
});
