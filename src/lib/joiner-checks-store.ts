import "server-only";

import { appendBelow, ensureSheet, getValues, updateValues } from "./google-sheets";
import {
  JOINER_CHECKS_HEADERS,
  JOINER_CHECKS_LAST_COLUMN,
  JOINER_CHECKS_TAB,
  joinerCheckToRow,
  parseJoinerCheckRows,
  type JoinerCheckRecord,
} from "./joiner-checks-rules.ts";

export async function loadJoinerCheckRecords() {
  try {
    return parseJoinerCheckRows(await getValues(`${JOINER_CHECKS_TAB}!A:${JOINER_CHECKS_LAST_COLUMN}`));
  } catch {
    // The tab is created on the first recorded check.
    return [];
  }
}

/** Inserts or replaces the record for one employee's check (one row per Check_ID). */
export async function saveJoinerCheckRecord(record: JoinerCheckRecord): Promise<JoinerCheckRecord> {
  await ensureSheet(JOINER_CHECKS_TAB, JOINER_CHECKS_HEADERS);
  // Tabs created before the rating columns existed get the new headers added on the right.
  const header = (await getValues(`${JOINER_CHECKS_TAB}!1:1`))[0] || [];
  if (header.length < JOINER_CHECKS_HEADERS.length) {
    await updateValues(`${JOINER_CHECKS_TAB}!A1:${JOINER_CHECKS_LAST_COLUMN}1`, [JOINER_CHECKS_HEADERS]);
  }
  const existing = (await loadJoinerCheckRecords()).find((r) => r.checkId === record.checkId);
  const row = joinerCheckToRow(record);
  if (existing) {
    await updateValues(`${JOINER_CHECKS_TAB}!A${existing.rowNumber}:${JOINER_CHECKS_LAST_COLUMN}${existing.rowNumber}`, [row]);
  } else {
    await appendBelow(JOINER_CHECKS_TAB, JOINER_CHECKS_LAST_COLUMN, [row]);
  }
  return record;
}
