import { NextResponse } from "next/server";
import { sendMonthlyWhatsAppStore } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await sendMonthlyWhatsAppStore(id, { force: Boolean(body.force) });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to dispatch WhatsApp" },
      { status: 400 }
    );
  }
}
