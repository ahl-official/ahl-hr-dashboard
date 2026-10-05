import "server-only";

import { appendBelow, appendValues, ensureSheet, getValues, updateValues } from "./google-sheets";
import {
  DEFAULT_SETTINGS_ROWS, LOG_HEADERS, LOG_TAB, MENTIONS_HEADERS, MENTIONS_TAB, QUEUE_HEADERS, QUEUE_TAB, SETTINGS_HEADERS, SETTINGS_TAB,
  itemToRow, parseMentions, parseQueue, parseSettings, type MeetingReminderConfig, type QueueRow,
} from "./meeting-reminders-sheet";
import type { QueueItem } from "./meeting-reminders";

let tabsReady = false;
async function ensureTabs() {
  if (tabsReady) return;
  // the Settings tab is filled with defaults the first time it is created
  await ensureSheet(SETTINGS_TAB, SETTINGS_HEADERS);
  if ((await getValues(`${SETTINGS_TAB}!A:A`)).length <= 1) await appendValues(`${SETTINGS_TAB}!A:C`, DEFAULT_SETTINGS_ROWS);
  await ensureSheet(MENTIONS_TAB, MENTIONS_HEADERS);
  await ensureSheet(QUEUE_TAB, QUEUE_HEADERS);
  await ensureSheet(LOG_TAB, LOG_HEADERS);
  tabsReady = true;
}

export async function loadConfig(): Promise<MeetingReminderConfig> {
  await ensureTabs();
  return parseSettings(await getValues(`${SETTINGS_TAB}!A:C`));
}

export async function loadMentions() {
  await ensureTabs();
  return parseMentions(await getValues(`${MENTIONS_TAB}!A:D`));
}

export async function loadQueue(): Promise<QueueRow[]> {
  await ensureTabs();
  return parseQueue(await getValues(`${QUEUE_TAB}!A:M`));
}

/** Adds the reminders that are not in the queue yet (IDs are unique, so running twice adds nothing). */
export async function addMissingToQueue(items: QueueItem[], existingIds: Set<string>, mode: string): Promise<number> {
  const fresh = items.filter((i) => !existingIds.has(i.id));
  if (fresh.length) await appendBelow(QUEUE_TAB, "M", fresh.map((i) => itemToRow(i, mode)));
  return fresh.length;
}

export async function updateQueueRow(rowNumber: number, patch: { mode: string; status: string; sentAt: string; attempts: number; lastError: string }) {
  await updateValues(`${QUEUE_TAB}!I${rowNumber}:M${rowNumber}`, [[patch.mode, patch.status, patch.sentAt, String(patch.attempts), patch.lastError]]);
}

export async function appendLog(row: { id: string; month: string; type: string; target: string; mode: string; mentions: string; message: string; status: string; response: string; error: string }) {
  await appendBelow(LOG_TAB, "K", [[new Date().toISOString(), row.id, row.month, row.type, row.target, row.mode, row.mentions, row.message, row.status, row.response.slice(0, 500), row.error]]);
}

/** Records "the timer is alive". The dashboard shows an alert when this goes stale. */
export async function touchHeartbeat() {
  await ensureTabs();
  const rows = await getValues(`${SETTINGS_TAB}!A:A`);
  const i = rows.findIndex((r) => String(r[0] ?? "").trim() === "LAST_TICK_AT");
  if (i >= 0) await updateValues(`${SETTINGS_TAB}!B${i + 1}`, [[new Date().toISOString()]]);
}
