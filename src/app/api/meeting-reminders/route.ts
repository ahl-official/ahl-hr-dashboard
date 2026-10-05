import { NextResponse } from "next/server";
import { targetFor } from "@/lib/meeting-reminders-sheet";
import { loadConfig, loadQueue } from "@/lib/meeting-reminders-store";

export const dynamic = "force-dynamic";

/**
 * Read-only: what the HR Calendar needs to show the monthly team meeting and the state of its reminders.
 * Settings and the tag list are edited in the sheet tabs (Reminder_Settings / Reminder_Mentions).
 */
export async function GET() {
  try {
    const [cfg, queue] = await Promise.all([loadConfig(), loadQueue()]);
    const target = targetFor(cfg);
    return NextResponse.json({
      success: true,
      now: Date.now(),
      mode: cfg.mode,
      sendsTo: target ? target.label : "not set",
      lastTickAt: cfg.lastTickAt,
      schedule: cfg.schedule,
      queue: queue.map((r) => ({ id: r.id, status: r.status, attempts: r.attempts, lastError: r.lastError, sentAt: r.sentAt })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Could not load meeting reminders" }, { status: 500 });
  }
}
