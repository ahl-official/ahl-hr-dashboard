import { NextResponse } from "next/server";
import { getFullDashboardData } from "@/lib/store";

import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFullDashboardData();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load dashboard data" },
      { status: errorStatus(error) }
    );
  }
}
