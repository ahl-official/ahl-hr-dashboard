import { NextResponse } from "next/server";
import { getCandidateDetails } from "@/lib/hireos-sheets";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    const candidate = await getCandidateDetails(id);
    if (!candidate) {
      return NextResponse.json({ success: false, message: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: candidate,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/candidates/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load candidate" },
      { status: 500 }
    );
  }
}
