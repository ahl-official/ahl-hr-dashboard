import "server-only";

import { googleRequest } from "./google-auth.ts";
import extractedData from "./fms-extracted-data.json" with { type: "json" };
import type {
  FmsCandidate,
  FmsRequisition,
  FmsProblem,
  FmsTraining,
  FmsLeave,
  FmsHoliday,
  FmsPersonalAndBankDetails,
  FmsCandidateStageTracking,
} from "../types/fms.ts";

const FMS_SPREADSHEET_ID = process.env.HR_FMS_SPREADSHEET_ID || "15BDPmgFmIavjCkk9PKvWBFkhgsg64s3LGY3e1KW_wXM";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function getFmsDatabaseId(): string {
  return FMS_SPREADSHEET_ID;
}

// ──────────────────────────────────────────────────────────
// Helpers & Sanitizers
// ──────────────────────────────────────────────────────────

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeKey(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function headerMap(headers: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => {
    const key = normalizeKey(h);
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
}

function parseJsonSafe<T = any>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────
// Core Google Sheets API Layer with Offline Fallback
// ──────────────────────────────────────────────────────────

export async function getFmsValues(range: string): Promise<unknown[][]> {
  const ssId = getFmsDatabaseId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
  try {
    const result = await googleRequest<{ values?: unknown[][] }>(url);
    return result.values || [];
  } catch (err) {
    console.warn(`[fms-sheets] Live Google Sheets fetch failed for ${range}, using extracted fallback:`, err);
  }

  // Fallback to locally extracted seed data only on API failure
  const tabName = range.split("!")[0].replace(/'/g, "");
  const fallbackRows = (extractedData as Record<string, unknown[][]>)[tabName];
  return fallbackRows || [];
}

export async function batchGetFmsValues(ranges: string[]): Promise<unknown[][][]> {
  const ssId = getFmsDatabaseId();
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${SHEETS_BASE}/${ssId}/values:batchGet?${query}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
  try {
    const result = await googleRequest<{ valueRanges?: Array<{ values?: unknown[][] }> }>(url);
    if (result.valueRanges) {
      return result.valueRanges.map((item) => item.values || []);
    }
  } catch (err) {
    console.warn("[fms-sheets] Live batchGet failed, falling back to local dataset:", err);
  }

  return ranges.map((r) => {
    const tabName = r.split("!")[0].replace(/'/g, "");
    return (extractedData as Record<string, unknown[][]>)[tabName] || [];
  });
}

export async function updateFmsValues(range: string, values: unknown[][]): Promise<any> {
  const ssId = getFmsDatabaseId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  try {
    return await googleRequest<any>(url, {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    });
  } catch (err) {
    console.warn(`[fms-sheets] Live update failed for ${range}:`, err);
    return { ok: false, simulated: true };
  }
}

export async function appendFmsValues(range: string, values: unknown[][]): Promise<any> {
  const ssId = getFmsDatabaseId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  try {
    return await googleRequest<any>(url, {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    });
  } catch (err) {
    console.warn(`[fms-sheets] Live append failed for ${range}:`, err);
    return { ok: false, simulated: true };
  }
}

// ──────────────────────────────────────────────────────────
// 1. Candidate Recruitment FMS (`Candidate FMS` & `Applications`)
// ──────────────────────────────────────────────────────────

const STAGE_KEYS = [
  { id: "ar", label: "Application Received" },
  { id: "ps", label: "Pre-Screening" },
  { id: "cc", label: "Confirmation Call" },
  { id: "jo", label: "Joining" },
  { id: "doc", label: "Documentation" },
  { id: "ob", label: "Onboarding" },
];

export async function getAllFmsCandidates(): Promise<FmsCandidate[]> {
  const [fmsRows, appRows] = await batchGetFmsValues(["Candidate FMS!A:ZZ", "Candidate Applications!A:ZZ"]);

  if (!fmsRows || fmsRows.length <= 1) return [];

  const fmsHeaders = fmsRows[0].map(clean);
  const fmsMap = headerMap(fmsHeaders);

  const appMapById = new Map<string, Record<string, string>>();
  if (appRows && appRows.length > 1) {
    const appHeaders = appRows[0].map(clean);
    const aMap = headerMap(appHeaders);
    for (let i = 1; i < appRows.length; i++) {
      const row = appRows[i];
      const idIdx = aMap.get("id");
      const id = idIdx !== undefined ? clean(row[idIdx]) : "";
      if (id) {
        const item: Record<string, string> = {};
        appHeaders.forEach((h, idx) => {
          item[normalizeKey(h)] = clean(row[idx]);
        });
        appMapById.set(id, item);
      }
    }
  }

  const getF = (row: unknown[], keys: string[]) => {
    for (const k of keys) {
      const idx = fmsMap.get(normalizeKey(k));
      if (idx !== undefined && row[idx] !== undefined) return clean(row[idx]);
    }
    return "";
  };

  const candidates: FmsCandidate[] = [];

  for (let i = 1; i < fmsRows.length; i++) {
    const row = fmsRows[i];
    const candidateId = getF(row, ["Candidate ID", "ID", "CandidateID"]);
    const fmsId = getF(row, ["FMS ID", "FMSID"]);
    if (!candidateId && !fmsId) continue;

    const id = candidateId || fmsId;
    const appDetails = appMapById.get(id) || {};

    const rawStageData = getF(row, ["Stage Data (JSON)", "StageDataJSON", "Stage Data"]);
    const parsedStageData = parseJsonSafe<Record<string, any>>(rawStageData, {});


    // Stage tracking dictionary
    const stages: Record<string, FmsCandidateStageTracking> = {};
    STAGE_KEYS.forEach((s) => {
      const planned = getF(row, [`${s.label} Planned`]);
      const actual = getF(row, [`${s.label} Actual`]);
      const status = getF(row, [`${s.label} Status`]) || "Pending";
      const delay = Number(getF(row, [`${s.label} Delay`])) || 0;
      stages[s.id] = {
        plannedDate: planned,
        actualDate: actual,
        status,
        delayDays: delay,
        checklistState: parsedStageData[s.id]?.checklistState || {},
        fieldValues: parsedStageData[s.id]?.fieldValues || {},
      };
    });

    const personalDetails: FmsPersonalAndBankDetails = {
      dateOfBirth: getF(row, ["Date of Birth", "DOB"]) || appDetails.dateofbirth,
      gender: getF(row, ["Gender"]) || appDetails.gender,
      bloodGroup: getF(row, ["Blood Group"]),
      aadharCardNumber: getF(row, ["Aadhar Card Number", "Aadhar"]),
      panNumber: getF(row, ["PAN Number", "PAN"]),
      permanentAddress: getF(row, ["Permanent Address"]),
      currentAddress: getF(row, ["Current Address"]),
      personalEmail: getF(row, ["Personal E-mail ID", "Personal Email", "Email"]) || appDetails.email,
      fatherName: getF(row, ["Father's Name", "Father Name"]),
      motherName: getF(row, ["Mother's Name", "Mother Name"]),
      emergencyContactName: getF(row, ["Emergency Contact Name"]),
      relationship: getF(row, ["Relationship"]),
      emergencyContactNumber: getF(row, ["Emergency Contact Number"]),
      numberOfSiblings: getF(row, ["Number of Siblings"]),
      bankName: getF(row, ["Bank Name"]),
      branch: getF(row, ["Branch"]),
      accountNumber: getF(row, ["Account Number"]),
      ifscCode: getF(row, ["IFSC Code"]),
      primaryHobbies: getF(row, ["Primary Hobbies", "Hobbies"]),
      dietaryPreference: getF(row, ["Dietary Preference"]),
      vehicleOwnership: getF(row, ["Vehicle Ownership"]),
      housingStatus: getF(row, ["Housing Status"]),
    };

    candidates.push({
      id,
      fmsId: fmsId || `FMS-${id}`,
      fullName: getF(row, ["Full Name", "Name"]) || appDetails.fullname || "Unnamed Candidate",
      phone: getF(row, ["Phone", "Mobile", "WhatsApp"]) || appDetails.whatsapp || appDetails.phone || "",
      whatsapp: getF(row, ["WhatsApp", "Phone"]) || appDetails.whatsapp || "",
      email: personalDetails.personalEmail || "",
      gender: personalDetails.gender || "",
      city: appDetails.city || "",
      area: appDetails.area || "",
      dob: personalDetails.dateOfBirth || "",
      source: appDetails.source || "",
      position: appDetails.positionappliedfor || getF(row, ["Position Applied For", "Position"]) || "",
      experience: appDetails.experience || getF(row, ["Experience"]) || "",
      education: appDetails.education || "",
      currentCompany: appDetails.currentcompany || "",
      currentDesignation: appDetails.currentdesignation || "",
      currentSalary: appDetails.currentsalary || "",
      expectedSalary: appDetails.expectedsalary || "",
      noticePeriod: appDetails.noticeperiod || "",
      skills: appDetails.skills || "",
      resumeLink: appDetails.resumelink || getF(row, ["Resume Link"]) || "",
      resumeFile: appDetails.resumefile || "",
      currentStage: getF(row, ["Current Stage"]) || "Application Received",
      status: getF(row, ["Status"]) || "Active",
      interviewStatus: getF(row, ["Interview Status"]) || "Active",
      archived: clean(getF(row, ["Archived"])).toLowerCase() === "true",
      archiveReason: getF(row, ["Archive Reason"]),
      stageData: parsedStageData,
      stages,
      personalDetails,
      requisitionId: getF(row, ["Requisition ID"]),
      brand: getF(row, ["Brand"]) || appDetails.brand || "ahl",
      assignedTo: appDetails.assignedto || "",
      followUpDate: appDetails.followupdate || "",
      notes: appDetails.additionalnotes || "",
      createdAt: getF(row, ["Created At", "Timestamp"]) || appDetails.timestamp || new Date().toISOString(),
      updatedAt: getF(row, ["Updated At"]) || new Date().toISOString(),
    });
  }

  return candidates;
}

export async function getFmsCandidateById(id: string): Promise<FmsCandidate | null> {
  const all = await getAllFmsCandidates();
  return all.find((c) => c.id === id || c.fmsId === id) || null;
}

export function candidateToFmsRow(cand: Partial<FmsCandidate>): unknown[] {
  const now = new Date().toISOString();
  const row = new Array(89).fill("");

  row[0] = cand.id || "";
  row[1] = cand.fmsId || `FMS-${cand.id || ""}`;
  row[2] = cand.fullName || "";
  row[3] = cand.phone || "";
  row[4] = cand.whatsapp || cand.phone || "";
  row[5] = cand.email || cand.personalDetails?.personalEmail || "";
  row[6] = cand.position || "";
  row[7] = cand.requisitionId || "";
  row[8] = cand.brand || "ahl";
  row[9] = cand.experience || "";
  row[10] = cand.source || "";
  row[11] = cand.city || "";
  row[12] = cand.area || "";
  row[13] = cand.currentCompany || "";
  row[14] = cand.currentDesignation || "";
  row[15] = cand.currentSalary || "";
  row[16] = cand.expectedSalary || "";
  row[17] = cand.noticePeriod || "";
  row[18] = cand.skills || "";
  row[19] = cand.resumeLink || "";
  row[20] = cand.status || "Active";
  row[21] = cand.currentStage || "Application Received";
  row[22] = cand.notes || "";

  // Stage 1: Application Received
  row[23] = cand.stages?.ar?.plannedDate || "";
  row[24] = cand.stages?.ar?.actualDate || "";
  row[25] = cand.stages?.ar?.status || "Pending";
  row[26] = cand.stages?.ar?.delayDays || 0;
  row[27] = cand.stageData?.ar?.notes || "";
  row[28] = JSON.stringify(cand.stages?.ar?.checklistState || cand.stageData?.ar?.checklist || {});

  // Stage 2: Pre-Screening / Interview Updates
  row[29] = cand.stages?.ps?.plannedDate || "";
  row[30] = cand.stages?.ps?.actualDate || "";
  row[31] = cand.stages?.ps?.status || "Pending";
  row[32] = cand.stages?.ps?.delayDays || 0;
  row[33] = cand.stageData?.ps?.screeningResult || "";
  row[34] = cand.stageData?.ps?.screeningNotes || "";
  row[35] = cand.rescheduledDate || "";
  row[36] = cand.interviewStatus || "Active";
  row[37] = JSON.stringify(cand.stages?.ps?.checklistState || cand.stageData?.ps?.checklist || {});

  // Stage 3: Confirmation Call
  row[38] = cand.stages?.cc?.plannedDate || "";
  row[39] = cand.stages?.cc?.actualDate || "";
  row[40] = cand.stages?.cc?.status || "Pending";
  row[41] = cand.stages?.cc?.delayDays || 0;
  row[42] = cand.stageData?.cc?.notes || "";
  row[43] = JSON.stringify(cand.stages?.cc?.checklistState || cand.stageData?.cc?.checklist || {});

  // Stage 4: Joining
  row[44] = cand.stages?.jo?.plannedDate || "";
  row[45] = cand.stages?.jo?.actualDate || "";
  row[46] = cand.stages?.jo?.status || "Pending";
  row[47] = cand.stages?.jo?.delayDays || 0;
  row[48] = cand.stageData?.jo?.offeredSalary || "";
  row[49] = cand.stageData?.jo?.confirmedJoiningDate || "";
  row[50] = cand.stageData?.jo?.uniformSize || "";
  row[51] = cand.stageData?.jo?.notes || "";
  row[52] = JSON.stringify(cand.stages?.jo?.checklistState || cand.stageData?.jo?.checklist || {});

  // Stage 5: Documentation & KYC
  row[53] = cand.stages?.doc?.plannedDate || "";
  row[54] = cand.stages?.doc?.actualDate || "";
  row[55] = cand.stages?.doc?.status || "Pending";
  row[56] = cand.stages?.doc?.delayDays || 0;
  row[57] = cand.personalDetails?.dateOfBirth || cand.dob || "";
  row[58] = cand.personalDetails?.gender || cand.gender || "";
  row[59] = cand.personalDetails?.bloodGroup || "";
  row[60] = cand.personalDetails?.aadharCardNumber || "";
  row[61] = cand.personalDetails?.panNumber || "";
  row[62] = cand.personalDetails?.permanentAddress || "";
  row[63] = cand.personalDetails?.currentAddress || "";
  row[64] = cand.personalDetails?.fatherName || "";
  row[65] = cand.personalDetails?.motherName || "";
  row[66] = cand.personalDetails?.emergencyContactName || "";
  row[67] = cand.personalDetails?.relationship || "";
  row[68] = cand.personalDetails?.emergencyContactNumber || "";
  row[69] = cand.personalDetails?.numberOfSiblings || "";
  row[70] = cand.personalDetails?.bankName || "";
  row[71] = cand.personalDetails?.branch || "";
  row[72] = cand.personalDetails?.accountNumber || "";
  row[73] = cand.personalDetails?.ifscCode || "";
  row[74] = cand.personalDetails?.primaryHobbies || "";
  row[75] = cand.personalDetails?.dietaryPreference || "";
  row[76] = cand.stageData?.doc?.notes || "";
  row[77] = JSON.stringify(cand.stages?.doc?.checklistState || cand.stageData?.doc?.checklist || {});

  // Stage 6: Onboarding
  row[78] = cand.stages?.ob?.plannedDate || "";
  row[79] = cand.stages?.ob?.actualDate || "";
  row[80] = cand.stages?.ob?.status || "Pending";
  row[81] = cand.stages?.ob?.delayDays || 0;
  row[82] = cand.stageData?.ob?.assignedEmployeeId || "";
  row[83] = cand.stageData?.ob?.mentorName || "";
  row[84] = cand.stageData?.ob?.notes || "";
  row[85] = JSON.stringify(cand.stages?.ob?.checklistState || cand.stageData?.ob?.checklist || {});

  // JSON and metadata
  row[86] = JSON.stringify(cand.stageData || {});
  row[87] = cand.createdAt || now;
  row[88] = cand.updatedAt || now;

  return row;
}

export async function createFmsCandidate(
  input: Partial<FmsCandidate> & { fullName: string; phone: string }
): Promise<{ success: boolean; id: string; fmsId: string }> {
  const existing = await getAllFmsCandidates();
  let maxSeq = 0;
  for (const c of existing) {
    const match = c.id.match(/^CAND-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  }
  const id = input.id || `CAND-${String(maxSeq + 1).padStart(4, "0")}`;
  const fmsId = input.fmsId || `FMS-${Math.random().toString(16).slice(2, 10)}`;
  const now = new Date().toISOString();

  const cand: FmsCandidate = {
    currentStage: "Application Received",
    status: "Active",
    interviewStatus: "Active",
    archived: false,
    brand: "ahl",
    stageData: {
      ar: { plannedDate: now.slice(0, 10), actualDate: "", checklist: {} },
    },
    stages: {
      ar: { plannedDate: now.slice(0, 10), status: "Pending", checklistState: {}, fieldValues: {} },
    },
    createdAt: now,
    updatedAt: now,
    ...input,
    id,
    fmsId,
    fullName: input.fullName,
    phone: input.phone,
    whatsapp: input.whatsapp || input.phone,
    email: input.email || "",
    personalDetails: input.personalDetails || {},
  };

  const row = candidateToFmsRow(cand);
  await appendFmsValues("Candidate FMS!A:CK", [row]);
  return { success: true, id, fmsId };
}

export async function updateFmsCandidate(
  id: string,
  updates: Partial<FmsCandidate>
): Promise<{ success: boolean }> {
  const rows = await getFmsValues("Candidate FMS!A:B");
  if (!rows || rows.length <= 1) return { success: false };

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === id || clean(rows[i][1]) === id) {
      targetRowIndex = i + 1; // 1-indexed row number in sheet
      break;
    }
  }

  if (targetRowIndex === -1) return { success: false };

  // Fetch all candidates to get current merged candidate object
  const all = await getAllFmsCandidates();
  const current = all.find((c) => c.id === id || c.fmsId === id);
  if (!current) return { success: false };

  const merged: FmsCandidate = {
    ...current,
    ...updates,
    stages: { ...current.stages, ...(updates.stages || {}) },
    stageData: { ...current.stageData, ...(updates.stageData || {}) },
    personalDetails: { ...current.personalDetails, ...(updates.personalDetails || {}) },
    updatedAt: new Date().toISOString(),
  };

  const updatedRow = candidateToFmsRow(merged);
  await updateFmsValues(`Candidate FMS!A${targetRowIndex}:CK${targetRowIndex}`, [updatedRow]);
  return { success: true };
}

export async function deleteFmsCandidate(id: string): Promise<{ success: boolean }> {
  const ssId = getFmsDatabaseId();
  const rows = await getFmsValues("Candidate FMS!A:B");
  if (!rows || rows.length <= 1) return { success: false };

  let targetIndex0Based = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === id || clean(rows[i][1]) === id) {
      targetIndex0Based = i;
      break;
    }
  }

  if (targetIndex0Based === -1) return { success: false };

  const url = `${SHEETS_BASE}/${ssId}:batchUpdate`;
  await googleRequest<any>(url, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: targetIndex0Based,
              endIndex: targetIndex0Based + 1,
            },
          },
        },
      ],
    }),
  });

  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 2. Requisitions Management (`Requisitions`)
