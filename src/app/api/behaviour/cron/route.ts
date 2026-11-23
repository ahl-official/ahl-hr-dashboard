import { NextRequest, NextResponse } from "next/server";
import { getHazriEmployees, getHazriLateSummary } from "@/lib/hazri-api";
import { evaluateAndSaveBranch, getBranchesStore } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly Behaviour Tracker Cron.
 * Scheduled to run on the 1st of every month via Vercel Cron.
 * Evaluates the completed prior month's attendance punches against the >=6 late marks threshold
 * and creates or updates Grey (Watching), Red (Repeat), and Green (Improved) branches.
 */
async function handleCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Default to the previous month (the one just completed)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = Number(req.nextUrl.searchParams.get("year")) || prevMonthDate.getFullYear();
    const month = Number(req.nextUrl.searchParams.get("month")) || prevMonthDate.getMonth() + 1;

    const employees = await getHazriEmployees();
    const batchSize = 10;
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

    return NextResponse.json({
      success: true,
      message: "Monthly behaviour evaluation completed",
      evaluatedMonth: monthKey,
      totalEmployees: results.length,
      branchesEvaluated: createdOrUpdatedBranches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}

export { handleCron as GET, handleCron as POST };
