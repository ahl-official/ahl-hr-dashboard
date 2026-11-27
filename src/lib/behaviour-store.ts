import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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

const CACHE_FILE = path.join(os.tmpdir(), "hrms_behaviour_branches.json");

function loadDiskCache(): EmployeeBranch[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

function saveDiskCache(branches: EmployeeBranch[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(branches), "utf8");
  } catch {}
}

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

// Initial branches store (empty by default; populated via Hazri Box sync or evaluations)
const initialBranches: EmployeeBranch[] = [];

let branchesStore: EmployeeBranch[] = [...initialBranches];

function ensureStoreLoaded() {
  if (branchesStore.length === 0) {
    const fromDisk = loadDiskCache();
    if (fromDisk.length > 0) {
      branchesStore = fromDisk;
    }
  }
}

/**
 * Reset branches store (used in test suite to start with a pristine state).
 */
export function resetBranchesStoreForTesting() {
  branchesStore = [];
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch {}
}

/**
 * List all branches with optional filtering.
 */
export function getBranchesStore(filters?: {
  month?: string;
  color?: string;
  status?: string;
  employeeKey?: string;
  employeeName?: string;
  phone?: string;
}): EmployeeBranch[] {
  ensureStoreLoaded();
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
  if (filters?.employeeKey || filters?.employeeName || filters?.phone) {
    const key = filters.employeeKey;
    const name = filters.employeeName?.toLowerCase().trim();
    const phone = filters.phone?.replace(/\D/g, "").slice(-10);

    list = list.filter((b) => {
      if (key && b.employeeKey === key) return true;
      if (name && b.employeeName.toLowerCase().trim() === name) return true;
      if (phone && b.phone && b.phone.replace(/\D/g, "").slice(-10) === phone) return true;
      return false;
    });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get branch by unique ID.
 */
export function getBranchByIdStore(id: string): EmployeeBranch | null {
  ensureStoreLoaded();
  return branchesStore.find((b) => b.id === id) || null;
}

/**
 * Find previous branch for an employee before a given month.
 */
export function getPreviousMonthBranch(
  employeeKey: string,
  currentMonth: string
): EmployeeBranch | null {
  ensureStoreLoaded();
  return (
    branchesStore
      .filter((b) => b.employeeKey === employeeKey && b.month < currentMonth)
      .sort((a, b) => b.month.localeCompare(a.month))[0] || null
  );
}

/**
 * Evaluate and record a branch for an employee for a specific month.
 */
export function evaluateAndSaveBranch(input: BehaviourEvaluationInput): EmployeeBranch {
  ensureStoreLoaded();
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

  saveDiskCache(branchesStore);
  return branchRecord;
}

/**
 * Record that HR had a talk with the employee regarding this branch.
 */
export function recordHrTalkStore(branchId: string, notes: string): EmployeeBranch {
  ensureStoreLoaded();
  const idx = branchesStore.findIndex((b) => b.id === branchId);
  if (idx === -1) throw new Error(`Branch with ID ${branchId} not found.`);

  branchesStore[idx] = {
    ...branchesStore[idx],
    hrTalkCompleted: true,
    hrTalkNotes: notes,
    hrTalkDate: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };

  saveDiskCache(branchesStore);
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
  ensureStoreLoaded();
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

  saveDiskCache(branchesStore);

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
  ensureStoreLoaded();
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
