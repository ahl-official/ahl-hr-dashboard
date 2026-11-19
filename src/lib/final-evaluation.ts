// Final evaluation and hiring decision (recruitment SOP, step 7). The checklist of SOP steps is computed
// here without AI; the AI only writes the consolidated report. Pure, so the rules are unit-tested.
import type { FmsCandidate } from "../types/fms.ts";
import type { CvScreeningReport } from "./cv-screening.ts";
import { getInterviewSheet, interviewSheetProgress } from "./interview-sheet.ts";
import { analysisCoverage, type InterviewAnalysis } from "./interview-analysis.ts";
import { contributionSummary, getWorkSamples, MIN_SAMPLES, samplesRequired } from "./work-samples.ts";
import { getQualifyingTest } from "./qualifying-test.ts";
import type { PositionKit } from "./position-kit.ts";

export const HIRING_DECISIONS = ["Hire", "Hold", "Reject"] as const;
export type HiringDecisionValue = (typeof HIRING_DECISIONS)[number];

export type FinalReport = {
  cvMatch: string;
  interviewPerformance: string;
  portfolio: string;
  testResults: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  recommendation: HiringDecisionValue;
  recommendationReason: string;
  missingSteps: string[]; // SOP steps not done when the report was written
  generatedAt: string;
};

export type HiringDecision = {
  decision: HiringDecisionValue;
  decidedBy: string;
  reason: string;
  decidedAt: string;
};

export type ChecklistItem = { key: string; label: string; required: boolean; done: boolean; detail: string };

const cvScreening = (c: Pick<FmsCandidate, "stageData">) => (c.stageData?.ar?.cvScreening as CvScreeningReport) || null;
const interviewAnalysis = (c: Pick<FmsCandidate, "stageData">) => (c.stageData?.ps?.interviewAnalysis as InterviewAnalysis) || null;
export const getFinalReport = (c: Pick<FmsCandidate, "stageData">) => (c.stageData?.ps?.finalReport as FinalReport) || null;
export const getHiringDecision = (c: Pick<FmsCandidate, "stageData">) => (c.stageData?.ps?.hiringDecision as HiringDecision) || null;

/** Which SOP steps this candidate has been through. Samples and the test count only where the kit asks for them. */
export function evaluationChecklist(candidate: Pick<FmsCandidate, "stageData">, kit: PositionKit | null | undefined): ChecklistItem[] {
  const screening = cvScreening(candidate);
  const sheet = interviewSheetProgress(getInterviewSheet(candidate));
  const analysis = interviewAnalysis(candidate);
  const samples = getWorkSamples(candidate);
  const needSamples = samplesRequired(kit);
  const test = getQualifyingTest(candidate);
  const hasTest = Boolean(kit?.qualifyingTest);
  const testPassed = test?.status === "Completed" && (test.result === "Pass" || test.result === "Borderline");

  return [
    { key: "cv", label: "CV screened by AI", required: true, done: Boolean(screening), detail: screening ? `${screening.matchScore}% · ${screening.verdict}` : "Not screened" },
    { key: "questions", label: "Standard interview questions", required: true, done: sheet.complete, detail: `${sheet.answered}/${sheet.total} answered` },
    { key: "recording", label: "Interview recording analysed", required: true, done: Boolean(analysis), detail: analysis ? `${analysis.recommendation} · ${analysisCoverage(analysis).asked}/11 asked` : "Not analysed" },
    { key: "samples", label: "Work samples", required: needSamples, done: samples.length >= (needSamples ? MIN_SAMPLES : 0), detail: `${samples.length} collected${needSamples ? `, ${MIN_SAMPLES} needed` : ""}` },
    {
      key: "test",
      label: "Qualifying test passed",
      required: hasTest,
      done: !hasTest || testPassed,
      detail: test ? (test.status === "Completed" ? `${test.result}${test.score ? ` · ${test.score}` : ""}` : test.status) : hasTest ? "Not taken" : "No test in the Position Kit",
    },
  ];
}

export const missingSteps = (items: ChecklistItem[]) => items.filter((i) => i.required && !i.done).map((i) => i.label);

/** Checks a hiring decision. Hire needs every required SOP step done; Hold and Reject are always allowed. */
export function validateHiringDecision(d: Pick<HiringDecision, "decision" | "decidedBy" | "reason">, items: ChecklistItem[]): string | null {
  if (!HIRING_DECISIONS.includes(d.decision)) return "Choose Hire, Hold or Reject.";
  if (!d.decidedBy.trim()) return "Enter the hiring manager's name.";
  if (!d.reason.trim()) return "Give the reason for the decision.";
  const missing = missingSteps(items);
  if (d.decision === "Hire" && missing.length) return `Hire needs every SOP step first. Still missing: ${missing.join(", ")}.`;
  return null;
}

