import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFmsReport,
  formatReportPosition,
  getFmsReportPeriods,
  listReportHrNames,
  normalizeHrName,
  reportFileName,
  reportTitle,
} from "../src/lib/fms-report.ts";
import { renderFmsReportPdf } from "../src/lib/fms-report-pdf.ts";
import type { FmsCandidate, FmsRequisition } from "../src/types/fms.ts";

const WEEK = { kind: "weekly" as const, start: "2026-10-19", end: "2026-10-25", label: "" };

function req(overrides: Partial<FmsRequisition>): FmsRequisition {
  return {
    id: "REQ-1", jobTitle: "Sales", department: "", hiringManager: "", jobLevel: "", employmentType: "",
    location: "", deadline: "", reason: "", status: "Open", createdDate: "2026-01-01", brand: "ahl",
    priority: "Medium", openings: 5, recruiterName: "Rakesh sir", ...overrides,
  };
}

function cand(overrides: Partial<FmsCandidate> & { shortlisted?: string; joined?: string }): FmsCandidate {
  const { shortlisted, joined, ...rest } = overrides;
  return {
    id: "CAND-1", fmsId: "FMS-1", fullName: "Test", phone: "1", position: "Sales", requisitionId: "REQ-1",
    currentStage: "Joining", status: "Active", brand: "ahl", stageData: {}, personalDetails: {},
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
    stages: {
      ps: { status: shortlisted ? "Completed" : "Pending", actualDate: shortlisted },
      jo: { status: joined ? "Completed" : "Pending", actualDate: joined },
    },
    ...rest,
  };
}

test("weekly periods run Monday to Sunday, newest first", () => {
  const periods = getFmsReportPeriods("weekly", "2026-11-09");
  assert.equal(periods[0].start, "2026-11-09");
  assert.equal(periods[0].end, "2026-11-15");
  assert.equal(periods[1].start, "2026-11-02");
  assert.equal(periods[1].end, "2026-11-08");
  // A Sunday still belongs to the week that started the previous Monday.
  assert.equal(getFmsReportPeriods("weekly", "2026-10-25")[0].start, "2026-10-19");
});

test("monthly periods cover whole calendar months across a year boundary", () => {
  const periods = getFmsReportPeriods("monthly", "2026-01-15");
  assert.equal(periods[0].end, "2026-01-31");
  assert.equal(periods[1].start, "2025-12-01");
  assert.equal(periods[1].end, "2025-12-31");
  assert.equal(periods[1].label, "December 2025");
  assert.equal(getFmsReportPeriods("monthly", "2028-03-01")[1].end, "2028-02-29");
});

test("headline counts only activity inside the period, including its boundary dates", () => {
  const report = buildFmsReport(
    [
      cand({ id: "A", shortlisted: "2026-10-19" }),
      cand({ id: "B", shortlisted: "2026-10-25" }),
      cand({ id: "C", shortlisted: "2026-10-18" }),
      cand({ id: "D", shortlisted: "2026-10-26" }),
      cand({ id: "E", fullName: "Harshali", shortlisted: "2026-10-01", joined: "2026-10-20" }),
      cand({ id: "F", joined: "2026-10-26" }),
    ],
    [req({})],
    WEEK
  );
  assert.equal(report.totals.shortlisted, 2);
  assert.equal(report.totals.joined, 1);
  assert.deepEqual(report.joinedCandidates, [{ name: "Harshali", post: "Sales" }]);
});

test("rejected interview results are not shortlisted", () => {
  const report = buildFmsReport(
    [
      cand({ id: "A", shortlisted: "2026-10-20", interviewUpdateStatus: "Not Hired" }),
      cand({ id: "B", shortlisted: "2026-10-20", interviewUpdateStatus: "Rescheduled", rescheduledStatus: "Didn't Come for Interview" }),
      cand({ id: "C", shortlisted: "2026-10-20", interviewUpdateStatus: "Rescheduled", rescheduledStatus: "Hired" }),
    ],
    [req({})],
    WEEK
  );
  assert.equal(report.totals.shortlisted, 1);
});

test("position lines are cumulative while headlines stay per-period", () => {
  const report = buildFmsReport(
    [
      cand({ id: "A", shortlisted: "2026-09-01", joined: "2026-09-10" }),
      cand({ id: "B", shortlisted: "2026-09-02" }),
    ],
    [req({ openings: 3 })],
    WEEK
  );
  assert.equal(report.totals.joined, 0);
  assert.equal(report.totals.shortlisted, 0);
  assert.deepEqual(report.positions, [{ title: "Sales", required: 2, joined: 1, shortlisted: 1 }]);
  assert.equal(formatReportPosition(report.positions[0]), "Sales – In Process (1 Joined & 1 Shortlisted)");
});

test("activity after the period end does not leak into a past report", () => {
  const report = buildFmsReport([cand({ shortlisted: "2026-10-20", joined: "2026-11-01" })], [req({ openings: 2 })], WEEK);
  assert.deepEqual(report.positions, [{ title: "Sales", required: 2, joined: 0, shortlisted: 1 }]);
});

