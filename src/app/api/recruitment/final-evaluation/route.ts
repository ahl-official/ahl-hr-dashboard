import { NextResponse } from "next/server";
import { dropCandidateStore, getFmsCandidateById, updateFmsCandidateStore } from "@/lib/fms-candidates-store";
import { getFmsRequisitionsStore } from "@/lib/fms-requisitions-store";
import { getAllICPs } from "@/lib/hireos-sheets";
import { generateFinalReportWithAI } from "@/lib/hireos-ai";
import { pickIcpForPosition } from "@/lib/cv-screening";
import type { PositionKitRecord } from "@/lib/position-kit";
import type { FmsCandidate } from "@/types/fms";
import {
  buildFinalReportMessages,
  evaluationChecklist,
  missingSteps,
  validateHiringDecision,
  type HiringDecision,
  type HiringDecisionValue,
} from "@/lib/final-evaluation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

const saveToInterviewStage = (candidate: FmsCandidate, key: string, value: unknown) =>
  updateFmsCandidateStore(candidate.id, {
    stageData: { ...candidate.stageData, ps: { ...(candidate.stageData?.ps || {}), [key]: value } },
  });

/**
 * SOP step 7. { action: "report", candidateId } writes the consolidated AI report;
 * { action: "decide", candidateId, decision, decidedBy, reason } records the hiring manager's decision
 * (Hire only once every required SOP step is done; Reject also drops the candidate).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const candidate = await getFmsCandidateById(String(body.candidateId || ""));
    if (!candidate) return fail("Candidate not found", 404);

    const [requisitions, kits] = await Promise.all([
      getFmsRequisitionsStore(),
      getAllICPs().catch(() => [] as PositionKitRecord[]),
    ]);
    const requisition = requisitions.find((r) => r.id === candidate.requisitionId);
    const kit = pickIcpForPosition(kits, candidate.position, requisition?.jobTitle) as PositionKitRecord | null;
    const items = evaluationChecklist(candidate, kit?.kit);

    if (body.action === "report") {
      const missing = missingSteps(items);
      const report = await generateFinalReportWithAI(buildFinalReportMessages(candidate, kit?.roleName || "", kit?.kit, items), missing);
      const updated = await saveToInterviewStage(candidate, "finalReport", report);
      return NextResponse.json({ success: true, data: { report, candidate: updated } });
    }

    if (body.action === "decide") {
      const input = {
        decision: String(body.decision || "") as HiringDecisionValue,
        decidedBy: String(body.decidedBy || "").trim(),
        reason: String(body.reason || "").trim(),
      };
      const problem = validateHiringDecision(input, items);
      if (problem) return fail(problem);
      const decision: HiringDecision = { ...input, decidedAt: new Date().toISOString() };
      let updated = await saveToInterviewStage(candidate, "hiringDecision", decision);
      if (decision.decision === "Reject") {
        updated = await dropCandidateStore(candidate.id, `Rejected by ${decision.decidedBy}: ${decision.reason}`.slice(0, 500));
      }
      return NextResponse.json({ success: true, data: { decision, candidate: updated } });
    }

    return fail("Unknown action");
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/final-evaluation:", error);
    return fail(error?.message || "Final evaluation failed", 500);
  }
}
