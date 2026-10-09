import { NextResponse } from "next/server";
import { getAllICPs, saveICP } from "@/lib/hireos-sheets";

export async function GET() {
  try {
    const icps = await getAllICPs();
    return NextResponse.json({
      success: true,
      data: icps,
      icps,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/icp:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load ICPs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roleName, status, version, icpContent, icpId } = body;

    if (!roleName) {
      return NextResponse.json({ success: false, message: "Role name is required" }, { status: 400 });
    }

    const saved = await saveICP({
      icpId,
      roleName,
      status: status || "active",
      version: version || "1.0",
      icpContent: icpContent || "",
    });

    return NextResponse.json({
      success: true,
      data: saved,
      icp: saved,
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/icp:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save ICP" },
      { status: 500 }
    );
  }
}
