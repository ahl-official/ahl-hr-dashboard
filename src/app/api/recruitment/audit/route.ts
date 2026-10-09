import { NextResponse } from "next/server";
import { logHireOSAudit } from "@/lib/hireos-sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateId, eventType, details } = body;

    if (!candidateId || !eventType) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    await logHireOSAudit(candidateId, eventType, details || "");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/audit:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