/** Everything on record about the candidate, as text for the AI. */
export function buildFinalReportMessages(candidate: FmsCandidate, kitRoleName: string, kit: PositionKit | null | undefined, items: ChecklistItem[]) {
  const screening = cvScreening(candidate);
  const sheet = getInterviewSheet(candidate);
  const analysis = interviewAnalysis(candidate);
  const samples = getWorkSamples(candidate);
  const test = getQualifyingTest(candidate);
  const missing = missingSteps(items);

  const sections = [
    kit && `POSITION KIT (${kitRoleName}):\nNon-negotiables: ${kit.nonNegotiables || "-"}\nRed flags: ${kit.redFlags || "-"}\nRejection criteria: ${kit.rejectionCriteria || "-"}\nSalary range: ${kit.salaryRange || "-"}`,
    screening &&
      `CV SCREENING: ${screening.matchScore}% match, verdict ${screening.verdict}. ${screening.summary}\nStrengths: ${screening.strengths.join("; ")}\nMissing skills: ${screening.missingSkills.join("; ")}\nRed flags: ${screening.redFlags.join("; ")}`,
    sheet &&
      `INTERVIEW ANSWERS:\n${Object.entries(sheet.answers)
        .filter(([, v]) => String(v || "").trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}\n${[...(sheet.roleQuestions || []), ...sheet.cvQuestions].filter((q) => q.answer.trim()).map((q) => `- ${q.question} → ${q.answer}`).join("\n")}`,
    analysis &&
      `INTERVIEW RECORDING ANALYSIS: ${analysis.recommendation}. ${analysis.summary}\nStrong answers: ${analysis.strongAnswers.join("; ")}\nWeak answers: ${analysis.weakAnswers.join("; ")}\nContradictions: ${analysis.contradictions.join("; ")}\nMissing information: ${analysis.missingInformation.join("; ")}`,
    samples.length &&
      `WORK SAMPLES:\n${samples.map((s) => `- ${s.title} [${s.verdict}]: ${contributionSummary(s.contribution)}. Their account: ${s.candidateRole}${s.hrNotes ? ` HR: ${s.hrNotes}` : ""}`).join("\n")}`,
    test &&
      `QUALIFYING TEST (${test.testType || "test"}): ${test.status}${test.status === "Completed" ? `, ${test.result}, score ${test.score || "-"}, evaluated by ${test.evaluator}. Feedback: ${test.feedback}` : ""}`,
    `SOP STEPS NOT DONE: ${missing.length ? missing.join(", ") : "none"}`,
  ].filter(Boolean);

  return [
    {
      role: "system" as const,
      content:
        "You write the final evaluation of a job candidate for the hiring manager of a hair, beauty and aesthetics company in Mumbai. " +
        "Use only the evidence given; where a section has no evidence, say \"Not assessed\" and treat that as a gap, not a positive. " +
        "Apply the Position Kit's non-negotiables and rejection criteria as hard rules. Never recommend Hire while SOP steps are " +
        "missing. Return ONLY a JSON object with keys: cvMatch, interviewPerformance, portfolio, testResults (each 1-3 sentences), " +
        "strengths, weaknesses, redFlags (arrays of plain-text strings), recommendation (\"Hire\" | \"Hold\" | \"Reject\"), " +
        "recommendationReason (2-3 sentences).",
    },
    {
      role: "user" as const,
      content: `CANDIDATE: ${candidate.fullName}\nPOSITION: ${candidate.position || kitRoleName || "Not specified"}\n\n${sections.join("\n\n")}`,
    },
  ];
}

const itemText = (x: unknown): string =>
  x && typeof x === "object"
    ? Object.values(x as Record<string, unknown>).filter((v) => typeof v === "string" && v.trim()).map((v) => (v as string).trim()).join(" — ")
    : String(x ?? "").trim();
const strings = (v: unknown) => (Array.isArray(v) ? v.map(itemText).filter(Boolean).slice(0, 10) : []);

/**
 * Validates the AI's report. A Hire recommendation while steps are missing is downgraded to Hold, so the
 * report can never contradict the process rule the decision enforces.
 */
export function parseFinalReport(content: string, missing: string[], now: string): FinalReport {
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("The AI returned an unreadable answer. Please try again.");
  }
  let recommendation = HIRING_DECISIONS.find((d) => d.toLowerCase() === String(raw?.recommendation || "").trim().toLowerCase());
  const reason = String(raw?.recommendationReason || "").trim();
  if (!recommendation || !reason) throw new Error("The AI answer was missing the recommendation. Please try again.");
  let recommendationReason = reason;
  if (recommendation === "Hire" && missing.length) {
    recommendation = "Hold";
    recommendationReason = `${reason} (Changed from Hire to Hold: ${missing.join(", ")} not done yet.)`;
  }
  const text = (v: unknown) => String(v ?? "").trim() || "Not assessed";
  return {
    cvMatch: text(raw?.cvMatch),
    interviewPerformance: text(raw?.interviewPerformance),
    portfolio: text(raw?.portfolio),
    testResults: text(raw?.testResults),
    strengths: strings(raw?.strengths),
    weaknesses: strings(raw?.weaknesses),
    redFlags: strings(raw?.redFlags),
    recommendation,
    recommendationReason,
    missingSteps: missing,
    generatedAt: now,
  };
}

/** Everything that should make HR pause before moving a candidate past the interview stage. */
export function advanceWarnings(candidate: Pick<FmsCandidate, "stageData">, kit: PositionKit | null | undefined): string[] {
  const warnings = evaluationChecklist(candidate, kit)
    .filter((i) => i.required && !i.done)
    .map((i) => `${i.label}: ${i.detail}`);
  const decision = getHiringDecision(candidate);
  if (!decision) warnings.push("No hiring manager decision yet");
  else if (decision.decision !== "Hire") warnings.push(`Hiring manager decided: ${decision.decision}`);
  return warnings;
}