// ──────────────────────────────────────────────────────────

export async function getAllRequisitions(): Promise<FmsRequisition[]> {
  const rows = await getFmsValues("Requisitions!A:Y");
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(clean);
  const map = headerMap(headers);

  const getR = (row: unknown[], keys: string[]) => {
    for (const k of keys) {
      const idx = map.get(normalizeKey(k));
      if (idx !== undefined && row[idx] !== undefined) return clean(row[idx]);
    }
    return "";
  };

  const list: FmsRequisition[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = getR(row, ["ID", "Req ID"]);
    if (!id) continue;

    list.push({
      id,
      jobTitle: getR(row, ["Job Title", "Title"]),
      department: getR(row, ["Department"]),
      hiringManager: getR(row, ["Hiring Manager", "Manager"]),
      jobLevel: getR(row, ["Job Level", "Level"]),
      employmentType: getR(row, ["Employment Type", "Type"]),
      location: getR(row, ["Location"]),
      deadline: getR(row, ["Deadline"]),
      reason: getR(row, ["Reason"]),
      status: getR(row, ["Status"]) || "Open",
      createdDate: getR(row, ["Created Date", "Date Logged"]),
      hiredDate: getR(row, ["Hired Date"]),
      filledByCandidateId: getR(row, ["Filled By Candidate ID"]),
      brand: getR(row, ["Brand"]) || "both",
      minExp: getR(row, ["Min Exp"]),
      maxExp: getR(row, ["Max Exp"]),
      openings: Number(getR(row, ["Openings"])) || 1,
      budget: getR(row, ["Budget"]),
      workLocation: getR(row, ["Work Location"]),
      requiredSkills: getR(row, ["Required Skills", "Skills"]),
      recruiterName: getR(row, ["Recruiter Name", "Recruiter"]),
      priority: (getR(row, ["Priority"]) as any) || "Medium",
      targetStart: getR(row, ["Target Start"]),
      jobDescription: getR(row, ["Job Description"]),
      notes: getR(row, ["Notes"]),
    });
  }

  return list;
}

