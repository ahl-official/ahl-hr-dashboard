// Telephonic interview recording analysis (recruitment SOP, step 5). Pure: prompt, answer validation,
// merging extracted answers into the interview sheet, and recording-link handling. I/O lives in the routes.
import { STANDARD_INTERVIEW_QUESTIONS, type InterviewSheet, type StandardQuestionKey } from "./interview-sheet.ts";
import type { CvScreeningReport } from "./cv-screening.ts";

export const INTERVIEW_VERDICTS = ["Proceed", "Hold", "Reject"] as const;

/** Stored transcripts are capped so the candidate's Stage Data cell stays under Google Sheets' 50,000-character limit. */
export const MAX_STORED_TRANSCRIPT = 15000;
const MAX_PROMPT_TRANSCRIPT = 60000;
export const MIN_TRANSCRIPT_CHARS = 200;

export type QuestionCoverage = { question: string; asked: boolean; answer: string };

export type InterviewAnalysis = {
  summary: string;
  recommendation: (typeof INTERVIEW_VERDICTS)[number];
  recommendationReason: string;
  standardQuestions: Array<QuestionCoverage & { key: StandardQuestionKey }>;
  otherQuestions: QuestionCoverage[]; // role (Position Kit) and CV-screening questions
  strongAnswers: string[];
  weakAnswers: string[];
  missingInformation: string[];
  contradictions: string[];
  followUpQuestions: string[];
  source: "upload" | "link" | "transcript";
  sourceName: string;
  consent: boolean;
  transcript: string;
  transcriptTruncated: boolean;
  transcriptionModel: string;
  analyzedAt: string;
};

export type AnalysisContext = {
  candidateName: string;
  position: string;
  screening?: Pick<CvScreeningReport, "summary" | "relevantExperience" | "strengths" | "missingSkills" | "redFlags"> | null;
  sheet?: InterviewSheet | null;
  profile?: { currentLocation?: string; expectedSalary?: string; noticePeriod?: string };
  extraQuestions: string[];
};

/** Turns a Google Drive share link into a direct download URL the transcription service can fetch. */
export function recordingDownloadUrl(link: string): string | null {
  const text = link.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  const driveId =
    text.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ||
    text.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]{10,})/)?.[1] ||
    text.match(/drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([\w-]{10,})/)?.[1];
  if (driveId) return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
  if (/docs\.google\.com|drive\.google\.com\/drive\/folders/i.test(text)) return null; // folders and docs are not audio
  return text;
}

