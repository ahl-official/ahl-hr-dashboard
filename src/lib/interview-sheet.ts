// The telephonic interview script from the recruitment SOP (step 3): eight standard questions every candidate
// is asked, plus expected salary, notice period and joining date. Pure, so completeness is unit-tested.
import type { FmsCandidate } from "../types/fms.ts";

export const STANDARD_INTERVIEW_QUESTIONS = [
  { key: "leavingReason", question: "Why do you want to leave your current or last job?" },
  { key: "previousLeavingReason", question: "Why did you leave your previous job?" },
  { key: "takeHomeSalary", question: "What is your current monthly take-home salary?" },
  { key: "topStrengths", question: "What are your top three strengths?" },
  { key: "enjoyAndBestAt", question: "What work do you enjoy and what are you best at?" },
  { key: "proudestAchievement", question: "What is your proudest achievement?" },
  { key: "currentResidence", question: "Where do you currently stay?" },
  { key: "travelToKhar", question: "How will you manage travelling to Khar West every day?" },
  { key: "expectedSalary", question: "What is your expected salary?" },
  { key: "noticePeriod", question: "What is your notice period?" },
  { key: "joiningDate", question: "When can you join?" },
] as const;

export type StandardQuestionKey = (typeof STANDARD_INTERVIEW_QUESTIONS)[number]["key"];

export type InterviewSheet = {
  answers: Partial<Record<StandardQuestionKey, string>>;
  /** Questions from the AI CV screening, with what the candidate said. */
  cvQuestions: Array<{ question: string; answer: string }>;
  interviewer: string;
  conductedOn: string; // YYYY-MM-DD
  updatedAt: string;
};

export function getInterviewSheet(candidate: Pick<FmsCandidate, "stageData">): InterviewSheet | null {
  return (candidate.stageData?.ps?.interviewSheet as InterviewSheet) || null;
}

export function interviewSheetProgress(sheet: InterviewSheet | null) {
  const missing = STANDARD_INTERVIEW_QUESTIONS.filter((q) => !(sheet?.answers?.[q.key] || "").trim());
  const total = STANDARD_INTERVIEW_QUESTIONS.length;
  return { answered: total - missing.length, total, missing: missing.map((q) => q.question), complete: missing.length === 0 };
}

/**
 * The candidate update that saves an interview sheet. Expected salary and notice period also go to the
 * candidate's own fields, which fill the Confirmation Call columns of the Candidate FMS sheet.
 */
export function interviewSheetUpdate(candidate: Pick<FmsCandidate, "stageData">, sheet: InterviewSheet): Partial<FmsCandidate> {
  const update: Partial<FmsCandidate> = {
    stageData: {
      ...candidate.stageData,
      ps: { ...(candidate.stageData?.ps || {}), interviewSheet: sheet },
    },
  };
  const expected = (sheet.answers.expectedSalary || "").trim();
  const notice = (sheet.answers.noticePeriod || "").trim();
  if (expected) update.expectedSalary = expected;
  if (notice) update.noticePeriod = notice;
  return update;
}
