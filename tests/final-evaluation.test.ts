import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceWarnings,
  buildFinalReportMessages,
  evaluationChecklist,
  missingSteps,
  parseFinalReport,
  validateHiringDecision,
} from "../src/lib/final-evaluation.ts";
import { STANDARD_INTERVIEW_QUESTIONS } from "../src/lib/interview-sheet.ts";
import { emptyKit, type PositionKit } from "../src/lib/position-kit.ts";

const NOW = "2026-11-19T10:00:00.000Z";
const allAnswers = Object.fromEntries(STANDARD_INTERVIEW_QUESTIONS.map((q) => [q.key, "answer"]));
const kit = (o: Partial<PositionKit> = {}): PositionKit => ({ ...emptyKit(), nonNegotiables: "Weekend work", ...o });

/** A candidate who has been through every step. */
const complete = (): any => ({
  id: "CAND-9400",
  fullName: "Riya",
  position: "Video Editor",
  stageData: {
    ar: { cvScreening: { matchScore: 82, verdict: "Proceed", summary: "Strong editor", strengths: ["Premiere"], missingSkills: [], redFlags: [] } },
    ps: {
      interviewSheet: { answers: allAnswers, cvQuestions: [{ question: "Why the gap?", answer: "Course" }], interviewer: "", conductedOn: "", updatedAt: "" },
      interviewAnalysis: {
        recommendation: "Proceed", summary: "Clear answers", strongAnswers: [], weakAnswers: [], contradictions: [], missingInformation: [],
        standardQuestions: STANDARD_INTERVIEW_QUESTIONS.map((q) => ({ key: q.key, question: q.question, asked: true, answer: "x" })),
      },
      workSamples: [
        { id: "1", title: "Reel", link: "https://x.com/1", contribution: { edit: "Self" }, candidateRole: "Edited", verdict: "Own work", hrNotes: "" },
        { id: "2", title: "Ad", link: "https://x.com/2", contribution: { edit: "Shared" }, candidateRole: "Co-edited", verdict: "Mostly team work", hrNotes: "" },
      ],
      qualifyingTest: { testType: "Work-based", status: "Completed", result: "Pass", score: "8/10", evaluator: "Neha", feedback: "Good cuts", completedOn: "2026-11-18" },
    },
  },
});

test("the checklist covers every SOP step; samples and test count only when the kit asks", () => {
  const items = evaluationChecklist(complete(), kit({ workSamplesRequired: "yes", qualifyingTest: "Edit two videos" }));
  assert.deepEqual(items.map((i) => [i.key, i.required, i.done]), [
    ["cv", true, true], ["questions", true, true], ["recording", true, true], ["samples", true, true], ["test", true, true],
  ]);
  assert.equal(items.find((i) => i.key === "test")!.detail, "Pass · 8/10");

  const bare = evaluationChecklist({ stageData: {} }, null);
  assert.deepEqual(missingSteps(bare), ["CV screened by AI", "Standard interview questions", "Interview recording analysed"]);
  assert.equal(bare.find((i) => i.key === "test")!.detail, "No test in the Position Kit");
});

test("a failed or missing test, or too few samples, is a missing step when the kit requires it", () => {
  const c = complete();
  c.stageData.ps.qualifyingTest.result = "Fail";
  c.stageData.ps.workSamples = c.stageData.ps.workSamples.slice(0, 1);
  const k = kit({ workSamplesRequired: "yes", qualifyingTest: "Edit two videos" });
  assert.deepEqual(missingSteps(evaluationChecklist(c, k)), ["Work samples", "Qualifying test passed"]);
  c.stageData.ps.qualifyingTest.result = "Borderline";
  assert.deepEqual(missingSteps(evaluationChecklist(c, k)), ["Work samples"], "borderline counts as passed");
});

test("Hire is locked until every required step is done; Hold and Reject are always allowed", () => {
  const ok = { decision: "Hire" as const, decidedBy: "Neha", reason: "Best portfolio" };
  assert.equal(validateHiringDecision(ok, evaluationChecklist(complete(), kit())), null);

  const incomplete = evaluationChecklist({ stageData: {} }, null);
  assert.match(validateHiringDecision(ok, incomplete)!, /Still missing: CV screened by AI/);
  assert.equal(validateHiringDecision({ ...ok, decision: "Hold" }, incomplete), null);
  assert.equal(validateHiringDecision({ ...ok, decision: "Reject" }, incomplete), null);
  assert.match(validateHiringDecision({ ...ok, decidedBy: " " }, incomplete)!, /hiring manager/);
  assert.match(validateHiringDecision({ ...ok, reason: "" }, incomplete)!, /reason/);
  assert.match(validateHiringDecision({ ...ok, decision: "Maybe" as any }, incomplete)!, /Hire, Hold or Reject/);
});

test("the AI gets every piece of evidence and the missing steps", () => {
  const c = complete();
  const k = kit({ qualifyingTest: "Edit two videos" });
  const [system, user] = buildFinalReportMessages(c, "Video Editor", k, evaluationChecklist(c, k));
  assert.match(system.content, /Never recommend Hire while SOP steps are missing/);
  for (const part of ["Non-negotiables: Weekend work", "CV SCREENING: 82% match", "Why the gap? → Course", "INTERVIEW RECORDING ANALYSIS: Proceed", "Reel [Own work]: Edited it: themselves", "QUALIFYING TEST (Work-based): Completed, Pass", "SOP STEPS NOT DONE: none"]) {
    assert.ok(user.content.includes(part), part);
  }
  const [, bareUser] = buildFinalReportMessages({ fullName: "X", stageData: {} } as any, "", null, evaluationChecklist({ stageData: {} }, null));
  assert.match(bareUser.content, /SOP STEPS NOT DONE: CV screened by AI, Standard interview questions, Interview recording analysed/);
});

test("an AI Hire with steps missing becomes Hold; empty sections read Not assessed", () => {
  const raw = JSON.stringify({ recommendation: "hire", recommendationReason: "Great fit.", cvMatch: "Strong", strengths: ["Premiere", { area: "Speed" }] });
  const held = parseFinalReport(raw, ["Qualifying test passed"], NOW);
  assert.equal(held.recommendation, "Hold");
  assert.match(held.recommendationReason, /Changed from Hire to Hold: Qualifying test passed not done yet/);
  assert.equal(held.portfolio, "Not assessed");
  assert.deepEqual(held.strengths, ["Premiere", "Speed"]);

  assert.equal(parseFinalReport(raw, [], NOW).recommendation, "Hire");
  assert.throws(() => parseFinalReport("{}", [], NOW), /missing the recommendation/);
  assert.throws(() => parseFinalReport("oops", [], NOW), /unreadable/);
});

test("one combined warning lists every gap and the decision", () => {
  const c = complete();
  assert.deepEqual(advanceWarnings(c, kit()), ["No hiring manager decision yet"]);
  c.stageData.ps.hiringDecision = { decision: "Hire", decidedBy: "Neha", reason: "x", decidedAt: NOW };
  assert.deepEqual(advanceWarnings(c, kit()), []);
  c.stageData.ps.hiringDecision.decision = "Hold";
  assert.deepEqual(advanceWarnings(c, kit()), ["Hiring manager decided: Hold"]);
  const bare = advanceWarnings({ stageData: {} }, null);
  assert.deepEqual(bare, [
    "CV screened by AI: Not screened",
    "Standard interview questions: 0/11 answered",
    "Interview recording analysed: Not analysed",
    "No hiring manager decision yet",
  ]);
});
