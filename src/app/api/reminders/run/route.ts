import { NextRequest, NextResponse } from "next/server";
import { getAllEmployees, getAllMeetings } from "@/lib/store";
import { buildDigest, buildReminders } from "@/lib/reminders";
import { istParts, teamMeetingReminders, toIso } from "@/lib/meeting-reminders";
import { appendLog, hrDigestSentTo, loadConfig } from "@/lib/meeting-reminders-store";
import { hrDigestId } from "@/lib/hr-digest";
import { reminderConfig, sendWhatsApp } from "@/lib/waha";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily HR WhatsApp (Vercel Cron calls GET with Authorization: Bearer $CRON_SECRET).
 * Each person gets it at most once per day, and every attempt is written to the Reminder_Log tab.
 * Add ?dry=1 to see what would be sent without sending or writing anything.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const cfg = await reminderConfig();
  if (!cfg.enabled && !dry) return NextResponse.json({ success: true, skipped: "REMINDERS_ENABLED is not true" });
  if (!cfg.recipients.length) return NextResponse.json({ success: false, error: "No recipients configured" }, { status: 400 });

  try {
    const [employees, meetings] = await Promise.all([getAllEmployees(), getAllMeetings()]);
    const items = buildReminders(employees, meetings);
    try {
      // the monthly team meeting is part of what HR is reminded about (a sheet hiccup must not block the rest)
      items.push(...teamMeetingReminders(Date.now(), (await loadConfig()).schedule));
    } catch {}
    const message = buildDigest(items);
    if (!message) return NextResponse.json({ success: true, sent: 0, note: "Nothing due" });

    const p = istParts(Date.now());
    const id = hrDigestId(toIso({ y: p.y, m0: p.m0, d: p.d }));
    let done = new Set<string>();
    try { done = await hrDigestSentTo(id); } catch {} // if the log cannot be read, sending still goes ahead
    const todo = cfg.recipients.filter((n) => !done.has(n));
    if (dry) return NextResponse.json({ success: true, dry: true, id, reminders: items.length, willSendTo: todo.length, alreadySent: done.size, message });
    if (!todo.length) return NextResponse.json({ success: true, id, sent: 0, note: "Everyone already got today's message" });

    const results = await Promise.allSettled(todo.map((n) => sendWhatsApp(n, message)));
    let failed = 0;
    // one by one: the log is written to the next free row, so parallel writes would overwrite each other
    for (let i = 0; i < todo.length; i++) {
      const r = results[i];
      const ok = r.status === "fulfilled";
      if (!ok) failed++;
      try {
        await appendLog({
          id, month: "", type: "HR digest", target: todo[i], mode: "HR", mentions: "", message,
          status: ok ? "Sent" : "Failed", response: ok ? "accepted by WhatsApp server" : "", error: ok ? "" : String((r as PromiseRejectedResult).reason?.message ?? r.reason).slice(0, 300),
        });
      } catch {} // a logging problem must never turn a delivered message into an error
    }
    return NextResponse.json({ success: failed === 0, id, reminders: items.length, sent: todo.length - failed, failed }, { status: failed ? 502 : 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Run failed" }, { status: 500 });
  }
}

export { run as GET, run as POST };
