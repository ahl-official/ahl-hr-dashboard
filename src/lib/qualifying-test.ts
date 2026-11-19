// Qualifying test result per candidate (recruitment SOP, step 6). Which test a position takes lives in its
// Position Kit; this records how the candidate did. Pure, so the rules are unit-tested.
import type { FmsCandidate } from "../types/fms.ts";

export const TEST_STATUSES = ["Scheduled", "Completed", "No-show"] as const;
export const TEST_RESULTS = ["Pass", "Borderline", "Fail"] as const;

export type QualifyingTestResult = {
  testType: string;
  status: (typeof TEST_STATUSES)[number];
  scheduledOn: string; // YYYY-MM-DD
  completedOn: string; // YYYY-MM-DD
  evaluator: string;
  score: string;
  result: string; // one of TEST_RESULTS once completed
  feedback: string;
  evidenceLink: string;
  updatedAt: string;
};

export function getQualifyingTest(candidate: Pick<FmsCandidate, "stageData">): QualifyingTestResult | null {
  return (candidate.stageData?.ps?.qualifyingTest as QualifyingTestResult) || null;
}

/** Checks a result before saving. Returns an error message, or null when valid. */
export function validateQualifyingTest(t: Omit<QualifyingTestResult, "updatedAt">, todayIso: string): string | null {
  if (!TEST_STATUSES.includes(t.status)) return "Choose the test status.";
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (t.status === "Scheduled") {
    if (!date.test(t.scheduledOn)) return "Pick the date the test is scheduled for.";
    return null;
  }
  if (!date.test(t.completedOn)) return t.status === "No-show" ? "Pick the date they did not turn up." : "Pick the date the test was done.";
  if (t.completedOn > todayIso) return "That date is in the future.";
  if (t.status === "No-show") return null;
  if (!TEST_RESULTS.includes(t.result as (typeof TEST_RESULTS)[number])) return "Choose the result: Pass, Borderline or Fail.";
  if (!t.evaluator.trim()) return "Note who evaluated the test.";
  if (!t.feedback.trim()) return "Add the evaluator's feedback.";
  if (t.evidenceLink.trim() && !/^https?:\/\/\S+\.\S+/i.test(t.evidenceLink.trim())) return "The evidence link must be a web link.";
  return null;
}

/** Short label for cards: "Test: Pass", "Test: scheduled 20 Nov", "Test: no-show". */
export function qualifyingTestLabel(t: QualifyingTestResult | null): string {
  if (!t) return "Test: not done";
  if (t.status === "Scheduled") return `Test: scheduled ${t.scheduledOn}`;
  if (t.status === "No-show") return "Test: no-show";
  return `Test: ${t.result || "done"}`;
}

export function qualifyingTestUpdate(candidate: Pick<FmsCandidate, "stageData">, result: QualifyingTestResult): Partial<FmsCandidate> {
  return {
    stageData: {
      ...candidate.stageData,
      ps: { ...(candidate.stageData?.ps || {}), qualifyingTest: result },
    },
  };
}
