// Single source of truth for the "Candidate FMS" tab layout.
// Stage blocks follow the Recruitment-to-Exit FMS pattern:
//   <Stage> Planned | <Stage> Actual | <Stage> Status | <stage fields…> | <Stage> Time Delay (Days)
// The delay cell is human-readable ("3 days late", "2 days overdue", "On time") and is
// highlighted yellow by scripts/format-candidate-fms.mjs whenever it is not on time.
// Stage fields are derived from FMS_CANDIDATE_STAGES, so the sheet always matches the web app.
// Kept free of server-only imports so scripts/migrate-candidate-fms.mjs can reuse it.

import { FMS_CANDIDATE_STAGES } from "../types/fms.ts";
import type { FmsCandidate, FmsCandidateStageTracking } from "../types/fms.ts";

export const CANDIDATE_FMS_TAB = "Candidate FMS";

type ProfileProp =
  | "id" | "fmsId" | "fullName" | "phone" | "email" | "position" | "requisitionId" | "brand"
  | "source" | "city" | "area" | "currentStage" | "status" | "notes"
  | "interviewStatus" | "archived" | "archiveReason" | "droppedDate" | "createdAt" | "updatedAt";

export type CandidateFmsColumn =
  | { kind: "profile"; header: string; prop: ProfileProp; group: "profile" | "system"; aliases?: string[]; date?: boolean }
  | { kind: "stage"; header: string; stage: string; part: "plannedDate" | "actualDate" | "status" | "delayDays"; aliases?: string[]; date?: boolean }
  | { kind: "field"; header: string; stage: string; key: string; aliases?: string[]; date?: boolean }
  | { kind: "json"; header: string; aliases?: string[]; date?: false };

// Cleaner sheet headers for web-app field labels that read poorly as column names.
const FIELD_HEADERS: Record<string, string> = {
  initialNotes: "Initial Notes",
  screeningNotes: "Interview Notes",
  callDate: "Call Date",
  noticePeriod: "Notice Period",
  salaryExpected: "Expected Salary",
  callNotes: "Call Notes",
  offerDate: "Offer Letter Date",
  joiningDate: "Confirmed Joining Date",
  offeredSalary: "Offered Salary",
  uniformDetails: "Uniform Details",
  joiningNotes: "Joining Notes",
  aadharCardNumber: "Aadhar Number",
  empId: "Employee ID",
  mentorName: "Mentor Name",
  onboardingNotes: "Onboarding Notes",
};

// Old headers (pre-2026-11-02 layout) so legacy rows and the offline fallback still parse.
const FIELD_ALIASES: Record<string, string[]> = {
  screeningNotes: ["Pre-Screening Notes"],
  rescheduledDate: ["Interview Rescheduled Date"],
  callNotes: ["Confirmation Call Notes"],
  aadharCardNumber: ["Aadhar Card Number"],
  empId: ["Assigned Employee ID"],
};
const STAGE_ALIASES: Record<string, string[]> = { ps: ["Pre-Screening"] };

// Web-app fields already stored elsewhere in the row.
const SKIPPED_FIELDS = new Set(["sourceChannel"]);

// Stages whose outcome field (e.g. Application Status) replaces the generic Pending/Completed
// Status column; that status is derived from Current Stage and Overall Status instead.
const OUTCOME_STATUS_STAGES = new Set(["ar"]);

// Stage fields that the web app also keeps on the candidate itself.
const TOP_LEVEL_MIRRORS: Record<string, string> = {
  "ar.applicationStatus": "applicationStatus",
  "ps.interviewUpdateStatus": "interviewUpdateStatus",
  "ps.rescheduledDate": "rescheduledDate",
  "ps.rescheduledStatus": "rescheduledStatus",
  "cc.noticePeriod": "noticePeriod",
  "cc.salaryExpected": "expectedSalary",
  "doc.dateOfBirth": "dob",
  "doc.gender": "gender",
};

