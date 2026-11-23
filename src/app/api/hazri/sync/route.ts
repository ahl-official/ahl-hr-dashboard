import { NextResponse } from "next/server";
import { getHazriEmployees, getHazriLateSummary, getHazriTodayStatus } from "@/lib/hazri-api";
import { evaluateAndSaveBranch, getBranchesStore } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [employees, today] = await Promise.all([
      getHazriEmployees(),
      getHazriTodayStatus(),
    ]);

    return NextResponse.json({
      success: true,
      message: "Connected to Hazri Box successfully",
      employeeCount: employees.length,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        department: e.department,
        branch: e.branch,
        designation: e.designation,
      })),
      todayOverview: today,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to connect to Hazri Box",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const year = Number(body.year) || now.getFullYear();
    const month = Number(body.month) || now.getMonth() + 1;

    const employees = await getHazriEmployees();

    // Fetch late summary for active employees in batches to prevent overwhelming the server
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

    return NextResponse.json({
      success: true,
      year,
      month,
      totalEmployees: results.length,
      branchesEvaluated: createdOrUpdatedBranches,
      lateSummary: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to sync Hazri Box attendance",
      },
      { status: 500 }
    );
  }
}
