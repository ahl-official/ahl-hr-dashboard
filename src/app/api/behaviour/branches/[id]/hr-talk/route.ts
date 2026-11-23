import { NextResponse } from "next/server";
import { recordHrTalkStore } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.notes) {
      return NextResponse.json(
        { success: false, error: "Meeting notes are required to log HR talk." },
        { status: 400 }
      );
    }

    const updated = recordHrTalkStore(id, body.notes);
    return NextResponse.json({ success: true, branch: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to log HR talk" },
      { status: 500 }
    );
  }
}
