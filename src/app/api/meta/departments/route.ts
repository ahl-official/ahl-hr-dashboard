import { NextResponse } from "next/server";
import { getCanonicalDepartments } from "@/lib/store";

import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getCanonicalDepartments() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to load departments" }, { status: errorStatus(error) });
  }
}
