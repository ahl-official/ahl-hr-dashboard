import { NextRequest, NextResponse } from "next/server";
import { buildMessage, buildQueue, decide, ymdFromIso } from "@/lib/meeting-reminders";
import { targetFor } from "@/lib/meeting-reminders-sheet";
import { addMissingToQueue, appendLog, loadConfig, loadMentions, loadQueue, touchHeartbeat, updateQueueRow } from "@/lib/meeting-reminders-store";
import { sendWahaText } from "@/lib/waha";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SENDS_PER_TICK = 8;

/**
 * Called every 5 minutes by a timer. Queues the upcoming meetings' reminders, then sends whatever is due.
 * Auth: "Authorization: Bearer <CRON_SECRET>". Add ?dry=1 to see what WOULD happen without sending or writing.
 */
async function tick(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const now = Date.now();
  try {
    const cfg = await loadConfig();
    const target = targetFor(cfg);
    let queue = await loadQueue();
    const wanted = buildQueue(now, cfg.schedule);
    let queued = 0;
    if (!dry) {
      queued = await addMissingToQueue(wanted, new Set(queue.map((r) => r.id)), cfg.mode);
      if (queued) queue = await loadQueue();
    }

    const mentions = await loadMentions();
    const report: Array<{ id: string; action: string; detail?: string }> = [];
    let sends = 0;

    for (const row of queue) {
      const d = decide(row, now, cfg.schedule);
      if (d.action === "skip" || d.action === "wait") continue;

      if (d.action === "missed") {
        report.push({ id: row.id, action: "missed", detail: d.reason });
        if (!dry) {
          await updateQueueRow(row.rowNumber, { mode: row.mode, status: "Missed", sentAt: "", attempts: row.attempts + 1, lastError: d.reason ?? "" });
          await appendLog({ id: row.id, month: row.monthLabel, type: row.type, target: target?.chatId ?? "", mode: cfg.mode, mentions: "", message: "", status: "Missed", response: "", error: d.reason ?? "" });
        }
        continue;
      }

      // send
      if (!target) { report.push({ id: row.id, action: "blocked", detail: cfg.mode === "PROD" ? "LIVE_GROUP_ID is not set" : "TEST_NUMBER is not set" }); continue; }
      if (sends >= MAX_SENDS_PER_TICK) { report.push({ id: row.id, action: "deferred", detail: "send limit for this run" }); continue; }
      const body = buildMessage(row.type, ymdFromIso(row.meetingDate), row.meetingTime, mentions.numbers);
      const text = cfg.mode === "PROD" ? body : `*[TEST - this would go to the group]*\n\n${body}`;
      if (dry) { report.push({ id: row.id, action: "would send", detail: target.label }); continue; }
      sends++;
      // claim it first so an overlapping run cannot send the same reminder a second time
      await updateQueueRow(row.rowNumber, { mode: cfg.mode, status: "Sending", sentAt: new Date().toISOString(), attempts: row.attempts, lastError: "" });
      try {
        const response = await sendWahaText({ chatId: target.chatId, text, mentions: cfg.mode === "PROD" ? mentions.ids : [] });
        await updateQueueRow(row.rowNumber, { mode: cfg.mode, status: "Sent", sentAt: new Date().toISOString(), attempts: row.attempts + 1, lastError: "" });
        await appendLog({ id: row.id, month: row.monthLabel, type: row.type, target: target.chatId, mode: cfg.mode, mentions: mentions.ids.join(", "), message: text, status: "Sent", response, error: "" });
        report.push({ id: row.id, action: "sent", detail: target.label });
      } catch (e: any) {
        const error = String(e?.message ?? e);
        await updateQueueRow(row.rowNumber, { mode: cfg.mode, status: "Failed", sentAt: "", attempts: row.attempts + 1, lastError: error });
        await appendLog({ id: row.id, month: row.monthLabel, type: row.type, target: target.chatId, mode: cfg.mode, mentions: mentions.ids.join(", "), message: text, status: "Failed", response: "", error });
        report.push({ id: row.id, action: "failed", detail: error.slice(0, 160) });
      }
    }

    if (!dry) await touchHeartbeat();
    return NextResponse.json({ success: true, dry, mode: cfg.mode, target: target?.label ?? "NOT SET", queued, processed: report.length, report });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Tick failed" }, { status: 500 });
  }
}

export { tick as GET, tick as POST };
