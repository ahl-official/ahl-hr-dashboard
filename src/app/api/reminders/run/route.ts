import { NextRequest, NextResponse } from "next/server";
import { getAllEmployees, getAllMeetings } from "@/lib/store";
import { buildDigest, buildReminders } from "@/lib/reminders";
import { reminderConfig, sendWhatsApp } from "@/lib/waha";

export const dynamic = "force-dynamic";

/** Scheduled daily run (Vercel Cron calls GET with Authorization: Bearer $CRON_SECRET). */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const cfg = await reminderConfig();
  if (!cfg.enabled) return NextResponse.json({ success: true, skipped: "REMINDERS_ENABLED is not true" });
  if (!cfg.recipients.length) return NextResponse.json({ success: false, error: "No recipients configured" }, { status: 400 });

  try {
    const [employees, meetings] = await Promise.all([getAllEmployees(), getAllMeetings()]);
    const items = buildReminders(employees, meetings);
    const message = buildDigest(items);
    if (!message) return NextResponse.json({ success: true, sent: 0, note: "Nothing due" });

    const results = await Promise.allSettled(cfg.recipients.map((n) => sendWhatsApp(n, message)));
    const failed = results.filter((r) => r.status === "rejected").length;
    return NextResponse.json({ success: failed === 0, reminders: items.length, sent: results.length - failed, failed }, { status: failed ? 502 : 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Run failed" }, { status: 500 });
  }
}

export { run as GET, run as POST };
