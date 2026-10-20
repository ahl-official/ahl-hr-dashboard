import type { FmsRequisition } from "@/types/fms";
import { getAllRequisitions, createRequisition, updateRequisition } from "./fms-sheets";
import extractedData from "./fms-extracted-data.json";

// In-memory cache for fast local access and mutations
let cachedRequisitions: FmsRequisition[] | null = null;

function parseRequisitionsFromExtractedData(): FmsRequisition[] {
  const rows = (extractedData as any)["Requisitions"] || [];
  if (!rows || rows.length <= 1) return [];

  const headers = (rows[0] as string[]).map((h) => String(h || "").trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name.toLowerCase());

  const idCol = idx("id");
  const titleCol = idx("job title");
  const deptCol = idx("department");
  const mgrCol = idx("hiring manager");
  const levelCol = idx("job level");
  const typeCol = idx("employment type");
  const locCol = idx("location");
  const deadCol = idx("deadline");
  const reasonCol = idx("reason");
  const statusCol = idx("status");
  const dateCol = idx("created date");
  const hiredCol = idx("hired date");
  const brandCol = idx("brand");
  const minExpCol = idx("min exp");
  const maxExpCol = idx("max exp");
  const openingsCol = idx("openings");
  const budgetCol = idx("budget");
  const workLocCol = idx("work location");
  const skillsCol = idx("required skills");
  const recruiterCol = idx("recruiter name");
  const priorityCol = idx("priority");
  const targetCol = idx("target start");
  const descCol = idx("job description");
  const notesCol = idx("notes");

  const list: FmsRequisition[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[idCol] || "").trim();
    if (!id) continue;

    list.push({
      id,
      jobTitle: String(row[titleCol] || "").trim() || "Untitled Position",
      department: String(row[deptCol] || "").trim() || "Operations",
      hiringManager: String(row[mgrCol] || "").trim(),
      jobLevel: String(row[levelCol] || "").trim() || "Mid",
      employmentType: String(row[typeCol] || "").trim() || "Full-time",
      location: String(row[locCol] || "").trim() || "Mumbai",
      deadline: String(row[deadCol] || "").trim(),
      reason: String(row[reasonCol] || "").trim() || "Replacement",
      status: (String(row[statusCol] || "Open").trim() as any) || "Open",
      createdDate: String(row[dateCol] || "").trim() || new Date().toISOString().slice(0, 10),
      hiredDate: String(row[hiredCol] || "").trim(),
      brand: (String(row[brandCol] || "ahl").trim().toLowerCase() as any) || "ahl",
      minExp: String(row[minExpCol] || "0").trim(),
      maxExp: String(row[maxExpCol] || "3").trim(),
      openings: Number(row[openingsCol]) || 1,
      budget: String(row[budgetCol] || "").trim(),
      workLocation: String(row[workLocCol] || "").trim(),
      requiredSkills: String(row[skillsCol] || "").trim(),
      recruiterName: String(row[recruiterCol] || "").trim(),
      priority: (String(row[priorityCol] || "Medium").trim() as any) || "Medium",
      targetStart: String(row[targetCol] || "").trim(),
      jobDescription: String(row[descCol] || "").trim(),
      notes: String(row[notesCol] || "").trim(),
    });
  }

  return list;
}

/**
 * Initializes and returns all job requisitions from cache, sheet, or seed snapshot.
 */
export async function getFmsRequisitionsStore(): Promise<FmsRequisition[]> {
  if (cachedRequisitions) {
    return cachedRequisitions;
  }

  try {
    const sheetData = await getAllRequisitions();
    if (sheetData && sheetData.length > 0) {
      cachedRequisitions = sheetData;
      return cachedRequisitions;
    }
  } catch (err) {
    console.warn("[fms-requisitions-store] Fallback to pre-extracted data:", err);
  }

  cachedRequisitions = parseRequisitionsFromExtractedData();
  return cachedRequisitions;
}

/**
 * Returns summary metrics for all requisitions.
 */
export async function getFmsRequisitionsStats() {
  const all = await getFmsRequisitionsStore();
  const openList = all.filter((r) => r.status.toLowerCase() === "open");
  const filledList = all.filter((r) => r.status.toLowerCase() === "filled" || r.status.toLowerCase() === "closed");
  const highPriority = openList.filter((r) => r.priority.toLowerCase() === "high");
  const totalOpenings = openList.reduce((acc, r) => acc + (Number(r.openings) || 1), 0);

  return {
    total: all.length,
    open: openList.length,
    filled: filledList.length,
    highPriority: highPriority.length,
    totalOpenings,
  };
}

/**
 * Creates a new requisition, prepends to cache, and attempts to persist.
 */
export async function addFmsRequisitionStore(
  input: Omit<FmsRequisition, "id" | "createdDate">
): Promise<FmsRequisition> {
  const current = await getFmsRequisitionsStore();
  const year = new Date().getFullYear();
  const seq = current.length + 1;
  const newId = `REQ-${year}-${String(seq).padStart(3, "0")}`;
  const now = new Date().toISOString().slice(0, 10);

  const newRecord: FmsRequisition = {
    ...input,
    id: newId,
    createdDate: now,
    status: input.status || "Open",
    openings: Number(input.openings) || 1,
    priority: input.priority || "Medium",
    brand: input.brand || "ahl",
  };

  current.unshift(newRecord);
  cachedRequisitions = current;

  // Persist to Google Sheets if connected (non-blocking)
  createRequisition(newRecord).catch((err) => {
    console.warn("[fms-requisitions-store] Background sync to sheet skipped/failed:", err);
  });

  return newRecord;
}

/**
 * Updates an existing requisition's status, priority, or fields.
 */
export async function updateFmsRequisitionStore(
  id: string,
  updates: Partial<FmsRequisition>
): Promise<FmsRequisition | null> {
  const current = await getFmsRequisitionsStore();
  const index = current.findIndex((r) => r.id === id);
  if (index === -1) return null;

  current[index] = {
    ...current[index],
    ...updates,
  };
  cachedRequisitions = current;

  // Persist to Google Sheets if connected (non-blocking)
  updateRequisition(id, updates).catch((err) => {
    console.warn("[fms-requisitions-store] Background sync update skipped/failed:", err);
  });

  return current[index];
}
