import { NextResponse } from "next/server";
import { getHireOSCandidates } from "@/lib/hireos-sheets";

export async function GET() {
  try {
    const candidates = await getHireOSCandidates();

    const total = candidates.length;
    const completed = candidates.filter((c) => c.status === "Completed").length;
    const pending = candidates.filter((c) => c.status === "Pending").length;
    const scoredList = candidates.filter((c) => c.score !== null && !isNaN(c.score));
    const avgScore =
      scoredList.length > 0
        ? Math.round(scoredList.reduce((acc, c) => acc + (c.score || 0), 0) / scoredList.length)
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        candidates,
        stats: {
          total,
          completed,
          pending,
          avgScore,
        },
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/candidates:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id, ids } = body;

    const { deleteCandidate, deleteCandidates } = await import("@/lib/hireos-sheets");

    if (id) {
      await deleteCandidate(id);
    } else if (Array.isArray(ids) && ids.length > 0) {
      await deleteCandidates(ids);
    } else {
      return NextResponse.json({ success: false, message: "ID or IDs required" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/recruitment/candidates:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
