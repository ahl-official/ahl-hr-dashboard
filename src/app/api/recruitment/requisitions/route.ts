import { NextResponse } from "next/server";
import {
  getFmsRequisitionsStore,
  getFmsRequisitionsStats,
  addFmsRequisitionStore,
  updateFmsRequisitionStore,
} from "@/lib/fms-requisitions-store";

export async function GET() {
  try {
    const [requisitions, stats] = await Promise.all([
      getFmsRequisitionsStore(),
      getFmsRequisitionsStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        requisitions,
        stats,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/requisitions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch requisitions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if this is an update action
    if (body.action === "update" && body.id) {
      const updated = await updateFmsRequisitionStore(body.id, body.updates || {});
      if (!updated) {
        return NextResponse.json(
          { success: false, message: `Requisition ${body.id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    }

    // Default: Create Requisition
    if (!body.jobTitle || !body.department) {
      return NextResponse.json(
        { success: false, message: "Job Title and Department are required" },
        { status: 400 }
      );
    }

    const created = await addFmsRequisitionStore({
      jobTitle: body.jobTitle,
      department: body.department,
      hiringManager: body.hiringManager || "",
      jobLevel: body.jobLevel || "Mid",
      employmentType: body.employmentType || "Full-time",
      location: body.location || "Mumbai",
      deadline: body.deadline || "",
      reason: body.reason || "Growth / Expansion",
      status: body.status || "Open",
      brand: body.brand || "ahl",
      minExp: String(body.minExp || "0"),
      maxExp: String(body.maxExp || "3"),
      openings: Number(body.openings) || 1,
      budget: body.budget || "",
      workLocation: body.workLocation || "",
      requiredSkills: body.requiredSkills || "",
      recruiterName: body.recruiterName || "",
      priority: body.priority || "Medium",
      targetStart: body.targetStart || "",
      jobDescription: body.jobDescription || "",
      notes: body.notes || "",
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/requisitions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process requisition" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { success: false, message: "id and updates are required" },
        { status: 400 }
      );
    }

    const updated = await updateFmsRequisitionStore(id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: `Requisition ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in PATCH /api/recruitment/requisitions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update requisition" },
      { status: 500 }
    );
  }
}
