import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getQualifyingTest,
  qualifyingTestLabel,
  qualifyingTestUpdate,
  qualifyingTestWarning,
  validateQualifyingTest,
  type QualifyingTestResult,
} from "../src/lib/qualifying-test.ts";
import { candidateFmsIndex, candidateToRow, rowToCandidateFields, CANDIDATE_FMS_HEADERS } from "../src/lib/candidate-fms-schema.ts";

const TODAY = "2026-11-19";
const done = (o: Partial<QualifyingTestResult> = {}): QualifyingTestResult => ({
  testType: "Practical",
  status: "Completed",
  scheduledOn: "2026-11-18",
  completedOn: "2026-11-18",
  evaluator: "Neha (Head Stylist)",
  score: "8/10",
  result: "Pass",
  feedback: "Clean fade, good client handling.",
  evidenceLink: "https://drive.google.com/file/d/abc/view",
  updatedAt: "",
  ...o,
});

test("a scheduled test only needs its date", () => {
  assert.equal(validateQualifyingTest(done({ status: "Scheduled", scheduledOn: "2026-11-25", completedOn: "", result: "", feedback: "", evaluator: "" }), TODAY), null);
  assert.match(validateQualifyingTest(done({ status: "Scheduled", scheduledOn: "" }), TODAY)!, /scheduled for/);
});

test("a completed test needs the date, result, evaluator and feedback", () => {
  assert.equal(validateQualifyingTest(done(), TODAY), null);
  assert.match(validateQualifyingTest(done({ completedOn: "2026-11-20" }), TODAY)!, /future/);
  assert.match(validateQualifyingTest(done({ result: "" }), TODAY)!, /Pass, Borderline or Fail/);
  assert.match(validateQualifyingTest(done({ evaluator: " " }), TODAY)!, /who evaluated/);
  assert.match(validateQualifyingTest(done({ feedback: "" }), TODAY)!, /feedback/);
  assert.match(validateQualifyingTest(done({ evidenceLink: "photos on my phone" }), TODAY)!, /web link/);
  assert.equal(validateQualifyingTest(done({ evidenceLink: "" }), TODAY), null, "evidence is optional");
});

test("a no-show needs only the date", () => {
  assert.equal(validateQualifyingTest(done({ status: "No-show", result: "", feedback: "", evaluator: "" }), TODAY), null);
  assert.match(validateQualifyingTest(done({ status: "No-show", completedOn: "" }), TODAY)!, /did not turn up/);
});

test("labels and the stage warning", () => {
  assert.equal(qualifyingTestLabel(null), "Test: not done");
  assert.equal(qualifyingTestLabel(done({ status: "Scheduled", scheduledOn: "2026-11-25" })), "Test: scheduled 2026-11-25");
  assert.equal(qualifyingTestLabel(done({ result: "Borderline" })), "Test: Borderline");

  assert.equal(qualifyingTestWarning(null, false), null, "no warning when the kit has no test");
  assert.match(qualifyingTestWarning(null, true)!, /has not taken/);
  assert.match(qualifyingTestWarning(done({ status: "Scheduled" }), true)!, /has not taken/);
  assert.match(qualifyingTestWarning(done({ status: "No-show" }), true)!, /did not turn up/);
  assert.match(qualifyingTestWarning(done({ result: "Fail" }), true)!, /failed/);
  assert.equal(qualifyingTestWarning(done({ result: "Borderline" }), true), null);
  assert.equal(qualifyingTestWarning(done(), true), null);
});

test("the result is saved in the candidate's stage data and survives the sheet round trip", () => {
  const base: any = { id: "CAND-9300", fullName: "Riya", phone: "9", currentStage: "Interview Updates", status: "Active", stageData: { ps: { workSamples: [{ id: "WS-1" }] } }, stages: {}, personalDetails: {} };
  const update = qualifyingTestUpdate(base, done());
  assert.equal(update.stageData?.ps?.workSamples?.length, 1, "work samples are kept");
  const back = rowToCandidateFields(candidateToRow({ ...base, ...update }), candidateFmsIndex(CANDIDATE_FMS_HEADERS));
  assert.equal(getQualifyingTest(back as any)?.result, "Pass");
});
