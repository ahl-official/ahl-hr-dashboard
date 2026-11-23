import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { getHazriEmployees, getHazriLateSummary } from "./hazri-api";
import { evaluateAndSaveBranch, getBranchesStore } from "./behaviour-store";

// 24-Hour (1 Day) Cooldown between automated background syncs to prevent draining Vercel CPU limits & Hazri Box server
export const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours / 1 day

const SYNC_META_FILE = path.join(os.tmpdir(), "hrms_hazri_sync_meta.json");

function loadSyncMeta(): Record<string, number> {
  try {
    if (fs.existsSync(SYNC_META_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_META_FILE, "utf8")) || {};
    }
  } catch {}
  return {};
}

function saveSyncMeta(meta: Record<string, number>) {
  try {
    fs.writeFileSync(SYNC_META_FILE, JSON.stringify(meta), "utf8");
  } catch {}
}

// In-flight mutex: ensures multiple concurrent visitors share one sync job
const inFlightSyncs: Map<string, Promise<any>> = new Map();

/**
 * Checks whether an automated sync is allowed for a given month,
 * strictly enforcing the 24-hour (1 day) cooldown to protect Vercel compute limits.
 * For past months, once synced, automated background sync is never re-run.
 */
export function shouldAutoSyncMonth(monthKey: string): boolean {
  const meta = loadSyncMeta();
  const lastSync = meta[monthKey];
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Past months are historical: if synced at least once, never re-sync automatically
  if (monthKey < currentMonthKey && lastSync) {
    return false;
  }

  if (!lastSync) return true; // Never synced before
  return Date.now() - lastSync > SYNC_COOLDOWN_MS;
}

export async function syncHazriAttendanceForMonth(
  year: number,
  month: number,
  options: { force?: boolean } = {}
) {
  const monthStr = String(month).padStart(2, "0");
  const monthKey = `${year}-${monthStr}`;

  // Cooldown check for automated calls
  if (!options.force && !shouldAutoSyncMonth(monthKey)) {
    return {
      skipped: true,
      reason: "Throttled by 1-hour cooldown to protect Vercel CPU and Hazri Box server",
      monthKey,
    };
  }

  // Deduplicate in-flight requests
  if (inFlightSyncs.has(monthKey)) {
    return inFlightSyncs.get(monthKey);
  }

  const syncPromise = (async () => {
    try {
      const employees = await getHazriEmployees();

      // Fast parallel batches of 20
      const batchSize = 20;
      const results: Array<{
        id: number;
        name: string;
        phone: number | string;
        department?: string;
        branch?: string;
        working_days?: string;
        lateCount: number;
        lateDays: string[];
      }> = [];

      for (let i = 0; i < employees.length; i += batchSize) {
        const batch = employees.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (emp) => {
            try {
              const summary = await getHazriLateSummary(emp.id, year, month);
              const lateDays = Object.entries(summary.days || {})
                .filter(([_, d]) => d.is_late)
                .map(([date]) => date);

              return {
                id: emp.id,
                name: emp.name,
                phone: emp.phone,
                department: emp.department,
                branch: emp.branch,
                working_days: emp.working_days,
                lateCount: summary.late_days_count || lateDays.length,
                lateDays,
              };
            } catch {
              return {
                id: emp.id,
                name: emp.name,
                phone: emp.phone,
                department: emp.department,
                branch: emp.branch,
                working_days: emp.working_days,
                lateCount: 0,
                lateDays: [],
              };
            }
          })
        );
        results.push(...batchResults);
      }

      const previousMonthKey =
        month === 1
          ? `${year - 1}-12`
          : `${year}-${String(month - 1).padStart(2, "0")}`;

      const previousBranches = getBranchesStore({ month: previousMonthKey });
      const prevBranchEmployeeKeys = new Set(previousBranches.map((b) => b.employeeKey));

      let createdOrUpdatedBranches = 0;

      for (const res of results) {
        const empKey = `EMP-HAZRI-${res.id}`;
        const hasPriorBranch = prevBranchEmployeeKeys.has(empKey);

        if (res.lateCount >= 6 || hasPriorBranch) {
          evaluateAndSaveBranch({
            employeeKey: empKey,
            employeeId: `AHL-HZ-${String(res.id).padStart(4, "0")}`,
            employeeName: res.name,
            department: res.department || "Operations",
            company: res.branch || "American Hairline",
            phone: String(res.phone || ""),
            month: monthKey,
            lateDaysCount: res.lateCount,
            lateDays: res.lateDays,
            workingDays: res.working_days
              ? res.working_days.split(",").map((s) => s.trim())
              : undefined,
            leaveRecords: [],
            holidayDates: [],
            hrWarnings: [],
          });
          createdOrUpdatedBranches++;
        }
      }

      // Record successful sync timestamp to lock in cooldown
      const meta = loadSyncMeta();
      meta[monthKey] = Date.now();
      saveSyncMeta(meta);

      return {
        year,
        month,
        monthKey,
        totalEmployees: results.length,
        branchesEvaluated: createdOrUpdatedBranches,
        lateSummary: results,
      };
    } finally {
      inFlightSyncs.delete(monthKey);
    }
  })();

  inFlightSyncs.set(monthKey, syncPromise);
  return syncPromise;
}
