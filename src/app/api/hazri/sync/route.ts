import { NextResponse } from "next/server";
import { getHazriEmployees, getHazriTodayStatus } from "@/lib/hazri-api";
import { syncHazriAttendanceForMonth } from "@/lib/hazri-sync-service";

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

    const result = await syncHazriAttendanceForMonth(year, month);

    return NextResponse.json({
      success: true,
      ...result,
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