export function buildInterviewAnalysisMessages(transcript: string, ctx: AnalysisContext) {
  const standard = STANDARD_INTERVIEW_QUESTIONS.map((q) => `- ${q.key}: ${q.question}`).join("\n");
  const extra = ctx.extraQuestions.length ? ctx.extraQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") : "(none)";
  const typed = ctx.sheet
    ? STANDARD_INTERVIEW_QUESTIONS.filter((q) => ctx.sheet!.answers?.[q.key]?.trim())
        .map((q) => `- ${q.question} → ${ctx.sheet!.answers[q.key]}`)
        .join("\n")
    : "";
  const s = ctx.screening;
  const known = [
    s && `CV screening summary: ${s.summary}`,
    s?.relevantExperience && `Experience per CV: ${s.relevantExperience}`,
    s?.strengths?.length && `CV strengths: ${s.strengths.join("; ")}`,
    s?.redFlags?.length && `CV red flags: ${s.redFlags.join("; ")}`,
    ctx.profile?.currentLocation && `Location on application: ${ctx.profile.currentLocation}`,
    ctx.profile?.expectedSalary && `Expected salary on record: ${ctx.profile.expectedSalary}`,
    ctx.profile?.noticePeriod && `Notice period on record: ${ctx.profile.noticePeriod}`,
    typed && `Answers HR noted during the call:\n${typed}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "You review telephonic interview recordings for a hair, beauty and aesthetics company in Mumbai (salons in Khar West). " +
        "The transcript may mix Hindi and English and may label speakers (Speaker A/B); work out which speaker is the candidate. " +
        "Only report what was actually said. A standard question counts as asked only if the interviewer asked it or the candidate " +
        "clearly answered it; otherwise asked=false and answer=\"\". Keep answers short and factual, in English. " +
        "List contradictions between what the candidate said and what is already known (CV, application, earlier answers), and " +
        "within the call itself. Return ONLY a JSON object with keys: summary (2-3 sentences), recommendation (\"Proceed\" | " +
        "\"Hold\" | \"Reject\"), recommendationReason (string), standardQuestions (array of {key, asked, answer} for every key " +
        "listed), otherQuestions (array of {question, asked, answer} for every extra question listed, same wording), " +
        "strongAnswers, weakAnswers, missingInformation, contradictions, followUpQuestions (arrays of strings).",
    },
    {
      role: "user" as const,
      content:
        `CANDIDATE: ${ctx.candidateName}\nPOSITION: ${ctx.position || "Not specified"}\n\n` +
        `STANDARD QUESTIONS (key: question):\n${standard}\n\nEXTRA QUESTIONS:\n${extra}\n\n` +
        `ALREADY KNOWN:\n${known || "(nothing)"}\n\nTRANSCRIPT:\n${transcript.slice(0, MAX_PROMPT_TRANSCRIPT)}`,
    },
  ];
}

const strings = (v: unknown, max = 10): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max) : [];

/** Validates the model's JSON; throws when unusable so a broken answer is never saved. */
export function parseInterviewAnalysisResponse(content: string, extraQuestions: string[]) {
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("The AI returned an unreadable answer. Please try again.");
  }
  const recommendation = INTERVIEW_VERDICTS.find((v) => v.toLowerCase() === String(raw?.recommendation || "").trim().toLowerCase());
  const summary = String(raw?.summary || "").trim();
  if (!recommendation || !summary) throw new Error("The AI answer was missing the summary or recommendation. Please try again.");

  const byKey = new Map<string, any>((Array.isArray(raw?.standardQuestions) ? raw.standardQuestions : []).map((q: any) => [String(q?.key || ""), q]));
  const coverage = (q: any) => {
    const answer = String(q?.answer || "").trim();
    return { asked: q?.asked === true || (q?.asked !== false && Boolean(answer)), answer };
  };
  const others = Array.isArray(raw?.otherQuestions) ? raw.otherQuestions : [];

  return {
    summary,
    recommendation,
    recommendationReason: String(raw?.recommendationReason || "").trim(),
    // Every standard question is reported, in SOP order, even if the model skipped one.
    standardQuestions: STANDARD_INTERVIEW_QUESTIONS.map((q) => ({ key: q.key, question: q.question, ...coverage(byKey.get(q.key)) })),
    otherQuestions: extraQuestions.map((question) => {
      const match = others.find((o: any) => String(o?.question || "").trim().toLowerCase() === question.trim().toLowerCase());
      return { question, ...coverage(match) };
    }),
    strongAnswers: strings(raw?.strongAnswers),
    weakAnswers: strings(raw?.weakAnswers),
    missingInformation: strings(raw?.missingInformation),
    contradictions: strings(raw?.contradictions),
    followUpQuestions: strings(raw?.followUpQuestions, 8),
  };
}

/**
 * Fills the interview sheet from the recording: only blanks are filled, so what HR typed during the call wins.
 * Extra questions go to the role list when they came from the Position Kit, otherwise to the CV list.
 */
export function mergeAnalysisIntoSheet(
  sheet: InterviewSheet | null,
  analysis: Pick<InterviewAnalysis, "standardQuestions" | "otherQuestions">,
  roleQuestions: string[],
  now: string
): InterviewSheet {
  const base: InterviewSheet = sheet
    ? { ...sheet, answers: { ...sheet.answers }, cvQuestions: [...(sheet.cvQuestions || [])], roleQuestions: [...(sheet.roleQuestions || [])] }
    : { answers: {}, cvQuestions: [], roleQuestions: [], interviewer: "", conductedOn: now.slice(0, 10), updatedAt: now };

  for (const q of analysis.standardQuestions) {
    if (q.asked && q.answer && !(base.answers[q.key] || "").trim()) base.answers[q.key] = q.answer;
  }
  for (const q of analysis.otherQuestions) {
    if (!q.asked || !q.answer) continue;
    const isRole = roleQuestions.includes(q.question);
    const list = isRole ? base.roleQuestions! : base.cvQuestions;
    const existing = list.find((x) => x.question === q.question);
    if (!existing) list.push({ question: q.question, answer: q.answer });
    else if (!existing.answer.trim()) existing.answer = q.answer;
  }
  return { ...base, updatedAt: now };
}

export function analysisCoverage(analysis: Pick<InterviewAnalysis, "standardQuestions">) {
  const asked = analysis.standardQuestions.filter((q) => q.asked).length;
  return { asked, total: analysis.standardQuestions.length, notAsked: analysis.standardQuestions.filter((q) => !q.asked).map((q) => q.question) };
}
