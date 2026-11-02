// Rebuilds the "Candidate FMS" tab in the layout defined by src/lib/candidate-fms-schema.ts
// (Planned | Actual | Status | stage fields | Time Delay per stage), carrying existing rows over.
// A dated backup copy of the tab is made first.
// Usage: node --experimental-strip-types scripts/migrate-candidate-fms.mjs [--dry-run]
import { sheetsApi } from "./_sheets-auth.mjs";
import { formatCandidateFms } from "./format-candidate-fms.mjs";
import {
  CANDIDATE_FMS_TAB,
  CANDIDATE_FMS_HEADERS,
  candidateFmsIndex,
  rowToCandidateFields,
  candidateToRow,
} from "../src/lib/candidate-fms-schema.ts";

const dryRun = process.argv.includes("--dry-run");
const tab = encodeURIComponent(CANDIDATE_FMS_TAB);

const meta = await sheetsApi("?fields=sheets(properties(sheetId,title,gridProperties))");
const sheet = meta.sheets.find((s) => s.properties.title === CANDIDATE_FMS_TAB);
if (!sheet) throw new Error(`Tab "${CANDIDATE_FMS_TAB}" not found`);
const { sheetId, gridProperties } = sheet.properties;

const { values = [] } = await sheetsApi(`/values/${tab}!A:ZZ?valueRenderOption=UNFORMATTED_VALUE`);
const [oldHeader = [], ...oldRows] = values;

// In the old layout "Interview Status" held the tracking status (Scheduled/Passed…),
// which the new layout calls "Interview Tracking Status".
const legacy = oldHeader.includes("Overall Status") && !oldHeader.includes("Interview Tracking Status");
const header = legacy ? oldHeader.map((h) => (h === "Interview Status" ? "Interview Tracking Status" : h)) : oldHeader;

const index = candidateFmsIndex(header);
const today = new Date().toISOString().slice(0, 10);
const newRows = oldRows
  .map((row) => rowToCandidateFields(row, index))
  .filter((c) => c.id || c.fmsId)
  .map((c) => candidateToRow(c, undefined, today));

const dropped = oldHeader.filter((h, i) => h && ![...index.values()].includes(i));
console.log(`Rows: ${oldRows.length} → ${newRows.length}`);
console.log(`Columns: ${oldHeader.length} → ${CANDIDATE_FMS_HEADERS.length}`);
console.log(`Removed columns: ${dropped.join(", ") || "none"}`);
if (dryRun) {
  console.log("\nNew header:", CANDIDATE_FMS_HEADERS.join(" | "));
  console.log("\nSample row:", JSON.stringify(newRows[0]));
  process.exit(0);
}

// 1. Backup copy of the current tab.
const backupName = `${CANDIDATE_FMS_TAB} Backup ${today}`;
if (!meta.sheets.some((s) => s.properties.title === backupName)) {
  await sheetsApi(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ duplicateSheet: { sourceSheetId: sheetId, newSheetName: backupName, insertSheetIndex: meta.sheets.length } }] }),
  });
  console.log(`Backup created: "${backupName}"`);
}

// 2. Clear, resize to the new column count, then write header + rows.
await sheetsApi(`/values/${tab}!A:ZZ:clear`, { method: "POST", body: "{}" });
const width = CANDIDATE_FMS_HEADERS.length;
const resize = [];
if (gridProperties.columnCount > width) {
  resize.push({ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: width, endIndex: gridProperties.columnCount } } });
} else if (gridProperties.columnCount < width) {
  resize.push({ appendDimension: { sheetId, dimension: "COLUMNS", length: width - gridProperties.columnCount } });
}
resize.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenColumnCount: 0 } }, fields: "gridProperties.frozenColumnCount" } });
await sheetsApi(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: resize }) });

await sheetsApi(`/values/${tab}!A1?valueInputOption=USER_ENTERED`, {
  method: "PUT",
  body: JSON.stringify({ values: [CANDIDATE_FMS_HEADERS, ...newRows] }),
});
console.log(`Wrote ${newRows.length} rows.`);

// 3. Colours, dropdowns, date formats.
await formatCandidateFms();
