import { NextResponse } from "next/server";
import { batchDispatchMonthlyWhatsApp } from "@/lib/hazri-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const month = body.month || new Date().toISOString().slice(0, 7);

    const result = await batchDispatchMonthlyWhatsApp(month);

    return NextResponse.json({
      success: true,
      month,
      ...result,
      message: `Dispatched ${result.sent} of ${result.total} WhatsApp reports with 1.2s safety interval.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Batch WhatsApp dispatch failed",
      },
      { status: 500 }
    );
  }
}
