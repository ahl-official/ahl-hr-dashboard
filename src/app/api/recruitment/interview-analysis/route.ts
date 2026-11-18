import { NextResponse } from "next/server";
import { getFmsCandidateById, updateFmsCandidateStore } from "@/lib/fms-candidates-store";
import { getFmsRequisitionsStore } from "@/lib/fms-requisitions-store";
import { getAllICPs } from "@/lib/hireos-sheets";
import { analyzeInterviewWithAI } from "@/lib/hireos-ai";
import { pickIcpForPosition, type CvScreeningReport } from "@/lib/cv-screening";
import { getInterviewSheet, interviewSheetUpdate } from "@/lib/interview-sheet";
import { kitLines, type PositionKitRecord } from "@/lib/position-kit";
import {
  MAX_STORED_TRANSCRIPT,
  MIN_TRANSCRIPT_CHARS,
  mergeAnalysisIntoSheet,
  type InterviewAnalysis,
} from "@/lib/interview-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

/**
 * Analyses a telephonic interview transcript, saves the report on the candidate and fills blank answers
 * in their interview sheet. JSON: candidateId, transcript, source, sourceName, consent, transcriptionModel.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const transcript = String(body.transcript || "").trim();
    if (body.consent !== true) return fail("Confirm that the candidate agreed to the call being recorded.");
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      return fail("The transcript is too short to analyse. Check that the recording has the conversation in it.");
    }
    const candidate = await getFmsCandidateById(String(body.candidateId || ""));
    if (!candidate) return fail("Candidate not found", 404);

    const [requisitions, kits] = await Promise.all([
      getFmsRequisitionsStore(),
      getAllICPs().catch(() => [] as PositionKitRecord[]),
    ]);
    const jobTitle = requisitions.find((r) => r.id === candidate.requisitionId)?.jobTitle;
    const kit = pickIcpForPosition(kits, candidate.position, jobTitle) as PositionKitRecord | null;

    const screening = (candidate.stageData?.ar?.cvScreening as CvScreeningReport) || null;
    const sheet = getInterviewSheet(candidate);
    const roleQuestions = [...new Set([...kitLines(kit?.kit?.interviewQuestions || ""), ...(sheet?.roleQuestions || []).map((q) => q.question)])];
    const cvQuestions = [...new Set([...(screening?.interviewQuestions || []), ...(sheet?.cvQuestions || []).map((q) => q.question)])];
    const extraQuestions = [...new Set([...roleQuestions, ...cvQuestions])];

    const result = await analyzeInterviewWithAI(transcript, {
      candidateName: candidate.fullName,
      position: candidate.position || jobTitle || "",
      screening,
      sheet,
      profile: { currentLocation: candidate.city, expectedSalary: candidate.expectedSalary, noticePeriod: candidate.noticePeriod },
      extraQuestions,
    });

    const now = new Date().toISOString();
    const source = ["upload", "link", "transcript"].includes(body.source) ? body.source : "transcript";
    const analysis: InterviewAnalysis = {
      ...result,
      source,
      sourceName: String(body.sourceName || "").slice(0, 200),
      consent: true,
      transcript: transcript.slice(0, MAX_STORED_TRANSCRIPT),
      transcriptTruncated: transcript.length > MAX_STORED_TRANSCRIPT,
      transcriptionModel: String(body.transcriptionModel || "").slice(0, 100),
      analyzedAt: now,
    };

    const filledSheet = mergeAnalysisIntoSheet(sheet, analysis, roleQuestions, now);
    const update = interviewSheetUpdate(candidate, filledSheet);
    const updated = await updateFmsCandidateStore(candidate.id, {
      ...update,
      stageData: {
        ...update.stageData,
        ps: { ...(update.stageData?.ps || {}), interviewAnalysis: analysis },
      },
    });
    return NextResponse.json({ success: true, data: { analysis, candidate: updated } });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/interview-analysis:", error);
    return fail(error?.message || "Interview analysis failed", 500);
  }
}
