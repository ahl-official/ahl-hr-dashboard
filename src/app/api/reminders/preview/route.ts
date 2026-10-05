import { NextResponse } from "next/server";
import { getAllEmployees, getAllMeetings } from "@/lib/store";
import { buildDigest, buildReminders } from "@/lib/reminders";
import { reminderConfig } from "@/lib/waha";

export const dynamic = "force-dynamic";

/** Shows what would be sent right now. Never sends anything. */
export async function GET() {
  try {
    const [employees, meetings] = await Promise.all([getAllEmployees(), getAllMeetings()]);
    const items = buildReminders(employees, meetings);
    const cfg = reminderConfig();
    return NextResponse.json({
      success: true,
      enabled: cfg.enabled,
      recipientCount: cfg.recipients.length,
      count: items.length,
      items,
      message: buildDigest(items),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Preview failed" }, { status: 500 });
  }
}