function buildColumns(): CandidateFmsColumn[] {
  const cols: CandidateFmsColumn[] = [
    { kind: "profile", group: "profile", header: "Candidate ID", prop: "id", aliases: ["ID"] },
    { kind: "profile", group: "profile", header: "FMS ID", prop: "fmsId" },
    { kind: "profile", group: "profile", header: "Full Name", prop: "fullName", aliases: ["Name"] },
    { kind: "profile", group: "profile", header: "Phone", prop: "phone", aliases: ["Mobile", "WhatsApp"] },
    { kind: "profile", group: "profile", header: "Email", prop: "email", aliases: ["Personal E-mail ID"] },
    { kind: "profile", group: "profile", header: "Position Applied For", prop: "position", aliases: ["Position"] },
    { kind: "profile", group: "profile", header: "Requisition ID", prop: "requisitionId" },
    { kind: "profile", group: "profile", header: "Brand", prop: "brand" },
    { kind: "profile", group: "profile", header: "Source", prop: "source" },
    { kind: "profile", group: "profile", header: "Current Location", prop: "city" },
    { kind: "profile", group: "profile", header: "Preferred Location", prop: "area" },
    { kind: "profile", group: "profile", header: "Current Stage", prop: "currentStage" },
    { kind: "profile", group: "profile", header: "Overall Status", prop: "status", aliases: ["Status"] },
    { kind: "profile", group: "profile", header: "Notes", prop: "notes" },
  ];

  for (const stage of FMS_CANDIDATE_STAGES) {
    const names = [stage.name, ...(STAGE_ALIASES[stage.id] || [])];
    const stageCol = (suffix: string, part: "plannedDate" | "actualDate" | "status" | "delayDays", date = false, oldSuffix = suffix): CandidateFmsColumn => ({
      kind: "stage",
      stage: stage.id,
      part,
      date,
      header: `${stage.name} ${suffix}`,
      aliases: names.map((n) => `${n} ${oldSuffix}`),
    });

    cols.push(stageCol("Planned", "plannedDate", true), stageCol("Actual", "actualDate", true));
    // Where HR records the stage outcome in its own field, that field is the stage's status column.
    if (!OUTCOME_STATUS_STAGES.has(stage.id)) cols.push(stageCol("Status", "status"));
    for (const field of stage.fields) {
      if (SKIPPED_FIELDS.has(field.key)) continue;
      cols.push({
        kind: "field",
        stage: stage.id,
        key: field.key,
        header: FIELD_HEADERS[field.key] || field.label,
        aliases: FIELD_ALIASES[field.key],
        date: field.type === "date",
      });
    }
    cols.push(stageCol("Time Delay (Days)", "delayDays", false, "Delay"));
  }

  cols.push(
    { kind: "profile", group: "system", header: "Interview Tracking Status", prop: "interviewStatus", aliases: ["Interview Status"] },
    { kind: "profile", group: "system", header: "Archived", prop: "archived" },
    { kind: "profile", group: "system", header: "Archive Reason", prop: "archiveReason" },
    { kind: "json", header: "Stage Data (JSON)", aliases: ["StageDataJSON", "Stage Data"] },
    { kind: "profile", group: "system", header: "Created Date", prop: "createdAt", aliases: ["Created At", "Timestamp"], date: true },
    { kind: "profile", group: "system", header: "Updated Date", prop: "updatedAt", aliases: ["Updated At"], date: true },
    // Last column so older deployments, which write rows by position, never overwrite it.
    { kind: "profile", group: "system", header: "Dropped Date", prop: "droppedDate", date: true },
  );

  const seen = new Set<string>();
  for (const c of cols) {
    if (seen.has(normalizeKey(c.header))) throw new Error(`Duplicate Candidate FMS header: ${c.header}`);
    seen.add(normalizeKey(c.header));
  }
  return cols;
}

export const CANDIDATE_FMS_COLUMNS = buildColumns();
export const CANDIDATE_FMS_HEADERS = CANDIDATE_FMS_COLUMNS.map((c) => c.header);

const FIELD_KEYS_BY_STAGE: Record<string, string[]> = {};
for (const c of CANDIDATE_FMS_COLUMNS) {
  if (c.kind === "field") (FIELD_KEYS_BY_STAGE[c.stage] ||= []).push(c.key);
}

// ── helpers ─────────────────────────────────────────────

export function normalizeKey(value: unknown): string {
  return clean(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
}

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

// Sheets returns dates as serial numbers with UNFORMATTED_VALUE; the app works in YYYY-MM-DD.
function toIsoDate(value: unknown): string {
  if (typeof value === "number" && value > 20000 && value < 80000) {
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  return clean(value);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10));
  const to = Date.parse(toIso.slice(0, 10));
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86400000));
}

