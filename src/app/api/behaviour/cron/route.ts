import { NextRequest, NextResponse } from "next/server";
import { syncHazriAttendanceForMonth } from "@/lib/hazri-sync-service";

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

    const result = await syncHazriAttendanceForMonth(year, month);

    return NextResponse.json({
      success: true,
      message: "Monthly behaviour evaluation completed",
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}

export { handleCron as GET, handleCron as POST };
