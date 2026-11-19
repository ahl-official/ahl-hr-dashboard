// SOP compliance across all candidates: "Make sure every candidate follows the process. Do not skip CV screening,
// interviews, work verification or qualifying tests." Pure, so it is unit-tested and shared by the page and the PDF.
import type { FmsCandidate, FmsRequisition } from "../types/fms.ts";
import { FMS_CANDIDATE_STAGES } from "../types/fms.ts";
import { pickIcpForPosition } from "./cv-screening.ts";
import type { PositionKitRecord } from "./position-kit.ts";
import { evaluationChecklist, getHiringDecision, type ChecklistItem } from "./final-evaluation.ts";

export type ComplianceStatus = "Skipped steps" | "In progress" | "Complete" | "Dropped";

export type ComplianceRow = {
  candidateId: string;
  name: string;
  position: string;
  stage: string;
  kit: { roleName: string; approved: boolean } | null;
  checklist: ChecklistItem[];
  decision: string; // "", "Hire", "Hold", "Reject"
  status: ComplianceStatus;
  /** What was skipped, for candidates moved on without it. */
  skipped: string[];
};

const INTERVIEW_STAGE_INDEX = FMS_CANDIDATE_STAGES.findIndex((s) => s.id === "ps");

function stageIndex(stage: string): number {
  const name = (stage || "").toLowerCase();
  return Math.max(0, FMS_CANDIDATE_STAGES.findIndex((s) => s.name.toLowerCase() === name || s.id === name));
}

const isDropped = (c: FmsCandidate) => (c.status || "").toLowerCase() === "dropped" || Boolean(c.archived);

export function buildComplianceRows(candidates: FmsCandidate[], kits: PositionKitRecord[], requisitions: FmsRequisition[]): ComplianceRow[] {
  return candidates.map((c) => {
    const jobTitle = requisitions.find((r) => r.id === c.requisitionId)?.jobTitle;
    const kit = pickIcpForPosition(kits, c.position, jobTitle) as PositionKitRecord | null;
    const checklist = evaluationChecklist(c, kit?.kit);
    const decision = getHiringDecision(c)?.decision || "";

    // Past the interview stage (or hired) means every required step should already be done, with a Hire decision.
    const movedOn = stageIndex(c.currentStage) > INTERVIEW_STAGE_INDEX || (c.status || "").toLowerCase() === "hired";
    const gaps = checklist.filter((i) => i.required && !i.done).map((i) => i.label);
    const skipped = movedOn ? [...gaps, ...(decision === "Hire" ? [] : ["Hiring manager's Hire decision"])] : [];

    let status: ComplianceStatus;
    if (isDropped(c)) status = "Dropped";
    else if (skipped.length) status = "Skipped steps";
    else if (movedOn || (!gaps.length && decision === "Hire")) status = "Complete";
    else status = "In progress";

    return {
      candidateId: c.id,
      name: c.fullName,
      position: c.position || jobTitle || "",
      stage: c.currentStage,
      kit: kit ? { roleName: kit.roleName, approved: kit.approval === "Approved" } : null,
      checklist,
      decision,
      status,
      skipped,
    };
  });
}

/** Open positions recruiting without an approved Position Kit (SOP step 1: approve the ICP before recruiting). */
export function positionsWithoutApprovedKit(requisitions: FmsRequisition[], kits: PositionKitRecord[]): string[] {
  const titles = new Map<string, string>();
  for (const r of requisitions) {
    if ((r.status || "").toLowerCase() !== "open" || !r.jobTitle.trim()) continue;
    const kit = pickIcpForPosition(kits, r.jobTitle) as PositionKitRecord | null;
    const key = r.jobTitle.trim().toLowerCase();
    if ((!kit || kit.approval !== "Approved") && !titles.has(key)) titles.set(key, r.jobTitle.trim());
  }
  return [...titles.values()].sort((a, b) => a.localeCompare(b));
}

export function complianceSummary(rows: ComplianceRow[]) {
  const live = rows.filter((r) => r.status !== "Dropped");
  return {
    inPipeline: live.length,
    skipped: live.filter((r) => r.status === "Skipped steps").length,
    complete: live.filter((r) => r.status === "Complete").length,
    inProgress: live.filter((r) => r.status === "In progress").length,
    dropped: rows.length - live.length,
  };
}

/** Snapshot for the weekly/monthly PDF report (as of the day it is downloaded). */
export type ReportCompliance = {
  asOf: string;
  inPipeline: number;
  complete: number;
  inProgress: number;
  skipped: Array<{ name: string; position: string; stage: string; steps: string[] }>;
  positionsWithoutKit: string[];
};

export function buildReportCompliance(rows: ComplianceRow[], positionsWithoutKit: string[], asOf: string): ReportCompliance {
  const s = complianceSummary(rows);
  return {
    asOf,
    inPipeline: s.inPipeline,
    complete: s.complete,
    inProgress: s.inProgress,
    skipped: rows
      .filter((r) => r.status === "Skipped steps")
      .map((r) => ({ name: r.name, position: r.position, stage: r.stage, steps: r.skipped })),
    positionsWithoutKit,
  };
}