/** Delay text for the sheet: late when completed after plan, overdue when still open past plan. */
export function formatDelayText(planned: string, actual: string, today: string): string {
  if (!planned) return "";
  const days = daysBetween(planned, actual || today);
  if (days <= 0) return actual ? "On time" : "On track";
  return `${days} ${days === 1 ? "day" : "days"} ${actual ? "late" : "overdue"}`;
}

/** Delay text for a dropped candidate's stage: frozen at the drop date instead of counting on. */
export function formatDroppedDelayText(planned: string, droppedDate: string): string {
  const days = planned && droppedDate ? daysBetween(planned, droppedDate) : 0;
  return days > 0 ? `Dropped – ${days} ${days === 1 ? "day" : "days"} overdue` : "Dropped";
}

/** Reads a delay cell — accepts "3 days late", "Dropped – 3 days overdue" and legacy plain numbers. */
export function parseDelayDays(value: unknown): number {
  const match = clean(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/** Dropping stops the candidate's pipeline; restoring clears both flags. */
export function isCandidateDropped(cand: Partial<FmsCandidate>): boolean {
  return clean(cand.status).toLowerCase() === "dropped" || Boolean(cand.archived);
}

const STAGE_INDEX: Record<string, number> = Object.fromEntries(FMS_CANDIDATE_STAGES.map((s, i) => [s.id, i]));

function currentStageIndex(cand: Partial<FmsCandidate>): number {
  const name = clean(cand.currentStage).toLowerCase();
  const i = FMS_CANDIDATE_STAGES.findIndex((s) => s.name.toLowerCase() === name || s.id === name);
  return Math.max(0, i);
}

function emptyStage(): FmsCandidateStageTracking {
  return { status: "Pending", checklistState: {}, fieldValues: {} };
}

// ── row → candidate ─────────────────────────────────────

/** Builds a header → column-index lookup that understands current headers and legacy aliases. */
export function candidateFmsIndex(headerRow: unknown[]): Map<CandidateFmsColumn, number> {
  const byKey = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const k = normalizeKey(h);
    if (k && !byKey.has(k)) byKey.set(k, i);
  });
  const index = new Map<CandidateFmsColumn, number>();
  for (const col of CANDIDATE_FMS_COLUMNS) {
    for (const name of [col.header, ...(col.aliases || [])]) {
      const i = byKey.get(normalizeKey(name));
      if (i !== undefined) {
        index.set(col, i);
        break;
      }
    }
  }
  return index;
}

/** Parses one sheet row into the candidate shape the web app uses. Profile fields not in the sheet are left unset. */
export function rowToCandidateFields(row: unknown[], index: Map<CandidateFmsColumn, number>): Partial<FmsCandidate> {
  const cand: Record<string, any> = { personalDetails: {}, stages: {}, stageData: {} };
  const value = (col: CandidateFmsColumn) => {
    const i = index.get(col);
    if (i === undefined) return "";
    return col.date ? toIsoDate(row[i]) : clean(row[i]);
  };

  const jsonCol = CANDIDATE_FMS_COLUMNS.find((c) => c.kind === "json")!;
  try {
    const parsed = JSON.parse(value(jsonCol) || "{}");
    if (parsed && typeof parsed === "object") cand.stageData = parsed;
  } catch {
    // ignore malformed JSON
  }

  for (const stage of FMS_CANDIDATE_STAGES) {
    const data = cand.stageData[stage.id] || {};
    cand.stages[stage.id] = {
      ...emptyStage(),
      checklistState: data.checklistState || data.checklist || {},
      fieldValues: { ...(data.fieldValues || {}) },
    };
  }

  for (const col of CANDIDATE_FMS_COLUMNS) {
    if (!index.has(col)) continue;
    const v = value(col);
    if (col.kind === "profile") {
      if (col.prop === "archived") cand.archived = v.toLowerCase() === "true";
      else if (v) cand[col.prop] = v;
    } else if (col.kind === "stage") {
      const st = cand.stages[col.stage];
      if (col.part === "delayDays") st.delayDays = parseDelayDays(v);
      else if (col.part === "status") st.status = v || "Pending";
      else st[col.part] = v;
    } else if (col.kind === "field" && v) {
      cand.stages[col.stage].fieldValues[col.key] = v;
      cand.stageData[col.stage] = { ...(cand.stageData[col.stage] || {}), [col.key]: v };
      const mirror = TOP_LEVEL_MIRRORS[`${col.stage}.${col.key}`];
      if (mirror) cand[mirror] = v;
      if (col.stage === "doc") cand.personalDetails[col.key] = v;
    }
  }

  if (cand.email) cand.personalDetails.personalEmail = cand.email;
  const dropped = isCandidateDropped(cand);
  // Rows dropped before the Dropped Date column existed: the last update is when it happened.
  if (dropped && !cand.droppedDate && cand.updatedAt) cand.droppedDate = String(cand.updatedAt).slice(0, 10);

  // Stages without a Status column take it from where the candidate is.
  const currentIdx = currentStageIndex(cand);
  for (const stage of FMS_CANDIDATE_STAGES) {
    const hasColumn = [...index.keys()].some((c) => c.kind === "stage" && c.stage === stage.id && c.part === "status");
    if (hasColumn) continue;
    const idx = STAGE_INDEX[stage.id];
    cand.stages[stage.id].status =
      idx < currentIdx ? "Completed" : idx > currentIdx ? "Pending" : dropped ? "Dropped" : "In Progress";
  }
  return cand as Partial<FmsCandidate>;
}