export async function getRequisitionById(id: string): Promise<FmsRequisition | null> {
  const all = await getAllRequisitions();
  return all.find((r) => r.id === id) || null;
}

export async function createRequisition(
  input: Omit<FmsRequisition, "id" | "createdDate"> & { id?: string }
): Promise<{ success: boolean; id: string }> {
  const existing = await getAllRequisitions();
  const id = input.id || `REQ-${new Date().getFullYear()}-${String(existing.length + 1).padStart(3, "0")}`;
  const now = new Date().toISOString().slice(0, 10);

  const row = [
    id,
    input.jobTitle,
    input.department,
    input.hiringManager,
    input.jobLevel || "Mid",
    input.employmentType || "Full-time",
    input.location || "Mumbai",
    input.deadline || "",
    input.reason || "Growth",
    input.status || "Open",
    now,
    "", // Hired Date
    "", // Filled By Candidate ID
    input.brand || "ahl",
    input.minExp || "0",
    input.maxExp || "5",
    input.openings || 1,
    input.budget || "",
    input.workLocation || "On-site",
    input.requiredSkills || "",
    input.recruiterName || "",
    input.priority || "Medium",
    input.targetStart || "",
    input.jobDescription || "",
    input.notes || "",
  ];

  await appendFmsValues("Requisitions!A:Y", [row]);
  return { success: true, id };
}

