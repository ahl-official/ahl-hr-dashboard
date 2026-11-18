import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analysisCoverage,
  buildInterviewAnalysisMessages,
  mergeAnalysisIntoSheet,
  parseInterviewAnalysisResponse,
  recordingDownloadUrl,
} from "../src/lib/interview-analysis.ts";
import { STANDARD_INTERVIEW_QUESTIONS, type InterviewSheet } from "../src/lib/interview-sheet.ts";

const NOW = "2026-11-18T10:00:00.000Z";

test("Google Drive file links become direct downloads; folders and docs are refused", () => {
  const direct = "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMn&export=download&confirm=t";
  assert.equal(recordingDownloadUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing"), direct);
  assert.equal(recordingDownloadUrl("https://drive.google.com/open?id=1AbCdEfGhIjKlMn"), direct);
  assert.equal(recordingDownloadUrl("https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn"), direct);
  assert.equal(recordingDownloadUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn"), null);
  assert.equal(recordingDownloadUrl("https://docs.google.com/document/d/1AbCdEfGhIjKlMn/edit"), null);
  assert.equal(recordingDownloadUrl("  https://example.com/call.mp3 "), "https://example.com/call.mp3");
  assert.equal(recordingDownloadUrl("call.mp3"), null);
});

test("the prompt lists every standard question, the extra questions and what is already known", () => {
  const [system, user] = buildInterviewAnalysisMessages("Speaker A: Hello", {
    candidateName: "Riya",
    position: "Sales Consultant",
    screening: { summary: "Good match", relevantExperience: "3 years at Lakme", strengths: [], missingSkills: [], redFlags: ["Short stint"] },
    sheet: { answers: { noticePeriod: "15 days" }, cvQuestions: [], interviewer: "", conductedOn: "", updatedAt: "" },
    profile: { currentLocation: "Andheri" },
    extraQuestions: ["How do you upsell?"],
  });
  assert.match(system.content, /mix Hindi and English/);
  assert.match(system.content, /contradictions/);
  for (const q of STANDARD_INTERVIEW_QUESTIONS) assert.ok(user.content.includes(`- ${q.key}: ${q.question}`), q.key);
  assert.match(user.content, /1\. How do you upsell\?/);
  assert.match(user.content, /Experience per CV: 3 years at Lakme/);
  assert.match(user.content, /What is your notice period\? → 15 days/);
  assert.match(user.content, /Location on application: Andheri/);
});

test("the AI answer is normalised: all 11 questions in SOP order, extra questions matched by wording", () => {
  const parsed = parseInterviewAnalysisResponse(
    JSON.stringify({
      summary: "Confident candidate.",
      recommendation: "proceed",
      standardQuestions: [
        { key: "travelToKhar", asked: true, answer: "Train from Andheri" },
        { key: "expectedSalary", answer: "30k" },
        { key: "leavingReason", asked: false, answer: "" },
      ],
      otherQuestions: [{ question: "how do you UPSELL?", asked: true, answer: "Bundles" }],
      contradictions: ["Says 3 years at Lakme, CV says 2"],
      followUpQuestions: ["Q1", "Q2"],
    }),
    ["How do you upsell?", "Why the gap in 2023?"]
  );
  assert.equal(parsed.recommendation, "Proceed");
  assert.deepEqual(parsed.standardQuestions.map((q) => q.key), STANDARD_INTERVIEW_QUESTIONS.map((q) => q.key));
  const by = Object.fromEntries(parsed.standardQuestions.map((q) => [q.key, q]));
  assert.deepEqual([by.travelToKhar.asked, by.expectedSalary.asked, by.leavingReason.asked, by.proudestAchievement.asked], [true, true, false, false]);
  assert.deepEqual(parsed.otherQuestions, [
    { question: "How do you upsell?", asked: true, answer: "Bundles" },
    { question: "Why the gap in 2023?", asked: false, answer: "" },
  ]);
  assert.deepEqual(analysisCoverage(parsed).asked, 2);
  assert.equal(analysisCoverage(parsed).notAsked.length, 9);

  // Items sent as objects are turned into readable text, never "[object Object]".
  const objects = parseInterviewAnalysisResponse(
    JSON.stringify({
      summary: "x",
      recommendation: "Hold",
      contradictions: [{ issue: "Expected salary", detail: "Said ₹40,000; application says ₹30,000" }, { n: 1 }, "Plain text"],
    }),
    []
  );
  assert.deepEqual(objects.contradictions, ["Expected salary — Said ₹40,000; application says ₹30,000", "Plain text"]);

  assert.throws(() => parseInterviewAnalysisResponse("nope", []), /unreadable/);
  assert.throws(() => parseInterviewAnalysisResponse(JSON.stringify({ summary: "x", recommendation: "Maybe" }), []), /missing/);
});

test("answers from the recording fill only blanks; HR's typed answers win", () => {
  const sheet: InterviewSheet = {
    answers: { noticePeriod: "15 days (typed)" },
    cvQuestions: [{ question: "Why the gap?", answer: "" }],
    roleQuestions: [],
    interviewer: "Rakesh",
    conductedOn: "2026-11-17",
    updatedAt: "",
  };
  const analysis = {
    standardQuestions: [
      { key: "noticePeriod" as const, question: "", asked: true, answer: "30 days" },
      { key: "travelToKhar" as const, question: "", asked: true, answer: "Train" },
      { key: "proudestAchievement" as const, question: "", asked: false, answer: "" },
    ],
    otherQuestions: [
      { question: "Why the gap?", asked: true, answer: "Family" },
      { question: "How do you upsell?", asked: true, answer: "Bundles" },
      { question: "Not asked", asked: false, answer: "" },
    ],
  };
  const merged = mergeAnalysisIntoSheet(sheet, analysis, ["How do you upsell?"], NOW);
  assert.equal(merged.answers.noticePeriod, "15 days (typed)");
  assert.equal(merged.answers.travelToKhar, "Train");
  assert.equal(merged.answers.proudestAchievement, undefined);
  assert.deepEqual(merged.cvQuestions, [{ question: "Why the gap?", answer: "Family" }]);
  assert.deepEqual(merged.roleQuestions, [{ question: "How do you upsell?", answer: "Bundles" }]);
  assert.equal(merged.interviewer, "Rakesh");
  assert.equal(sheet.answers.travelToKhar, undefined, "the original sheet is not changed");

  const fresh = mergeAnalysisIntoSheet(null, analysis, [], NOW);
  assert.equal(fresh.conductedOn, "2026-11-18");
  assert.equal(fresh.answers.noticePeriod, "30 days");
});
