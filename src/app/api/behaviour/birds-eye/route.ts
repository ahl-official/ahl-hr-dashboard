import { NextResponse } from "next/server";
import { getBirdsEyeViewStore } from "@/lib/behaviour-store";
import { syncHazriAttendanceForMonth, shouldAutoSyncMonth } from "@/lib/hazri-sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    let summary = getBirdsEyeViewStore(month);

    // Auto-sync ONLY if never synced before or if 1-hour cooldown has passed
    // This strictly prevents draining Vercel CPU limits and prevents hammering Hazri Box
    if (summary.totalWatched === 0 && shouldAutoSyncMonth(month)) {
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

    return NextResponse.json(
      { success: true, data: summary },
      {
        headers: {
          // Serve from Vercel Edge Cache for 5 mins; revalidate stale in background up to 1 hr
          // Repeat tab visits are served in 5ms with ZERO serverless execution time / CPU usage
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load bird's-eye view" },
      { status: 500 }
    );
  }
}