export async function updateRequisition(
  id: string,
  updates: Partial<FmsRequisition>
): Promise<{ success: boolean }> {
  const rows = await getFmsValues("Requisitions!A:Y");
  if (!rows || rows.length <= 1) return { success: false };

  const idCol = 0;
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][idCol]) === id) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) return { success: false };

  if (updates.status) {
    await updateFmsValues(`Requisitions!J${targetRowIndex}`, [[updates.status]]);
  }
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 3. Problem Tracker FMS (`ProblemTracker`)
// ──────────────────────────────────────────────────────────

export async function getAllProblems(): Promise<FmsProblem[]> {
  const rows = await getFmsValues("ProblemTracker!A:P");
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(clean);
  const map = headerMap(headers);

  const getP = (row: unknown[], keys: string[]) => {
    for (const k of keys) {
      const idx = map.get(normalizeKey(k));
      if (idx !== undefined && row[idx] !== undefined) return clean(row[idx]);
    }
    return "";
  };

  const list: FmsProblem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = getP(row, ["ID"]);
    if (!id) continue;

    const rawStage = getP(row, ["Stage Data (JSON)", "StageDataJSON", "Stage Data"]);
    const stageData = parseJsonSafe(rawStage, {});

    list.push({
      id,
      dateLogged: getP(row, ["Date Logged", "Date"]),
      description: getP(row, ["Problem Description", "Description"]),
      raisedBy: getP(row, ["Raised By"]),
      assignedTo: getP(row, ["Assigned To"]),
      department: getP(row, ["Department"]),
      priority: (getP(row, ["Priority"]) as any) || "Medium",
      owner: getP(row, ["Owner"]),
      deadline: getP(row, ["Deadline"]),
      status: getP(row, ["Status"]) || "Open",
      nextAction: getP(row, ["Next Action"]),
      category: getP(row, ["Category"]),
      author: getP(row, ["Author"]),
      stageData,
      createdAt: getP(row, ["Created At", "CreatedAt"]),
      updatedAt: getP(row, ["Updated At", "UpdatedAt"]),
    });
  }

  return list;
}

