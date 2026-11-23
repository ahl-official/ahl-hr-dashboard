import { NextResponse } from "next/server";
import { getBranchByIdStore } from "@/lib/behaviour-store";
import { buildHrTalkDossier } from "@/lib/behaviour-rules";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const branch = getBranchByIdStore(id);
    if (!branch) {
      return NextResponse.json(
        { success: false, error: `Branch ${id} not found.` },
        { status: 404 }
      );
    }

    const hrDossier = buildHrTalkDossier(branch);
    return NextResponse.json({ success: true, branch, hrDossier });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load branch" },
      { status: 500 }
    );
  }
}
