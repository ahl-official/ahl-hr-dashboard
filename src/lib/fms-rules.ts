import type { FmsCandidateStageId, FmsStageMeta } from "../types/fms.ts";
import { FMS_CANDIDATE_STAGES } from "../types/fms.ts";

/**
 * Calculates days of delay between planned date and actual (or today if incomplete).
 * Positive number = Delayed by N days.
 * 0 or negative = On time or ahead of schedule.
 */
export function calculateFmsDelay(plannedDateStr?: string, actualDateStr?: string): number {
  if (!plannedDateStr) return 0;
  const planned = new Date(plannedDateStr);
  if (isNaN(planned.getTime())) return 0;

  const compareDate = actualDateStr ? new Date(actualDateStr) : new Date();
  if (isNaN(compareDate.getTime())) return 0;

  // Truncate to day boundaries in UTC
  const plannedMs = Date.UTC(planned.getUTCFullYear(), planned.getUTCMonth(), planned.getUTCDate());
  const compareMs = Date.UTC(compareDate.getUTCFullYear(), compareDate.getUTCMonth(), compareDate.getUTCDate());

  const diffDays = Math.round((compareMs - plannedMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determines stage status based on dates and completed checklist items.
 */
export function computeStageStatus(
  plannedDateStr?: string,
  actualDateStr?: string,
  checklistState?: Record<string, boolean>,
  totalChecklistCount = 0
): "Pending" | "In Progress" | "Completed" | "Overdue" {
  if (actualDateStr) return "Completed";

  const checkedCount = checklistState
    ? Object.values(checklistState).filter(Boolean).length
    : 0;

  if (checkedCount > 0 && checkedCount === totalChecklistCount && totalChecklistCount > 0) {
    return "Completed";
  }

  if (plannedDateStr) {
    const planned = new Date(plannedDateStr);
    const today = new Date();
    if (!isNaN(planned.getTime()) && planned.getTime() < today.setHours(0, 0, 0, 0)) {
      return "Overdue";
    }
  }

  return checkedCount > 0 ? "In Progress" : "Pending";
}

/**
 * Calculates planned date for next candidate stage using stage duration SLA.
 */
export function getNextStagePlannedDate(currentDate: Date, stageWeeks: number): string {
  const days = Math.round(stageWeeks * 7);
  const target = new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

/**
 * Normalizes phone number to clean 10-digit or wa.me format.
 */
export function normalizeFmsPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

/**
 * Generates an FMS candidate ID (e.g. CAND-0042).
 */
export function formatCandidateId(num: number): string {
  return `CAND-${String(num).padStart(4, "0")}`;
}

/**
 * Generates an FMS requisition ID (e.g. REQ-2026-009).
 */
export function formatRequisitionId(year: number, num: number): string {
  return `REQ-${year}-${String(num).padStart(3, "0")}`;
}
