import { NextResponse } from "next/server";
import { getBirdsEyeViewStore } from "@/lib/behaviour-store";
import { syncHazriAttendanceForMonth } from "@/lib/hazri-sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    let summary = getBirdsEyeViewStore(month);

    // If no branches exist in store for this month yet, auto-sync from Hazri Box
    if (summary.totalWatched === 0) {
      const [yearNum, monthNum] = month.split("-").map(Number);
      if (yearNum && monthNum) {
        try {
          await syncHazriAttendanceForMonth(yearNum, monthNum);
          summary = getBirdsEyeViewStore(month);
        } catch (syncErr: any) {
          console.warn("Auto-sync from Hazri Box on birds-eye load:", syncErr?.message);
        }
      }
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load bird's-eye view" },
      { status: 500 }
    );
  }
}
