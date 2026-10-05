import "server-only";

import { googleRequest } from "./google-auth";

const DATABASE_ID = process.env.HR_DATABASE_SPREADSHEET_ID || "";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function databaseId() {
  if (!DATABASE_ID) throw new Error("HR_DATABASE_SPREADSHEET_ID is not configured.");
  return DATABASE_ID;
}

export async function getSpreadsheetMetadata() {
  return googleRequest<any>(`${SHEETS_BASE}/${databaseId()}?includeGridData=false`);
}

export async function getValues(range: string, render: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" = "UNFORMATTED_VALUE") {
  const url = `${SHEETS_BASE}/${databaseId()}/values/${encodeURIComponent(range)}`
    + `?majorDimension=ROWS&valueRenderOption=${render}&dateTimeRenderOption=SERIAL_NUMBER`;
  const result = await googleRequest<{ values?: unknown[][] }>(url);
  return result.values || [];
}

export async function batchGetValues(ranges: string[]) {
  const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join("&");
  const url = `${SHEETS_BASE}/${databaseId()}/values:batchGet?${query}`
    + "&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
  const result = await googleRequest<{ valueRanges?: Array<{ values?: unknown[][] }> }>(url);
  return (result.valueRanges || []).map((item) => item.values || []);
}

export async function updateValues(range: string, values: unknown[][], valueInputOption: "RAW" | "USER_ENTERED" = "RAW") {
  const url = `${SHEETS_BASE}/${databaseId()}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;
  return googleRequest<any>(url, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

export async function appendValues(range: string, values: unknown[][], valueInputOption: "RAW" | "USER_ENTERED" = "RAW") {
  const url = `${SHEETS_BASE}/${databaseId()}/values/${encodeURIComponent(range)}:append`
    + `?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`;
  return googleRequest<any>(url, {
    method: "POST",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

export async function clearValues(range: string) {
  const url = `${SHEETS_BASE}/${databaseId()}/values/${encodeURIComponent(range)}:clear`;
  return googleRequest<any>(url, { method: "POST", body: "{}" });
}

/** Creates a tab with a header row when it does not exist yet. */
export async function ensureSheet(title: string, headers: string[]) {
  const meta = await getSpreadsheetMetadata();
  if ((meta.sheets || []).some((s: any) => s.properties?.title === title)) return;
  try {
    await googleRequest<any>(`${SHEETS_BASE}/${databaseId()}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
  } catch (e: any) {
    if (!/already exists/i.test(String(e?.message))) throw e; // created by a concurrent request
    return;
  }
  await updateValues(`${title}!A1`, [headers]);
}

/**
 * Writes rows directly below the last used row of column A, with explicit coordinates. Unlike the "append" call
 * this cannot be thrown off by blank rows inside the tab. Only for tabs with a single writer.
 */
export async function appendBelow(tab: string, lastColumn: string, rows: unknown[][]) {
  if (!rows.length) return;
  const colA = await getValues(`${tab}!A:A`);
  const start = colA.length + 1;
  await updateValues(`${tab}!A${start}:${lastColumn}${start + rows.length - 1}`, rows);
}

export function serialToIsoDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "").trim();
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
  return date.toISOString().slice(0, 10);
}

export function serialToIsoDateTime(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
  }
  return new Date(Math.round(Date.UTC(1899, 11, 30) + value * 86400000 - 330 * 60000)).toISOString();
}

