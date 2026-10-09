import { NextResponse } from "next/server";
import { getEmployeeDiscRoster, sendEmployeeDiscInvite } from "@/lib/hireos-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getEmployeeDiscRoster();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/employee-disc:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load employee DISC roster" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeId, employeeIds } = body;
    const origin = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:3000";
    const baseUrl = new URL(origin).origin;

    const idsToProcess: string[] = [];
    if (employeeId) idsToProcess.push(employeeId);
    if (Array.isArray(employeeIds)) {
      employeeIds.forEach((id) => {
        if (id && !idsToProcess.includes(id)) idsToProcess.push(id);
      });
    }

    if (idsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one employeeId is required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const id of idsToProcess) {
      try {
        const res = await sendEmployeeDiscInvite(id, baseUrl);
        results.push(res);
      } catch (err: any) {
        results.push({ success: false, employeeId: id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sentCount: results.filter((r) => r.success).length,
        results,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/employee-disc:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to send employee DISC invite" },
      { status: 500 }
    );
  }
}