test("dropped candidates leave the joined list and position lines", () => {
  const report = buildFmsReport(
    [
      cand({ id: "A", status: "Dropped", shortlisted: "2026-10-20", joined: "2026-10-21" }),
      cand({ id: "B", archived: true, shortlisted: "2026-10-20" }),
    ],
    [req({ openings: 2 })],
    WEEK
  );
  assert.equal(report.totals.joined, 0);
  assert.equal(report.totals.shortlisted, 2);
  assert.deepEqual(report.positions, [{ title: "Sales", required: 2, joined: 0, shortlisted: 0 }]);
});

test("closed, filled and not-yet-created requisitions are not required", () => {
  const report = buildFmsReport(
    [],
    [
      req({ id: "R1", jobTitle: "Closed", status: "Closed" }),
      req({ id: "R2", jobTitle: "Filled", status: "Filled" }),
      req({ id: "R3", jobTitle: "Later", createdDate: "2026-11-01" }),
      req({ id: "R4", jobTitle: "Serial date", createdDate: "46162", openings: 1 }),
      req({ id: "R5", jobTitle: "Done", openings: 1 }),
    ],
    WEEK
  );
  assert.deepEqual(report.positions.map((p) => p.title), ["Done", "Serial date"]);
  assert.equal(report.totals.required, 2);
});

test("fully joined positions disappear from the list", () => {
  const report = buildFmsReport([cand({ joined: "2026-10-20" })], [req({ openings: 1 })], WEEK);
  assert.equal(report.totals.required, 0);
  assert.equal(report.positions.length, 0);
  assert.equal(report.joinedCandidates.length, 1);
});

test("duplicate requisition IDs are resolved by job title and same titles merge", () => {
  const report = buildFmsReport(
    [cand({ requisitionId: "REQ-18", position: "Therapist", shortlisted: "2026-10-20" })],
    [
      req({ id: "REQ-18", jobTitle: "Hair stylist", openings: 8 }),
      req({ id: "REQ-18", jobTitle: "Therapist", openings: 1 }),
      req({ id: "REQ-30", jobTitle: " therapist ", openings: 2 }),
    ],
    WEEK
  );
  const therapist = report.positions.find((p) => p.title.toLowerCase() === "therapist");
  assert.deepEqual({ required: therapist?.required, shortlisted: therapist?.shortlisted }, { required: 3, shortlisted: 1 });
  assert.equal(report.positions.length, 2);
});

test("HR filter scopes everything by requisition recruiter", () => {
  const requisitions = [
    req({ id: "R1", jobTitle: "Sales", recruiterName: "Rakesh sir", openings: 2 }),
    req({ id: "R2", jobTitle: "Support", recruiterName: "Amit", openings: 4 }),
    req({ id: "R3", jobTitle: "Nail Artist", recruiterName: "", openings: 1 }),
  ];
  const candidates = [
    cand({ id: "A", requisitionId: "R1", position: "Sales", shortlisted: "2026-10-20" }),
    cand({ id: "B", requisitionId: "R2", position: "Support", shortlisted: "2026-10-20" }),
    cand({ id: "C", requisitionId: "UNKNOWN", shortlisted: "2026-10-20" }),
  ];
  assert.deepEqual(listReportHrNames(requisitions), ["Amit", "Rakesh"]);

  const rakesh = buildFmsReport(candidates, requisitions, WEEK, "Rakesh");
  assert.equal(rakesh.totals.shortlisted, 1);
  assert.equal(rakesh.totals.required, 2);

  const all = buildFmsReport(candidates, requisitions, WEEK);
  assert.equal(all.totals.shortlisted, 3);
  assert.equal(all.totals.required, 7);
});

test("HR names normalise honorifics", () => {
  assert.equal(normalizeHrName("Rakesh sir"), "Rakesh");
  assert.equal(normalizeHrName(" rakesh "), "Rakesh");
  assert.equal(normalizeHrName(undefined), "");
});

test("title and file name follow the template", () => {
  const report = buildFmsReport([], [], WEEK, "Rakesh");
  assert.equal(reportTitle(report), "Rakesh HR REPORT (19/10/2026 - 25/10/2026)");
  assert.equal(reportFileName(report), "Rakesh-HR-Weekly-Report-2026-10-19-to-2026-10-25.pdf");
  const monthly = buildFmsReport([], [], { kind: "monthly", start: "2026-10-01", end: "2026-10-31", label: "" });
  assert.equal(reportTitle(monthly), "HR MONTHLY REPORT (01/10/2026 - 31/10/2026)");
});

test("PDF renders and paginates long position lists", () => {
  const small = renderFmsReportPdf(buildFmsReport([], [], WEEK));
  assert.equal(small.getNumberOfPages(), 1);
  assert.ok(small.output("arraybuffer").byteLength > 0);

  const many = Array.from({ length: 80 }, (_, i) => req({ id: `R${i}`, jobTitle: `Position ${i}` }));
  assert.ok(renderFmsReportPdf(buildFmsReport([], many, WEEK)).getNumberOfPages() > 1);
});