// ── candidate → row ─────────────────────────────────────

function fieldCandidates(cand: Partial<FmsCandidate>, stage: string, key: string): unknown[] {
  const mirror = TOP_LEVEL_MIRRORS[`${stage}.${key}`];
  return [
    mirror ? (cand as any)[mirror] : undefined,
    cand.stages?.[stage]?.fieldValues?.[key],
    cand.stageData?.[stage]?.[key],
    stage === "doc" ? (cand.personalDetails as any)?.[key] : undefined,
  ];
}

/** A stage field's value; when `original` is given, the copy that differs from it wins. */
function resolveField(cand: Partial<FmsCandidate>, stage: string, key: string, original?: Partial<FmsCandidate>): string {
  const values = fieldCandidates(cand, stage, key).map(clean);
  const before = original ? resolveField(original, stage, key) : "";
  const changed = values.find((v) => v !== "" && v !== before);
  return changed ?? (values.find((v) => v !== "") || "");
}

// Status fields per stage. Changing one to an outcome stamps that stage's Actual date.
const STATUS_FIELDS: Record<string, string[]> = {
  ar: ["applicationStatus"],
  ps: ["interviewUpdateStatus", "rescheduledStatus"],
};
const OPEN_STATUSES = new Set(["", "Under Review", "Pending"]);

/**
 * Stamps Actual dates when a candidate's status changes, comparing against `prev` (the saved row):
 * - a status field of the stage they are in changes to an outcome → that stage's Actual = today
 * - dropped → current stage reads Dropped with Actual = Dropped Date
 * - restored → current stage back to In Progress, the drop's Actual date removed
 * Stages already behind the candidate are never touched.
 */
export function applyStatusDates<T extends Partial<FmsCandidate>>(next: T, prev: Partial<FmsCandidate> | undefined, today: string): T {
  if (!prev) return next;
  const c: T = { ...next, stages: { ...(next.stages || {}) } };
  const stages = c.stages as Record<string, FmsCandidateStageTracking>;
  const setStage = (id: string, patch: Partial<FmsCandidateStageTracking>) => {
    stages[id] = { ...emptyStage(), ...stages[id], ...patch };
  };
  const currentId = FMS_CANDIDATE_STAGES[currentStageIndex(c)].id;

  const statusChanged = (STATUS_FIELDS[currentId] || []).some((key) => {
    const now = resolveField(c, currentId, key, prev);
    return now !== resolveField(prev, currentId, key) && !OPEN_STATUSES.has(now);
  });
  if (statusChanged) setStage(currentId, { actualDate: today });

  const wasDropped = isCandidateDropped(prev);
  const isDropped = isCandidateDropped(c);
  if (isDropped && !wasDropped) {
    c.droppedDate = clean(c.droppedDate) || today;
    setStage(currentId, { status: "Dropped", actualDate: c.droppedDate });
  } else if (!isDropped && wasDropped) {
    const stampedByDrop = clean(stages[currentId]?.actualDate) === clean(prev.droppedDate);
    setStage(currentId, { status: "In Progress" });
    if (stampedByDrop) delete stages[currentId].actualDate;
    c.droppedDate = "";
  }
  return c;
}

/**
 * Serialises a candidate into a row in CANDIDATE_FMS_HEADERS order.
 * A stage field can live in several places on the candidate (top-level, fieldValues, stageData);
 * when `original` (the row as last read from the sheet) is given, the copy that changed wins.
 */
