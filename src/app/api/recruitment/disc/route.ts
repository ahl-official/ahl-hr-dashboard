import { NextResponse } from "next/server";
import { getPsychometricResult, sendPsychometricTestLink } from "@/lib/hireos-sheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const entityType = url.searchParams.get("entityType") || "Candidate";

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    const data = await getPsychometricResult(id, entityType);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/disc:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load DISC result" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    const data = await sendPsychometricTestLink(id);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/disc:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to send DISC link" },
      { status: 500 }
    );
  }
}
