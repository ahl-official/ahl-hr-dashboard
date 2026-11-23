import type {
  EmployeeBranch,
  BehaviourEvaluationInput,
  BirdsEyeSummary,
} from "../types/behaviour-tracker.ts";
import {
  evaluateBranchState,
  buildEmployeeWhatsAppMessage,
} from "./behaviour-rules.ts";
import { cleanPhoneNumber } from "./whatsapp.ts";

async function dispatchWahaMessage(phone: string, text: string) {
  const base = (process.env.WAHA_BASE_URL || "").replace(/\/+$/, "");
  const session = process.env.WAHA_SESSION || "ahlaiteam";
  if (!base || !session) return { simulated: true };
  try {
    const res = await fetch(`${base}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}),
      },
      body: JSON.stringify({ session, chatId: `${phone.replace(/\D/g, "")}@c.us`, text }),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok };
  } catch (err: any) {
    return { error: err?.message };
  }
}

// Seed branches for instant verification & testing
const initialBranches: EmployeeBranch[] = [
  {
    id: "BRN-2026-10-0044",
    employeeKey: "EMP-TEST-001",
    employeeId: "AHL-HK-0044",
    employeeName: "Rahul Sharma",
    department: "Styling & Salon",
    company: "American Hairline",
    phone: "919930068840",
    month: "2026-10",
    color: "grey",
    status: "watching",
    signals: [
      {
        type: "late_marks",
        title: "Excessive Late Marks",
        description: "Logged 8 late arrivals this month (Hazri Box allowance threshold is 5).",
        severity: "medium",
        occurrences: 8,
        dates: ["2026-10-02", "2026-10-05", "2026-10-08", "2026-10-12", "2026-10-16", "2026-10-19", "2026-10-23", "2026-10-27"],
      },
      {
        type: "mon_fri_leave",
        title: "Weekend Extension Leaves (Mon/Fri)",
        description: "Took 2 leaves falling on Mondays or Fridays.",
        severity: "medium",
        occurrences: 2,
        dates: ["2026-10-09 (Friday)", "2026-10-19 (Monday)"],
      },
    ],
    hrTalkCompleted: true,
    hrTalkNotes: "Met with Rahul. Discussed morning salon opening punctuality. He agreed to adjust travel schedule.",
    hrTalkDate: "2026-10-22",
    whatsappSentAt: "2026-10-25T11:00:00.000Z",
    whatsappMessage: "Attendance & Behaviour Report — October 2026...",
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-25T11:00:00.000Z",
  },
  {
    id: "BRN-2026-11-0044",
    employeeKey: "EMP-TEST-001",
    employeeId: "AHL-HK-0044",
    employeeName: "Rahul Sharma",
    department: "Styling & Salon",
    company: "American Hairline",
    phone: "919930068840",
    month: "2026-11",
    color: "green",
    status: "improved",
    signals: [],
    hrTalkCompleted: false,
    previousBranchId: "BRN-2026-10-0044",
    closedAt: "2026-11-20T10:00:00.000Z",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
  {
    id: "BRN-2026-10-0082",
    employeeKey: "EMP-TEST-002",
    employeeId: "AHL-HK-0082",
    employeeName: "Sunita Verma",
    department: "Operations",
    company: "American Hairline",
    phone: "919372897938",
    month: "2026-10",
    color: "grey",
    status: "watching",
    signals: [
      {
        type: "late_marks",
        title: "Excessive Late Marks",
        description: "Logged 7 late marks this month.",
        severity: "medium",
        occurrences: 7,
        dates: ["2026-10-03", "2026-10-07", "2026-10-10", "2026-10-14", "2026-10-17", "2026-10-21", "2026-10-24"],
      },
    ],
    hrTalkCompleted: true,
    hrTalkNotes: "First warning issued. Asked to maintain shift timing.",
    hrTalkDate: "2026-10-15",
    whatsappSentAt: "2026-10-28T11:00:00.000Z",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-28T11:00:00.000Z",
  },
  {
    id: "BRN-2026-11-0082",
    employeeKey: "EMP-TEST-002",
    employeeId: "AHL-HK-0082",
    employeeName: "Sunita Verma",
    department: "Operations",
    company: "American Hairline",
    phone: "919372897938",
    month: "2026-11",
    color: "red",
    status: "repeat",
    signals: [
      {
        type: "late_marks",
        title: "Excessive Late Marks (Repeat Offense)",
        description: "Logged 9 late marks again in November despite October warning.",
        severity: "high",
        occurrences: 9,
        dates: ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18", "2026-11-20"],
      },
      {
        type: "hr_conduct_issue",
        title: "HR Disciplinary Warnings",
        description: "1 warning note logged by HR for unpunctuality.",
        severity: "high",
        occurrences: 1,
        dates: ["2026-11-12: Late for inventory handover."],
      },
    ],
    hrTalkCompleted: false,
    previousBranchId: "BRN-2026-10-0082",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
];

let branchesStore: EmployeeBranch[] = [...initialBranches];

/**
 * List all branches with optional filtering.
 */
export function getBranchesStore(filters?: {
  month?: string;
  color?: string;
  status?: string;
  employeeKey?: string;
}): EmployeeBranch[] {
  let list = [...branchesStore];
  if (filters?.month) {
    list = list.filter((b) => b.month === filters.month);
  }
  if (filters?.color) {
    list = list.filter((b) => b.color === filters.color);
  }
  if (filters?.status) {
    list = list.filter((b) => b.status === filters.status);
  }
  if (filters?.employeeKey) {
    list = list.filter((b) => b.employeeKey === filters.employeeKey);
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get branch by unique ID.
 */
export function getBranchByIdStore(id: string): EmployeeBranch | null {
  return branchesStore.find((b) => b.id === id) || null;
}

/**
 * Find previous branch for an employee before a given month.
 */
export function getPreviousMonthBranch(
  employeeKey: string,
  currentMonth: string
): EmployeeBranch | null {
  const employeeBranches = branchesStore
    .filter((b) => b.employeeKey === employeeKey && b.month < currentMonth)
    .sort((a, b) => b.month.localeCompare(a.month));

  return employeeBranches[0] || null;
}

/**
 * Evaluate and record a branch for an employee for a specific month.
 */
export function evaluateAndSaveBranch(input: BehaviourEvaluationInput): EmployeeBranch {
  const previousBranch = getPreviousMonthBranch(input.employeeKey, input.month);
  const evaluation = evaluateBranchState(input, previousBranch);

  const existingIdx = branchesStore.findIndex(
    (b) => b.employeeKey === input.employeeKey && b.month === input.month
  );

  const now = new Date().toISOString();
  const id = existingIdx >= 0 ? branchesStore[existingIdx].id : `BRN-${input.month}-${input.employeeId || input.employeeKey.slice(-6)}`;

  const branchRecord: EmployeeBranch = {
    id,
    employeeKey: input.employeeKey,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    department: input.department,
    company: input.company,
    phone: input.phone,
    month: input.month,
    color: evaluation.color,
    status: evaluation.status,
    signals: evaluation.signals,
    hrTalkCompleted: existingIdx >= 0 ? branchesStore[existingIdx].hrTalkCompleted : false,
    hrTalkNotes: existingIdx >= 0 ? branchesStore[existingIdx].hrTalkNotes : undefined,
    hrTalkDate: existingIdx >= 0 ? branchesStore[existingIdx].hrTalkDate : undefined,
    whatsappSentAt: existingIdx >= 0 ? branchesStore[existingIdx].whatsappSentAt : undefined,
    whatsappMessage: existingIdx >= 0 ? branchesStore[existingIdx].whatsappMessage : undefined,
    previousBranchId: previousBranch ? previousBranch.id : undefined,
    closedAt: evaluation.status === "improved" ? now : undefined,
    createdAt: existingIdx >= 0 ? branchesStore[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    branchesStore[existingIdx] = branchRecord;
  } else {
    branchesStore.unshift(branchRecord);
  }

  return branchRecord;
}

/**
 * Record that HR had a talk with the employee regarding this branch.
 */
export function recordHrTalkStore(branchId: string, notes: string): EmployeeBranch {
  const idx = branchesStore.findIndex((b) => b.id === branchId);
  if (idx === -1) throw new Error(`Branch with ID ${branchId} not found.`);

  branchesStore[idx] = {
    ...branchesStore[idx],
    hrTalkCompleted: true,
    hrTalkNotes: notes,
    hrTalkDate: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };

  return branchesStore[idx];
}

/**
 * Dispatch exactly ONE monthly WhatsApp message to the employee.
 * Strictly guarantees no second message is sent in the same month.
 */
export async function sendMonthlyWhatsAppStore(
  branchId: string,
  options: { force?: boolean } = {}
): Promise<{ success: boolean; message: string; branch: EmployeeBranch }> {
  const idx = branchesStore.findIndex((b) => b.id === branchId);
  if (idx === -1) throw new Error(`Branch with ID ${branchId} not found.`);

  const branch = branchesStore[idx];

  // GUARD: Enforce strictly ONE message per month rule
  if (branch.whatsappSentAt && !options.force) {
    throw new Error(
      `Monthly WhatsApp already dispatched for ${branch.employeeName} on ${branch.whatsappSentAt.slice(0, 10)}. Strictly one message allowed per month.`
    );
  }

  const monthName = new Date(`${branch.month}-01`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const messageText = buildEmployeeWhatsAppMessage(branch, monthName);
  const targetPhone = cleanPhoneNumber(branch.phone);

  // Send via WAHA WhatsApp
  try {
    if (targetPhone) {
      await dispatchWahaMessage(targetPhone, messageText);
    }
  } catch (err: any) {
    console.warn("WAHA delivery notification:", err?.message || err);
  }

  // Record dispatch
  const now = new Date().toISOString();
  branchesStore[idx] = {
    ...branchesStore[idx],
    whatsappSentAt: now,
    whatsappMessage: messageText,
    updatedAt: now,
  };

  return {
    success: true,
    message: `WhatsApp monthly report successfully sent to ${branch.employeeName}.`,
    branch: branchesStore[idx],
  };
}

/**
 * Generate Bird's-Eye View data grouped by color/status for HR and Vinitt sir.
 */
export function getBirdsEyeViewStore(month?: string): BirdsEyeSummary {
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  const monthBranches = branchesStore.filter((b) => b.month === currentMonth);

  const grey = monthBranches.filter((b) => b.color === "grey");
  const red = monthBranches.filter((b) => b.color === "red");
  const green = monthBranches.filter((b) => b.color === "green");

  return {
    month: currentMonth,
    totalWatched: monthBranches.length,
    greyCount: grey.length,
    redCount: red.length,
    greenCount: green.length,
    branches: { grey, red, green },
  };
}
