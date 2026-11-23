import { NextResponse } from "next/server";
import { getBirdsEyeViewStore } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || undefined;
    const summary = getBirdsEyeViewStore(month);
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load bird's-eye view" },
      { status: 500 }
    );
  }
}
