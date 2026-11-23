import { getHazriEmployees, getHazriLateSummary } from "./hazri-api";
import { evaluateAndSaveBranch, getBranchesStore } from "./behaviour-store";

export async function syncHazriAttendanceForMonth(year: number, month: number) {
  const employees = await getHazriEmployees();

  // Fast parallel batches of 20 to finish in ~1-2 seconds
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

  const monthStr = String(month).padStart(2, "0");
  const monthKey = `${year}-${monthStr}`;
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

    // If employee has >= 6 late marks OR has an active prior branch that needs improvement check
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

  return {
    year,
    month,
    monthKey,
    totalEmployees: results.length,
    branchesEvaluated: createdOrUpdatedBranches,
    lateSummary: results,
  };
}