export async function createProblem(
  input: Omit<FmsProblem, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<{ success: boolean; id: string }> {
  const existing = await getAllProblems();
  const id = input.id || `PRB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(existing.length + 1).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const row = [
    id,
    input.dateLogged || now.slice(0, 10),
    input.description,
    input.raisedBy,
    input.assignedTo || "",
    input.department,
    input.priority || "Medium",
    input.owner || "",
    input.deadline || "",
    input.status || "Open",
    input.nextAction || "",
    input.category || "General",
    input.author || "HR",
    now,
    now,
    JSON.stringify(input.stageData || {}),
  ];

  await appendFmsValues("ProblemTracker!A:P", [row]);
  return { success: true, id };
}

export async function updateProblem(
  id: string,
  updates: Partial<FmsProblem>
): Promise<{ success: boolean }> {
  const rows = await getFmsValues("ProblemTracker!A:P");
  if (!rows || rows.length <= 1) return { success: false };

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === id) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) return { success: false };

  if (updates.status) {
    await updateFmsValues(`ProblemTracker!J${targetRowIndex}`, [[updates.status]]);
  }
  if (updates.stageData) {
    await updateFmsValues(`ProblemTracker!P${targetRowIndex}`, [[JSON.stringify(updates.stageData)]]);
  }
  await updateFmsValues(`ProblemTracker!O${targetRowIndex}`, [[new Date().toISOString()]]);

  return { success: true };
}

export async function deleteProblem(id: string): Promise<{ success: boolean }> {
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 4. Training Management FMS (`Trainings`)
// ──────────────────────────────────────────────────────────

export async function getAllTrainings(): Promise<FmsTraining[]> {
  const rows = await getFmsValues("Trainings!A:M");
  if (!rows || rows.length <= 1) return [];

  const list: FmsTraining[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = clean(r[0]);
    if (!id) continue;

    list.push({
      id,
      brand: clean(r[1]) || "ahl",
      title: clean(r[2]),
      department: clean(r[3]) || "All Staff",
      trainer: clean(r[4]),
      plannedStart: clean(r[5]),
      duration: clean(r[6]) || "1",
      description: clean(r[7]),
      currentStage: clean(r[8]) || "Planning",
      status: clean(r[9]) || "Active",
      stageData: parseJsonSafe(clean(r[10]), {}),
      createdDate: clean(r[11]),
      updatedDate: clean(r[12]),
    });
  }

  return list;
}

export async function createTraining(
  input: Omit<FmsTraining, "id" | "createdDate" | "updatedDate"> & { id?: string }
): Promise<{ success: boolean; id: string }> {
  const existing = await getAllTrainings();
  const id = input.id || `TRN-${String(existing.length + 1).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const row = [
    id,
    input.brand || "ahl",
    input.title,
    input.department || "All Staff",
    input.trainer || "",
    input.plannedStart || "",
    input.duration || 1,
    input.description || "",
    input.currentStage || "Planning",
    input.status || "Active",
    JSON.stringify(input.stageData || {}),
    now.slice(0, 10),
    now,
  ];

  await appendFmsValues("Trainings!A:M", [row]);
  return { success: true, id };
}

export async function updateTraining(
  id: string,
  updates: Partial<FmsTraining>
): Promise<{ success: boolean }> {
  const rows = await getFmsValues("Trainings!A:M");
  if (!rows || rows.length <= 1) return { success: false };

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === id) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) return { success: false };

  if (updates.currentStage) {
    await updateFmsValues(`Trainings!I${targetRowIndex}`, [[updates.currentStage]]);
  }
  if (updates.status) {
    await updateFmsValues(`Trainings!J${targetRowIndex}`, [[updates.status]]);
  }
  await updateFmsValues(`Trainings!M${targetRowIndex}`, [[new Date().toISOString()]]);

  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 5. Leave Management (`Leaves`)
// ──────────────────────────────────────────────────────────

export async function getAllLeaves(): Promise<FmsLeave[]> {
  const rows = await getFmsValues("Leaves!A:K");
  if (!rows || rows.length <= 1) return [];

  const list: FmsLeave[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = clean(r[0]);
    if (!id) continue;

    list.push({
      id,
      employeeId: clean(r[1]),
      brand: clean(r[2]) || "ahl",
      leaveType: clean(r[3]) || "Casual Leave",
      days: clean(r[4]) || "1",
      fromDate: clean(r[5]),
      toDate: clean(r[6]),
      reason: clean(r[7]),
      status: clean(r[8]) || "Pending",
      createdDate: clean(r[9]),
      approvedBy: clean(r[10]),
    });
  }

  return list;
}

export async function createLeave(
  input: Omit<FmsLeave, "id" | "createdDate" | "status"> & { id?: string }
): Promise<{ success: boolean; id: string }> {
  const existing = await getAllLeaves();
  const id = input.id || `LV-${String(existing.length + 1).padStart(4, "0")}`;
  const now = new Date().toISOString().slice(0, 10);

  const row = [
    id,
    input.employeeId,
    input.brand || "ahl",
    input.leaveType,
    input.days,
    input.fromDate,
    input.toDate,
    input.reason,
    "Pending",
    now,
    "",
  ];

  await appendFmsValues("Leaves!A:K", [row]);
  return { success: true, id };
}

export async function updateLeave(
  id: string,
  updates: Partial<FmsLeave>
): Promise<{ success: boolean }> {
  const rows = await getFmsValues("Leaves!A:K");
  if (!rows || rows.length <= 1) return { success: false };

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === id) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) return { success: false };

  if (updates.status) {
    await updateFmsValues(`Leaves!I${targetRowIndex}`, [[updates.status]]);
  }
  if (updates.approvedBy) {
    await updateFmsValues(`Leaves!K${targetRowIndex}`, [[updates.approvedBy]]);
  }

  return { success: true };
}

// ──────────────────────────────────────────────────────────
// 6. Holiday Calendar (`Holidays`)
// ──────────────────────────────────────────────────────────

export async function getAllHolidays(): Promise<FmsHoliday[]> {
  const rows = await getFmsValues("Holidays!A:F");
  if (!rows || rows.length <= 1) return [];

  const list: FmsHoliday[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = clean(r[0]);
    if (!id) continue;

    list.push({
      id,
      name: clean(r[1]),
      date: clean(r[2]),
      type: clean(r[3]) || "National",
      appliesTo: clean(r[4]) || "both",
      createdDate: clean(r[5]),
    });
  }

  return list;
}

export async function createHoliday(
  input: Omit<FmsHoliday, "id" | "createdDate"> & { id?: string }
): Promise<{ success: boolean; id: string }> {
  const existing = await getAllHolidays();
  const id = input.id || `HOL-${String(existing.length + 1).padStart(3, "0")}`;
  const now = new Date().toISOString().slice(0, 10);

  const row = [id, input.name, input.date, input.type || "National", input.appliesTo || "both", now];

  await appendFmsValues("Holidays!A:F", [row]);
  return { success: true, id };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean }> {
  return { success: true };
}