export function candidateToRow(cand: Partial<FmsCandidate>, original?: Partial<FmsCandidate>, today = new Date().toISOString().slice(0, 10)): unknown[] {
  const now = new Date().toISOString();
  const dropped = isCandidateDropped(cand);
  const droppedDate = dropped ? clean(cand.droppedDate) || clean(original?.droppedDate) || today : "";
  const currentIdx = currentStageIndex(cand);

  return CANDIDATE_FMS_COLUMNS.map((col) => {
    if (col.kind === "profile") {
      switch (col.prop) {
        case "fmsId": return cand.fmsId || `FMS-${cand.id || ""}`;
        case "phone": return cand.phone || cand.whatsapp || "";
        case "email": return cand.email || cand.personalDetails?.personalEmail || "";
        case "brand": return cand.brand || "ahl";
        case "currentStage": return cand.currentStage || FMS_CANDIDATE_STAGES[0].name;
        case "status": return cand.status || "Active";
        case "archived": return cand.archived ? "TRUE" : "";
        case "droppedDate": return droppedDate;
        case "createdAt": return cand.createdAt || now;
        case "updatedAt": return cand.updatedAt || now;
        default: return clean((cand as any)[col.prop]);
      }
    }

    if (col.kind === "stage") {
      const st = cand.stages?.[col.stage];
      const data = cand.stageData?.[col.stage] || {};
      const planned = clean(st?.plannedDate || data.plannedDate);
      const actual = clean(st?.actualDate || data.actualDate);
      const status = st?.status || data.status || "Pending";

      // A dropped candidate stops at the stage they were in: that stage reads "Dropped", its Actual is
      // the drop date and its delay is frozen there; the stages after it stay empty.
      if (dropped) {
        const stageIdx = STAGE_INDEX[col.stage];
        if (stageIdx > currentIdx) return "";
        if (stageIdx === currentIdx) {
          if (col.part === "actualDate") return actual || droppedDate;
          if (col.part === "status") return "Dropped";
          if (col.part === "delayDays") return formatDroppedDelayText(planned, droppedDate);
        }
      }

      if (col.part === "plannedDate") return planned;
      if (col.part === "actualDate") return actual;
      if (col.part === "status") return !dropped && status === "Dropped" ? "In Progress" : status;
      return formatDelayText(planned, actual, today);
    }

    if (col.kind === "field") {
      const value = resolveField(cand, col.stage, col.key, original);
      // Application Status is stage 1's status column: it shows a stage-1 drop and is not left
      // blank while the candidate is still in stage 1.
      if (col.stage === "ar" && col.key === "applicationStatus" && currentIdx === 0) {
        return dropped ? "Dropped" : value || "Under Review";
      }
      return value;
    }

    // Stage Data JSON keeps whatever has no dedicated column (checklists, extra notes, legacy keys).
    const json: Record<string, any> = {};
    for (const stage of FMS_CANDIDATE_STAGES) {
      const data = { ...(cand.stageData?.[stage.id] || {}) };
      const checklist = cand.stages?.[stage.id]?.checklistState;
      if (checklist && Object.keys(checklist).length) data.checklistState = checklist;
      for (const key of ["checklist", "fieldValues", "plannedDate", "actualDate", "status", ...(FIELD_KEYS_BY_STAGE[stage.id] || [])]) {
        delete data[key];
      }
      if (Object.keys(data).length) json[stage.id] = data;
    }
    return JSON.stringify(json);
  });
}

/**
 * Reorders a schema-ordered row to match the sheet's actual header row, so writes land in the right
 * cells even while the sheet and the deployed schema differ (e.g. mid-migration). Sheet columns the
 * schema does not know get null, which the Sheets API leaves untouched.
 */
export function alignRowToSheetHeader(row: unknown[], sheetHeader: unknown[]): unknown[] {
  const byKey = new Map(CANDIDATE_FMS_HEADERS.map((h, i) => [normalizeKey(h), i]));
  return sheetHeader.map((h) => {
    const i = byKey.get(normalizeKey(h));
    return i === undefined ? null : row[i];
  });
}

/** Spreadsheet column letter for a 1-based column number. */
export function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const CANDIDATE_FMS_LAST_COLUMN = columnLetter(CANDIDATE_FMS_HEADERS.length);
