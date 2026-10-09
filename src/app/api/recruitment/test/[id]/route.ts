import { NextResponse } from "next/server";
import { getCandidateTestById } from "@/lib/hireos-sheets";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    const test = await getCandidateTestById(id);
    if (!test) {
      return NextResponse.json(
        { success: false, message: "Assessment not found or invalid link." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: test,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/test/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load assessment" },
      { status: 500 }
    );
  }
}
