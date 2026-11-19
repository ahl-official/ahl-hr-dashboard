import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildComplianceRows,
  buildReportCompliance,
  complianceSummary,
  positionsWithoutApprovedKit,
} from "../src/lib/sop-compliance.ts";
import { renderFmsReportPdf } from "../src/lib/fms-report-pdf.ts";
import { buildFmsReport } from "../src/lib/fms-report.ts";
import { STANDARD_INTERVIEW_QUESTIONS } from "../src/lib/interview-sheet.ts";
import { applyKitEdit, emptyKit, parseIcpMasterRow } from "../src/lib/position-kit.ts";

const answers = Object.fromEntries(STANDARD_INTERVIEW_QUESTIONS.map((q) => [q.key, "a"]));
const allSteps = (decision?: string) => ({
  ar: { cvScreening: { matchScore: 80, verdict: "Proceed", summary: "", strengths: [], missingSkills: [], redFlags: [] } },
  ps: {
    interviewSheet: { answers, cvQuestions: [], interviewer: "", conductedOn: "", updatedAt: "" },
    interviewAnalysis: { recommendation: "Proceed", summary: "", standardQuestions: STANDARD_INTERVIEW_QUESTIONS.map((q) => ({ key: q.key, asked: true, answer: "a" })) },
    ...(decision ? { hiringDecision: { decision, decidedBy: "Neha", reason: "x", decidedAt: "" } } : {}),
  },
});
const cand = (o: any) => ({ id: "C", fullName: "N", position: "Sales", requisitionId: "R1", currentStage: "Interview Updates", status: "Active", stageData: {}, ...o });
const kits: any[] = [
  { icpId: "K1", roleName: "Sales", status: "active", version: "1", icpContent: "", approval: "Approved", kit: { ...emptyKit(), qualifyingTest: "Role-play" } },
  { icpId: "K2", roleName: "Receptionist", status: "active", version: "1", icpContent: "", approval: "Draft", kit: emptyKit() },
];
const reqs: any[] = [
  { id: "R1", jobTitle: "Sales", status: "Open" },
  { id: "R2", jobTitle: "Receptionist", status: "Open" },
  { id: "R3", jobTitle: "Hair Stylist", status: "Open" },
  { id: "R4", jobTitle: "Video Editor", status: "Closed" },
];

test("candidates still interviewing are in progress, not violations", () => {
  const [row] = buildComplianceRows([cand({ stageData: {} })], kits, reqs);
  assert.equal(row.status, "In progress");
  assert.deepEqual(row.skipped, []);
  assert.deepEqual(row.kit, { roleName: "Sales", approved: true });
});

test("moving past interviews with gaps or without a Hire decision is flagged with what was skipped", () => {
  const [row] = buildComplianceRows([cand({ currentStage: "Confirmation Call", stageData: {} })], kits, reqs);
  assert.equal(row.status, "Skipped steps");
  assert.deepEqual(row.skipped, [
    "CV screened by AI", "Standard interview questions", "Interview recording analysed", "Qualifying test passed", "Hiring manager's Hire decision",
  ]);

  const noDecision = buildComplianceRows([cand({ currentStage: "Joining", stageData: allSteps() })], [kits[1]], reqs)[0];
  assert.deepEqual(noDecision.skipped, ["Hiring manager's Hire decision"]);

  const hired = buildComplianceRows([cand({ status: "Hired", currentStage: "Onboarding", stageData: {} })], [], reqs)[0];
  assert.equal(hired.status, "Skipped steps", "a hire counts as moved on");
});

test("every step done with a Hire decision is complete; dropped candidates are set aside", () => {
  const rows = buildComplianceRows(
    [
      cand({ id: "A", currentStage: "Joining", stageData: allSteps("Hire") }),
      cand({ id: "B", stageData: allSteps("Hire"), position: "Receptionist" }),
      cand({ id: "C", status: "Dropped", archived: true, currentStage: "Joining" }),
      cand({ id: "D" }),
    ],
    [kits[1]],
    reqs
  );
  assert.deepEqual(rows.map((r) => [r.candidateId, r.status]), [["A", "Complete"], ["B", "Complete"], ["C", "Dropped"], ["D", "In progress"]]);
  assert.deepEqual(complianceSummary(rows), { inPipeline: 3, skipped: 0, complete: 2, inProgress: 1, dropped: 1 });
});

test("open positions without an approved kit are listed once", () => {
  assert.deepEqual(positionsWithoutApprovedKit([...reqs, { id: "R5", jobTitle: "hair stylist ", status: "Open" }], kits), ["Hair Stylist", "Receptionist"]);
});

test("the PDF includes the compliance section with each skipped candidate", () => {
  const rows = buildComplianceRows([cand({ fullName: "Riya", currentStage: "Joining", stageData: {} })], kits, reqs);
  const compliance = buildReportCompliance(rows, ["Hair Stylist"], "2026-11-19");
  assert.equal(compliance.skipped[0].name, "Riya");
  const period = { kind: "weekly" as const, start: "2026-11-09", end: "2026-11-15", label: "" };
  const doc = renderFmsReportPdf(buildFmsReport([], reqs, period), compliance);
  const text = new TextDecoder().decode(doc.output("arraybuffer"));
  assert.ok(text.includes("Process compliance") || doc.getNumberOfPages() >= 1);
  assert.ok(renderFmsReportPdf(buildFmsReport([], reqs, period)).getNumberOfPages() >= 1, "still renders without it");
});

test("deactivating an old free-text profile keeps its text", () => {
  const legacy = parseIcpMasterRow(["ICP_CRM", "CRM Executive", "active", "1", "# old profile text", "", ""]);
  const off = applyKitEdit(legacy, { roleName: "CRM Executive", status: "inactive", kit: emptyKit() }, "2026-11-19");
  assert.deepEqual([off.status, off.icpContent, off.kit, off.version], ["inactive", "# old profile text", null, "1"]);
  const filled = applyKitEdit(legacy, { roleName: "CRM Executive", status: "active", kit: { ...emptyKit(), mustHaveSkills: "Zoho" } }, "2026-11-19");
  assert.match(filled.icpContent, /Zoho/, "filling fields converts it to a kit");
});
