// Bookkeeping for the HR morning WhatsApp: one message per person per day, and a record of it. Pure (no I/O), tested.
// Rows are those of the Reminder_Log tab: [Timestamp, Reminder_ID, Month, Reminder_Type, Target, Mode, Mentions, Message, Status, Response, Error].

export const HR_DIGEST_PREFIX = "HR_DIGEST_";
export const hrDigestId = (isoDate: string) => `${HR_DIGEST_PREFIX}${isoDate}`;

const cell = (r: unknown[], i: number) => (r[i] === null || r[i] === undefined ? "" : String(r[i]).trim());

/** Phone numbers (digits) that already received the digest with this id. Used so a re-run never sends twice. */
export function alreadySentTo(logRows: unknown[][], id: string): Set<string> {
  const out = new Set<string>();
  for (const r of logRows) if (cell(r, 1) === id && cell(r, 8) === "Sent") out.add(cell(r, 4).replace(/\D/g, ""));
  return out;
}

export type DigestSummary = { date: string; at: string; sent: number; failed: number };

/** The most recent day on which an HR digest was attempted, with how many people it reached. */
export function latestDigest(logRows: unknown[][]): DigestSummary | null {
  let best: DigestSummary | null = null;
  for (const r of logRows) {
    const id = cell(r, 1);
    if (!id.startsWith(HR_DIGEST_PREFIX)) continue;
    const date = id.slice(HR_DIGEST_PREFIX.length);
    if (!best || date > best.date) best = { date, at: cell(r, 0), sent: 0, failed: 0 };
    if (date === best.date) {
      const status = cell(r, 8);
      if (status === "Sent") best.sent++;
      else if (status === "Failed") best.failed++;
      if (cell(r, 0) > best.at) best.at = cell(r, 0);
    }
  }
  return best;
}
