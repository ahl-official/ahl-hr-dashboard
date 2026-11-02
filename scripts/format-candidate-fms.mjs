// Formats the "Candidate FMS" tab of the HR System FMS Database from the shared schema:
// bold header row, one colour per stage block (header + light column tint), block dividers,
// date formats, dropdowns that match the web app's select options, and a yellow box on every
// Time Delay cell where the actual date missed the planned date.
// Usage: node --experimental-strip-types scripts/format-candidate-fms.mjs
import { sheetsApi } from "./_sheets-auth.mjs";
import { CANDIDATE_FMS_TAB, CANDIDATE_FMS_COLUMNS, columnLetter } from "../src/lib/candidate-fms-schema.ts";
import { FMS_CANDIDATE_STAGES } from "../src/types/fms.ts";

// Same hues as the app's stage colours, darkened for white header text.
const PALETTE = {
  profile: { name: "Candidate Profile", header: "#1F2937", tint: null },
  ar: { header: "#0284C7", tint: "#E0F2FE" },
  ps: { header: "#B45309", tint: "#FEF3C7" },
  cc: { header: "#7C3AED", tint: "#EDE9FE" },
  jo: { header: "#0F766E", tint: "#CCFBF1" },
  doc: { header: "#4338CA", tint: "#E0E7FF" },
  ob: { header: "#15803D", tint: "#DCFCE7" },
  system: { name: "System", header: "#6B7280", tint: "#F3F4F6" },
};
const STAGE_STATUSES = ["Pending", "In Progress", "Completed", "Overdue", "Dropped"];
const DELAY_FILL = { bg: "#FDE047", text: "#713F12" };

const rgb = (hex) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
});
const groupOf = (col) => (col.kind === "profile" ? col.group : col.kind === "json" ? "system" : col.stage);

export async function formatCandidateFms() {
  const meta = await sheetsApi("?fields=sheets(properties(sheetId,title,gridProperties),conditionalFormats)");
  const sheet = meta.sheets.find((s) => s.properties.title === CANDIDATE_FMS_TAB);
  if (!sheet) throw new Error(`Tab "${CANDIDATE_FMS_TAB}" not found`);
  const { sheetId, gridProperties } = sheet.properties;
  const rowCount = gridProperties.rowCount;

  const headers = (await sheetsApi(`/values/${encodeURIComponent(`${CANDIDATE_FMS_TAB}!1:1`)}`)).values[0];
  const expected = CANDIDATE_FMS_COLUMNS.map((c) => c.header);
  if (headers.join("|") !== expected.join("|")) {
    throw new Error("Header row does not match the schema — run scripts/migrate-candidate-fms.mjs first.");
  }

  const body = (start, end) => ({ sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: start, endColumnIndex: end });
  const requests = [
    // Reset previous formatting, borders and dropdowns so re-runs are clean.
    { repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } },
    { setDataValidation: { range: { sheetId, startRowIndex: 1 } } },
    // Highest index first so the remaining indexes stay valid while deleting.
    ...(sheet.conditionalFormats || []).map((_, i, all) => ({ deleteConditionalFormatRule: { sheetId, index: all.length - 1 - i } })),
  ];

  // Contiguous runs of the same group.
  const runs = [];
  CANDIDATE_FMS_COLUMNS.forEach((col, i) => {
    const g = groupOf(col);
    const last = runs[runs.length - 1];
    if (last && last.group === g) last.end = i + 1;
    else runs.push({ group: g, start: i, end: i + 1 });
  });

  for (const { group, start, end } of runs) {
    const p = PALETTE[group];
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: start, endColumnIndex: end },
        cell: {
          userEnteredFormat: {
            backgroundColor: rgb(p.header),
            textFormat: { bold: true, foregroundColor: rgb("#FFFFFF") },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    });
    if (p.tint) {
      requests.push({
        repeatCell: { range: body(start, end), cell: { userEnteredFormat: { backgroundColor: rgb(p.tint) } }, fields: "userEnteredFormat.backgroundColor" },
      });
    }
    if (start > 0) {
      requests.push({
        updateBorders: {
          range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: start, endColumnIndex: start + 1 },
          left: { style: "SOLID_THICK", color: rgb(p.header) },
        },
      });
    }
    const label = p.name || FMS_CANDIDATE_STAGES.find((s) => s.id === group).name;
    console.log(`${label.padEnd(22)} cols ${start + 1}-${end}`);
  }

  CANDIDATE_FMS_COLUMNS.forEach((col, i) => {
    if (col.date) {
      requests.push({
        repeatCell: {
          range: body(i, i + 1),
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: col.kind === "profile" ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }

    if (col.kind === "stage" && col.part === "delayDays") {
      // Delay cells read "3 days late" / "2 days overdue" (or a legacy number > 0).
      const ref = `${columnLetter(i + 1)}2`;
      requests.push({
        addConditionalFormatRule: {
          index: 0,
          rule: {
            ranges: [body(i, i + 1)],
            booleanRule: {
              condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=OR(REGEXMATCH(TO_TEXT(${ref}),"late|overdue"),AND(ISNUMBER(${ref}),${ref}>0))` }] },
              format: { backgroundColor: rgb(DELAY_FILL.bg), textFormat: { bold: true, foregroundColor: rgb(DELAY_FILL.text) } },
            },
          },
        },
      });
      requests.push({
        repeatCell: { range: body(i, i + 1), cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat.horizontalAlignment" },
      });
    }

    let options = null;
    if (col.kind === "stage" && col.part === "status") options = STAGE_STATUSES;
    if (col.kind === "field") {
      options = FMS_CANDIDATE_STAGES.find((s) => s.id === col.stage).fields.find((f) => f.key === col.key).opts || null;
    }
    if (col.kind === "profile" && col.prop === "currentStage") options = FMS_CANDIDATE_STAGES.map((s) => s.name);
    if (col.kind === "profile" && col.prop === "status") options = ["Active", "Hired", "Dropped", "Archived"];
    if (options) {
      requests.push({
        setDataValidation: {
          range: body(i, i + 1),
          rule: { condition: { type: "ONE_OF_LIST", values: options.map((v) => ({ userEnteredValue: v })) }, strict: false, showCustomUi: true },
        },
      });
    }
  });

  requests.push(
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 52 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: CANDIDATE_FMS_COLUMNS.length },
        properties: { pixelSize: 130 },
        fields: "pixelSize",
      },
    },
    {
      // Keep the header and Candidate ID / FMS ID / Full Name visible while scrolling across stages.
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 3 } },
        fields: "gridProperties(frozenRowCount,frozenColumnCount)",
      },
    },
  );

  await sheetsApi(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  console.log(`Formatted ${CANDIDATE_FMS_COLUMNS.length} columns across ${runs.length} blocks.`);
}

// Run directly (not when imported by the migration script).
if (process.argv[1]?.endsWith("format-candidate-fms.mjs")) {
  formatCandidateFms().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
