import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCvScreeningMessages,
  parseCvScreeningResponse,
  pickIcpForPosition,
  type IcpOption,
} from "../src/lib/cv-screening.ts";
import {
  STANDARD_INTERVIEW_QUESTIONS,
  getInterviewSheet,
  interviewSheetProgress,
  interviewSheetUpdate,
  type InterviewSheet,
} from "../src/lib/interview-sheet.ts";
import { candidateFmsIndex, candidateToRow, rowToCandidateFields, CANDIDATE_FMS_HEADERS } from "../src/lib/candidate-fms-schema.ts";

const icp = (o: Partial<IcpOption>): IcpOption => ({ icpId: "ICP1", roleName: "Sales Consultant", status: "active", version: "2", icpContent: "Must have 2+ years in salon sales", ...o });

test("the ICP is chosen by exact role name first, then by shared words, never an inactive one", () => {
  const icps = [
    icp({ icpId: "A", roleName: "Hair Stylist" }),
    icp({ icpId: "B", roleName: "Sales Consultant" }),
    icp({ icpId: "C", roleName: "Senior Sales Consultant", status: "inactive" }),
    icp({ icpId: "D", roleName: "Video Editor" }),
  ];
  assert.equal(pickIcpForPosition(icps, "sales consultant")?.icpId, "B");
  assert.equal(pickIcpForPosition(icps, "Consultant", "")?.icpId, "B");
  assert.equal(pickIcpForPosition(icps, "Applicant", "Senior Video Editor")?.icpId, "D", "falls back to the requisition title");
  assert.equal(pickIcpForPosition(icps, "Receptionist"), null);
  assert.equal(pickIcpForPosition(icps, ""), null);
});

test("the prompt carries the ICP's rules, the role details and the CV", () => {
  const [system, user] = buildCvScreeningMessages("Riya", "Worked 3 years at Lakme.", {
    position: "Sales Consultant",
    requisition: { requiredSkills: "Client consultation", minExp: "2", maxExp: "5", budget: "25k" },
    icp: icp({}),
  });
  assert.match(system.content, /non-negotiables, red flags\s+and rejection criteria as hard rules/);
  assert.match(system.content, /interviewQuestions/);
  assert.match(user.content, /version 2/);
  assert.match(user.content, /Must have 2\+ years in salon sales/);
  assert.match(user.content, /Required experience: 2 to 5 years/);
  assert.match(user.content, /Worked 3 years at Lakme\./);

  const noIcp = buildCvScreeningMessages("Riya", "CV", { position: "Receptionist", icp: null })[1].content;
  assert.match(noIcp, /No Ideal Candidate Profile is available/);
});

test("a valid AI answer is cleaned up; a broken one is rejected instead of saved", () => {
  const report = parseCvScreeningResponse(
    JSON.stringify({
      matchScore: 128.4,
      verdict: "proceed",
      summary: "Strong salon sales background.",
      relevantExperience: "3 years at Lakme",
      strengths: ["Client handling", " ", { title: "Upselling" }],
      missingSkills: "none",
      redFlags: [],
      interviewQuestions: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"],
    })
  );
  assert.equal(report.matchScore, 100);
  assert.equal(report.verdict, "Proceed");
  assert.deepEqual(report.strengths, ["Client handling", "Upselling"]);
  assert.deepEqual(report.missingSkills, []);
  assert.equal(report.interviewQuestions.length, 6);

  assert.throws(() => parseCvScreeningResponse("not json"), /unreadable/);
  assert.throws(() => parseCvScreeningResponse(JSON.stringify({ matchScore: 70, verdict: "Maybe", summary: "x" })), /missing/);
  assert.throws(() => parseCvScreeningResponse(JSON.stringify({ matchScore: "high", verdict: "Hold", summary: "x" })), /missing/);
});

const sheet = (answers: InterviewSheet["answers"]): InterviewSheet => ({ answers, cvQuestions: [], interviewer: "Rakesh", conductedOn: "2026-11-17", updatedAt: "" });

test("the interview sheet has the SOP's 8 questions plus salary, notice and joining date", () => {
  assert.equal(STANDARD_INTERVIEW_QUESTIONS.length, 11);
  assert.ok(STANDARD_INTERVIEW_QUESTIONS.some((q) => /Khar West/.test(q.question)));
  assert.deepEqual(interviewSheetProgress(null), {
    answered: 0,
    total: 11,
    missing: STANDARD_INTERVIEW_QUESTIONS.map((q) => q.question),
    complete: false,
  });
  const all = Object.fromEntries(STANDARD_INTERVIEW_QUESTIONS.map((q) => [q.key, "answer"]));
  assert.equal(interviewSheetProgress(sheet(all)).complete, true);
  const partly = interviewSheetProgress(sheet({ ...all, travelToKhar: "  " }));
  assert.deepEqual([partly.answered, partly.missing], [10, ["How will you manage travelling to Khar West every day?"]]);
});

test("screening report and interview answers survive a save to the sheet and back", () => {
  const base: any = {
    id: "CAND-9100",
    fullName: "Riya",
    phone: "9999999999",
    currentStage: "Interview Updates",
    status: "Active",
    stageData: { ar: { cvScreening: { matchScore: 81, verdict: "Proceed", summary: "Good" } } },
    stages: {},
    personalDetails: {},
  };
  const update = interviewSheetUpdate(base, sheet({ leavingReason: "Growth", expectedSalary: "28,000", noticePeriod: "15 days" }));
  assert.equal(update.expectedSalary, "28,000");
  assert.equal(update.noticePeriod, "15 days");

  const row = candidateToRow({ ...base, ...update });
  assert.equal(row[CANDIDATE_FMS_HEADERS.indexOf("Expected Salary")], "28,000", "fills the Confirmation Call column");
  assert.equal(row[CANDIDATE_FMS_HEADERS.indexOf("Notice Period")], "15 days");

  const back = rowToCandidateFields(row, candidateFmsIndex(CANDIDATE_FMS_HEADERS));
  assert.equal(back.stageData?.ar?.cvScreening?.matchScore, 81);
  assert.equal(getInterviewSheet(back as any)?.answers.leavingReason, "Growth");

  // An answer left blank does not wipe a value already on the candidate.
  assert.equal(interviewSheetUpdate(base, sheet({})).expectedSalary, undefined);
});
