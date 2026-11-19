import { NextRequest, NextResponse } from "next/server";
import { getAllEmployees, getEmployeeByKey } from "@/lib/store";
import { loadJoinerCheckRecords, saveJoinerCheckRecord } from "@/lib/joiner-checks-store";
import {
  buildJoinerSchedule,
  joinerCheckDueDate,
  joinerCheckId,
  validateJoinerCheckInput,
  rating,
  type JoinerCheckId,
} from "@/lib/joiner-checks-rules";
import { getTodayLocalIsoDate } from "@/lib/date-utils";
import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** New joiners with their Day 1 / Day 6 / 2 Weeks / 1 Month checks and what has been recorded. */
export async function GET() {
  try {
    const [employees, records] = await Promise.all([getAllEmployees(), loadJoinerCheckRecords()]);
    return NextResponse.json({ success: true, data: buildJoinerSchedule(employees, records) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load joiner checks" },
      { status: errorStatus(error) }
    );
  }
}

/** Records (or corrects) one check for one employee. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = {
      check: String(body.check || "") as JoinerCheckId,
      completedOn: String(body.completedOn || ""),
      result: String(body.result || ""),
      managerFeedback: String(body.managerFeedback || ""),
      ratings: (body.ratings && typeof body.ratings === "object" ? body.ratings : {}) as Record<string, unknown>,
    };
    const problem = validateJoinerCheckInput(input, getTodayLocalIsoDate());
    if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

    const employee = await getEmployeeByKey(String(body.employeeKey || ""));
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });

    const record = await saveJoinerCheckRecord({
      checkId: joinerCheckId(employee.employeeKey, input.check),
      employeeKey: employee.employeeKey,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      designation: employee.designation,
      department: employee.department,
      manager: employee.manager,
      doj: employee.doj,
      check: input.check,
      dueDate: joinerCheckDueDate(employee.doj, input.check),
      completedOn: input.completedOn,
      result: input.result,
      score: String(body.score || "").trim(),
      testUsed: String(body.testUsed || "").trim(),
      managerFeedback: input.managerFeedback.trim(),
      evaluatedBy: String(body.evaluatedBy || "").trim(),
      notes: String(body.notes || "").trim(),
      ratings: {
        learning: rating(input.ratings.learning),
        practicalSkills: rating(input.ratings.practicalSkills),
        workQuality: rating(input.ratings.workQuality),
        performance: rating(input.ratings.performance),
      },
      recordedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save joiner check" },
      { status: errorStatus(error) }
    );
  }
}
