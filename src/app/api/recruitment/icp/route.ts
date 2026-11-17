import { NextResponse } from "next/server";
import { getAllICPs, savePositionKit } from "@/lib/hireos-sheets";
import { applyKitEdit, approveKit, normalizeKit } from "@/lib/position-kit";

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

/**
 * Position Kits.
 * { action: "save", icpId?, roleName, status, kit } creates or edits one (an edit to an approved kit
 * starts a new draft version); { action: "approve", icpId, approvedBy } records the department head's approval.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const all = await getAllICPs();
    const now = new Date().toISOString();

    if (body.action === "approve") {
      const rec = all.find((i) => i.icpId === body.icpId);
      if (!rec) return NextResponse.json({ success: false, message: "Position Kit not found" }, { status: 404 });
      let approved;
      try {
        approved = approveKit(rec, String(body.approvedBy || ""), now);
      } catch (e: any) {
        return NextResponse.json({ success: false, message: e.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: await savePositionKit(approved) });
    }

    const roleName = String(body.roleName || "").trim();
    if (!roleName) {
      return NextResponse.json({ success: false, message: "Position name is required" }, { status: 400 });
    }
    const status = body.status === "inactive" ? "inactive" : "active";
    const prev = body.icpId ? all.find((i) => i.icpId === body.icpId) || null : null;
    if (body.icpId && !prev) {
      return NextResponse.json({ success: false, message: "Position Kit not found" }, { status: 404 });
    }
    // Two active kits for one position would make CV screening pick one at random.
    const clash = all.find(
      (i) => i.icpId !== prev?.icpId && i.status === "active" && i.roleName.trim().toLowerCase() === roleName.toLowerCase()
    );
    if (status === "active" && clash) {
      return NextResponse.json(
        { success: false, message: `An active Position Kit for "${clash.roleName}" already exists. Edit that one instead.` },
        { status: 409 }
      );
    }

    const saved = await savePositionKit(applyKitEdit(prev, { roleName, status, kit: normalizeKit(body.kit) }, now));
    return NextResponse.json({ success: true, data: saved, icp: saved });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/icp:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save Position Kit" },
      { status: 500 }
    );
  }
}
