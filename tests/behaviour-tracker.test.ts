import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectBehaviourSignals,
  evaluateBranchState,
  buildHrTalkDossier,
  buildEmployeeWhatsAppMessage,
  LATE_MARKS_THRESHOLD,
  isAdjacentToHoliday,
} from "../src/lib/behaviour-rules.ts";
import {
  evaluateAndSaveBranch,
  sendMonthlyWhatsAppStore,
  recordHrTalkStore,
  getBirdsEyeViewStore,
  getBranchByIdStore,
} from "../src/lib/behaviour-store.ts";
import type { BehaviourEvaluationInput } from "../src/types/behaviour-tracker.ts";

describe("Task 3: Employee Behaviour-Pattern Tracking Engine", () => {
  it("Late marks threshold is strictly set to 6 (matching Hazri Box allowance of 5)", () => {
    assert.equal(LATE_MARKS_THRESHOLD, 6);

    const belowThresholdInput: BehaviourEvaluationInput = {
      employeeKey: "EMP-TEST-010",
      employeeId: "AHL-HK-0010",
      employeeName: "Aditi V",
      department: "Salon",
      company: "American Hairline",
      phone: "919967947422",
      month: "2026-11",
      lateDaysCount: 5, // Within allowance
      lateDays: ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-12"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [],
    };

    const belowSignals = detectBehaviourSignals(belowThresholdInput);
    assert.equal(belowSignals.length, 0, "5 late marks should be forgiven and not trigger a branch");

    const atThresholdInput = { ...belowThresholdInput, lateDaysCount: 6, lateDays: [...belowThresholdInput.lateDays, "2026-11-15"] };
    const atSignals = detectBehaviourSignals(atThresholdInput);
    assert.equal(atSignals.length, 1);
    assert.equal(atSignals[0].type, "late_marks");
    assert.equal(atSignals[0].occurrences, 6);
  });

  it("Done when 1: A test employee's leave data creates a grey branch", () => {
    // Employee with Monday and Friday leaves extending weekends + 7 late marks
    const testEmployeeInput: BehaviourEvaluationInput = {
      employeeKey: "EMP-TEST-101",
      employeeId: "AHL-HK-0101",
      employeeName: "Siddhesh Kadam",
      department: "Salon Operations",
      company: "American Hairline",
      phone: "919876543210",
      month: "2026-11",
      lateDaysCount: 7,
      lateDays: ["2026-11-03", "2026-11-05", "2026-11-07", "2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19"],
      leaveRecords: [
        { type: "Casual Leave", from: "2026-11-06", till: "2026-11-06", days: 1, reason: "Personal" }, // Friday
        { type: "Casual Leave", from: "2026-11-16", till: "2026-11-16", days: 1, reason: "Family event" }, // Monday
      ],
      holidayDates: ["2026-11-13"],
      hrWarnings: [],
    };

    const branch = evaluateAndSaveBranch(testEmployeeInput);

    assert.equal(branch.color, "grey", "Initial detection must create a GREY branch");
    assert.equal(branch.status, "watching", "Status must be 'watching'");
    assert.ok(branch.signals.length >= 2, "Should capture late marks and Mon/Fri leaves");
    assert.equal(branch.hrTalkCompleted, false, "HR talk should be initially pending");
    assert.equal(branch.whatsappSentAt, undefined, "WhatsApp should not be sent yet");
  });

  it("Holiday bridge detection identifies leave taken adjacent to public holidays", () => {
    const holidayDates = ["2026-11-13"]; // Friday holiday
    const bridgeResult = isAdjacentToHoliday("2026-11-12", holidayDates); // Thursday before
    assert.equal(bridgeResult.isBridge, true);
    assert.equal(bridgeResult.holidayDate, "2026-11-13");
  });

  it("Dynamic week-off extension in 6-day working company: detects leaves adjacent to custom week-off", () => {
    // Stylist with Wednesday as scheduled week-off (working days Thu, Fri, Sat, Sun, Mon, Tue)
    const stylistWithWednesdayOff: BehaviourEvaluationInput = {
      employeeKey: "EMP-TEST-WED",
      employeeId: "AHL-HK-0099",
      employeeName: "Farhan Khan",
      department: "Salon Styling",
      company: "American Hairline",
      phone: "919876543211",
      month: "2026-11",
      lateDaysCount: 2,
      lateDays: ["2026-11-05", "2026-11-12"],
      scheduledWeekOff: "Wednesday", // 3
      leaveRecords: [
        { type: "Casual Leave", from: "2026-11-10", till: "2026-11-10", days: 1 }, // Tuesday (day before Wednesday off)
        { type: "Casual Leave", from: "2026-11-19", till: "2026-11-19", days: 1 }, // Thursday (day after Wednesday off)
      ],
      holidayDates: [],
      hrWarnings: [],
    };

    const signals = detectBehaviourSignals(stylistWithWednesdayOff);
    assert.equal(signals.length, 1);
    assert.equal(signals[0].type, "week_off_extension_leave");
    assert.ok(signals[0].title.includes("Wednesday Off"));
    assert.equal(signals[0].occurrences, 2);
  });

  it("Hazri Box working_days resolution: accurately identifies missing 7th day as employee's week-off", () => {
    // Technician with Hazri Box working_days array missing Monday
    const technicianInput: BehaviourEvaluationInput = {
      employeeKey: "EMP-TEST-HAZRI",
      employeeId: "AHL-HK-0092",
      employeeName: "Aditi Vishwakarma",
      department: "General Salon",
      company: "American Hairline",
      phone: "919967947422",
      month: "2026-11",
      lateDaysCount: 3,
      lateDays: ["2026-11-04", "2026-11-11", "2026-11-18"],
      workingDays: ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], // Mon is missing!
      leaveRecords: [
        { type: "Sick Leave", from: "2026-11-15", till: "2026-11-15", days: 1 }, // Sunday (day before Monday off)
        { type: "Casual Leave", from: "2026-11-24", till: "2026-11-24", days: 1 }, // Tuesday (day after Monday off)
      ],
      holidayDates: [],
      hrWarnings: [],
    };

    const signals = detectBehaviourSignals(technicianInput);
    assert.equal(signals.length, 1);
    assert.equal(signals[0].type, "week_off_extension_leave");
    assert.ok(signals[0].title.includes("Monday Off"));
  });

  it("Done when 2: HR gets the report for that employee", () => {
    const branch = evaluateAndSaveBranch({
      employeeKey: "EMP-TEST-102",
      employeeId: "AHL-HK-0102",
      employeeName: "Pooja Hegde",
      department: "Styling",
      company: "Alchemane",
      phone: "919930068840",
      month: "2026-11",
      lateDaysCount: 8,
      lateDays: ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [{ date: "2026-11-10", notes: "Late for salon client prep", actionTaken: "Verbal warning" }],
    });

    // Generate HR talk dossier
    const dossier = buildHrTalkDossier(branch);
    assert.ok(dossier.includes("Pooja Hegde"));
    assert.ok(dossier.includes("Excessive Late Marks"));
    assert.ok(dossier.includes("HR Disciplinary Warnings"));
    assert.ok(dossier.includes("RECOMMENDED HR TALK POINTS"));

    // Record HR Talk
    const updated = recordHrTalkStore(branch.id, "Discussed client handover punctuality. Pooja agreed to take 8:30 AM train.");
    assert.equal(updated.hrTalkCompleted, true);
    assert.ok(updated.hrTalkNotes?.includes("client handover"));
    assert.ok(updated.hrTalkDate);
  });

  it("Done when 3: One WhatsApp message goes out, and no second one that month", async () => {
    const branch = evaluateAndSaveBranch({
      employeeKey: "EMP-TEST-103",
      employeeId: "AHL-HK-0103",
      employeeName: "Deepak Joshi",
      department: "Technical",
      company: "American Hairline",
      phone: "919930068840",
      month: "2026-11",
      lateDaysCount: 9,
      lateDays: ["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-09", "2026-11-10", "2026-11-12", "2026-11-16", "2026-11-17", "2026-11-19"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [],
    });

    // 1st dispatch: Should succeed and stamp whatsappSentAt
    const firstDispatch = await sendMonthlyWhatsAppStore(branch.id);
    assert.equal(firstDispatch.success, true);
    assert.ok(firstDispatch.branch.whatsappSentAt);

    // 2nd dispatch in same month: MUST fail and be blocked by strict policy
    await assert.rejects(
      async () => {
        await sendMonthlyWhatsAppStore(branch.id);
      },
      (err: Error) => {
        assert.match(err.message, /Strictly one message allowed per month/i);
        return true;
      }
    );
  });

  it("Done when 4a: Next month's test data turns the branch green (improved)", () => {
    const empKey = "EMP-TEST-104";

    // Month 1 (October): Anomaly detected -> Grey branch opens
    const month1Input: BehaviourEvaluationInput = {
      employeeKey: empKey,
      employeeId: "AHL-HK-0104",
      employeeName: "Vikram Mehta",
      department: "Sales",
      company: "American Hairline",
      phone: "919930068840",
      month: "2026-10",
      lateDaysCount: 8,
      lateDays: ["2026-10-02", "2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15", "2026-10-19", "2026-10-22", "2026-10-26"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [],
    };
    const branchMonth1 = evaluateAndSaveBranch(month1Input);
    assert.equal(branchMonth1.color, "grey");
    assert.equal(branchMonth1.status, "watching");

    // Month 2 (November): Employee improved (only 2 late marks, no unapproved leaves)
    const month2Input: BehaviourEvaluationInput = {
      employeeKey: empKey,
      employeeId: "AHL-HK-0104",
      employeeName: "Vikram Mehta",
      department: "Sales",
      company: "American Hairline",
      phone: "919930068840",
      month: "2026-11",
      lateDaysCount: 2, // Well below threshold of 6!
      lateDays: ["2026-11-04", "2026-11-18"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [],
    };

    const branchMonth2 = evaluateAndSaveBranch(month2Input);
    assert.equal(branchMonth2.color, "green", "Improved performance must turn the branch GREEN");
    assert.equal(branchMonth2.status, "improved");
    assert.equal(branchMonth2.signals.length, 0);
    assert.ok(branchMonth2.closedAt, "Branch must be marked closed");
  });

  it("Done when 4b: Next month's test data opens a red branch (not improved / repeat)", () => {
    const empKey = "EMP-TEST-105";

    // Month 1 (October): Anomaly detected -> Grey branch opens
    const month1Input: BehaviourEvaluationInput = {
      employeeKey: empKey,
      employeeId: "AHL-HK-0105",
      employeeName: "Kunal Patil",
      department: "Marketing",
      company: "American Hairline",
      phone: "919930068840",
      month: "2026-10",
      lateDaysCount: 7,
      lateDays: ["2026-10-01", "2026-10-06", "2026-10-08", "2026-10-13", "2026-10-15", "2026-10-20", "2026-10-27"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [],
    };
    const branchMonth1 = evaluateAndSaveBranch(month1Input);
    assert.equal(branchMonth1.color, "grey");

    // Month 2 (November): Employee did NOT improve (7 late marks again + disciplinary note)
    const month2Input: BehaviourEvaluationInput = {
      employeeKey: empKey,
      employeeId: "AHL-HK-0105",
      employeeName: "Kunal Patil",
      department: "Marketing",
      company: "American Hairline",
      phone: "919930068840",
      month: "2026-11",
      lateDaysCount: 8,
      lateDays: ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18", "2026-11-20"],
      leaveRecords: [],
      holidayDates: [],
      hrWarnings: [{ date: "2026-11-14", notes: "Unresponsive during morning standup", actionTaken: "Warning issued" }],
    };

    const branchMonth2 = evaluateAndSaveBranch(month2Input);
    assert.equal(branchMonth2.color, "red", "Repeat offense in Month 2 must open a RED branch");
    assert.equal(branchMonth2.status, "repeat");
    assert.ok(branchMonth2.signals.length >= 2);
  });

  it("Bird's-Eye View aggregates everyone into Grey, Red, and Green for Vinitt sir & HR", () => {
    const summary = getBirdsEyeViewStore("2026-11");
    assert.ok(summary.totalWatched > 0);
    assert.ok(Array.isArray(summary.branches.grey));
    assert.ok(Array.isArray(summary.branches.red));
    assert.ok(Array.isArray(summary.branches.green));
    assert.equal(summary.totalWatched, summary.greyCount + summary.redCount + summary.greenCount);
  });
});
