import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : path.join(root, "service account.json");

const DATABASE_ID = process.env.HR_DATABASE_SPREADSHEET_ID || "14P-W64goP_ZXztpSXUYuHZZXAjY2sHMFk46kaBqq8EY";
const TRACKER_ID = process.env.HR_TRACKER_SPREADSHEET_ID || "1tfLOg-Id7RZASBKwnbxjeJv_-y-e85OsyaisvwimRus";
const TRACKER_TABS = ["HR_Meetings", "HR_Documents", "HR_Status", "HR_Audit_Log"];
const DEPARTMENTS = [
  "Human Resources (HR)", "Accounts", "Video Editor", "Graphic Designer", "Digital Marketing",
  "Artificial Intelligence (AI)", "MIS Executive", "Content Writer", "Influencer Marketing",
  "Videographer", "Purchase", "Customer Service Executive", "Labour", "Maintenance", "Housekeeping",
  "Process Coordinator", "Inventory", "Floor Manager", "Business Development", "AHL Technician",
  "CRR", "ALC Technician", "Consultant", "PMU",
];

if (!fs.existsSync(credentialPath)) {
  throw new Error(`Service-account credential was not found at ${credentialPath}`);
}

const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
let accessToken = "";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  if (accessToken) return accessToken;
  const clockResponse = await fetch("https://oauth2.googleapis.com/token", { method: "HEAD" });
  const googleDate = clockResponse.headers.get("date");
  const nowSeconds = Math.floor((googleDate ? Date.parse(googleDate) : Date.now()) / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds - 30,
    exp: nowSeconds + 3300,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Google authentication failed: ${body.error_description || body.error || response.status}`);
  }
  accessToken = body.access_token;
  return accessToken;
}

async function sheetsRequest(method, suffix, data) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${suffix}`,
    {
    method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(data ? { "content-type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Sheets API ${response.status}: ${body.error?.message || response.statusText}`);
  }
  return body;
}

async function metadata(spreadsheetId) {
  return sheetsRequest("GET", `${spreadsheetId}?includeGridData=false`);
}

async function batchUpdate(spreadsheetId, requests) {
  if (!requests.length) return;
  await sheetsRequest("POST", `${spreadsheetId}:batchUpdate`, { requests });
}

async function getValues(spreadsheetId, range, valueRenderOption = "UNFORMATTED_VALUE") {
  const encoded = encodeURIComponent(range);
  return sheetsRequest(
    "GET",
    `${spreadsheetId}/values/${encoded}?majorDimension=ROWS&valueRenderOption=${valueRenderOption}&dateTimeRenderOption=SERIAL_NUMBER`,
  );
}

async function updateValues(spreadsheetId, range, values) {
  const encoded = encodeURIComponent(range);
  await sheetsRequest("PUT", `${spreadsheetId}/values/${encoded}?valueInputOption=RAW`, {
    range,
    majorDimension: "ROWS",
    values,
  });
}

function excelSerialToUtcIso(serial, timeZone) {
  const wallMs = Date.UTC(1899, 11, 30) + Number(serial) * 86400000;
  const wallDate = new Date(wallMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(wallDate);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value || 0);
  const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const wallSecond = Math.floor(wallDate.getTime() / 1000) * 1000;
  const zoneOffset = represented - wallSecond;
  return new Date(Math.round(wallMs - zoneOffset)).toISOString();
}

function normalizeKeyAnchor(value, timeZone) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToUtcIso(value, timeZone);
  }
  return String(value ?? "").trim().toLowerCase();
}

function employeeKey(timestamp, employeeId, fullName, rowNumber, timeZone) {
  let anchor = normalizeKeyAnchor(timestamp, timeZone);
  if (!anchor) {
    anchor = ["fallback", employeeId, fullName, rowNumber]
      .map((value, index) => index === 0 ? value : String(value ?? "").trim().toLowerCase())
      .join("|");
  }
  return `EMP-${crypto.createHash("sha256").update(anchor, "utf8").digest("hex").slice(0, 20).toUpperCase()}`;
}

function findHeader(headers, aliases) {
  const normalized = headers.map((value) => String(value ?? "").trim().toLowerCase());
  for (const alias of aliases) {
    const index = normalized.indexOf(alias.toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

const destination = await metadata(DATABASE_ID);
const source = await metadata(TRACKER_ID);
const destinationTabs = new Map(destination.sheets.map((sheet) => [sheet.properties.title, sheet.properties]));

const firstSheet = destination.sheets[0]?.properties;
if (!firstSheet) throw new Error("Development database has no sheet.");
if (firstSheet.title === "Sheet1") {
  await batchUpdate(DATABASE_ID, [{
    updateSheetProperties: {
      properties: { sheetId: firstSheet.sheetId, title: "Employees", gridProperties: { frozenRowCount: 1 } },
      fields: "title,gridProperties.frozenRowCount",
    },
  }]);
  destinationTabs.delete("Sheet1");
  destinationTabs.set("Employees", { ...firstSheet, title: "Employees" });
}

for (const title of TRACKER_TABS) {
  if (destinationTabs.has(title)) continue;
  const sourceSheet = source.sheets.find((sheet) => sheet.properties.title === title);
  if (!sourceSheet) throw new Error(`Source tab ${title} was not found.`);
  await sheetsRequest("POST", `${TRACKER_ID}/sheets/${sourceSheet.properties.sheetId}:copyTo`, {
    destinationSpreadsheetId: DATABASE_ID,
  });
  const refreshed = await metadata(DATABASE_ID);
  const copied = refreshed.sheets.find((sheet) => sheet.properties.title === `Copy of ${title}`)
    || refreshed.sheets.find((sheet) => !destinationTabs.has(sheet.properties.title) && !TRACKER_TABS.includes(sheet.properties.title));
  if (!copied) throw new Error(`Copied tab ${title} could not be identified.`);
  await batchUpdate(DATABASE_ID, [{
    updateSheetProperties: {
      properties: { sheetId: copied.properties.sheetId, title, gridProperties: { frozenRowCount: 1 } },
      fields: "title,gridProperties.frozenRowCount",
    },
  }]);
  destinationTabs.set(title, { ...copied.properties, title });
}

let refreshed = await metadata(DATABASE_ID);
const existingTitles = new Set(refreshed.sheets.map((sheet) => sheet.properties.title));
const additions = [];
if (!existingTitles.has("Departments")) additions.push({ addSheet: { properties: { title: "Departments", gridProperties: { frozenRowCount: 1 } } } });
if (!existingTitles.has("App_Config")) additions.push({ addSheet: { properties: { title: "App_Config", gridProperties: { frozenRowCount: 1 } } } });
await batchUpdate(DATABASE_ID, additions);

refreshed = await metadata(DATABASE_ID);
const employeesSheet = refreshed.sheets.find((sheet) => sheet.properties.title === "Employees");
if (!employeesSheet) throw new Error("Employees tab is missing.");
if ((employeesSheet.properties.gridProperties?.columnCount || 0) < 48) {
  await batchUpdate(DATABASE_ID, [{
    appendDimension: {
      sheetId: employeesSheet.properties.sheetId,
      dimension: "COLUMNS",
      length: 48 - employeesSheet.properties.gridProperties.columnCount,
    },
  }]);
}

const employeeValues = await getValues(DATABASE_ID, "Employees!A:AV");
const rows = employeeValues.values || [];
if (!rows.length) throw new Error("Employees tab has no header row.");
const headers = rows[0].map((value) => String(value ?? "").trim());
const timestampIndex = findHeader(headers, ["Timestamp"]);
const employeeIdIndex = findHeader(headers, ["Employee ID"]);
const fullNameIndex = findHeader(headers, ["Full Name"]);
if (fullNameIndex < 0) throw new Error("Full Name header was not found in Employees.");

const timeZone = destination.properties?.timeZone || "Asia/Calcutta";
const keys = rows.slice(1).map((row, index) => {
  const rowNumber = index + 2;
  const fullName = String(row[fullNameIndex] ?? "").trim();
  if (!fullName) return [""];
  return [employeeKey(
    timestampIndex >= 0 ? row[timestampIndex] : "",
    employeeIdIndex >= 0 ? row[employeeIdIndex] : "",
    fullName,
    rowNumber,
    timeZone,
  )];
});
await updateValues(DATABASE_ID, "Employees!AV1", [["Employee Key"], ...keys]);

const statuses = (await getValues(DATABASE_ID, "HR_Status!A2:C", "FORMATTED_VALUE")).values || [];
const meetings = (await getValues(DATABASE_ID, "HR_Meetings!B2:D", "FORMATTED_VALUE")).values || [];
const knownKeys = new Set(keys.flat().filter(Boolean));
const storedReferences = [...statuses, ...meetings].filter((row) => row[0]);
const invalidReferences = storedReferences.filter((row) => !knownKeys.has(String(row[0]).trim()));
if (invalidReferences.length) {
  const computedByName = new Map(rows.slice(1).map((row, index) => [
    String(row[fullNameIndex] ?? "").trim().toLowerCase(),
    {
      key: keys[index]?.[0] || "",
      timestamp: row[timestampIndex],
      anchor: normalizeKeyAnchor(row[timestampIndex], timeZone),
    },
  ]));
  console.error(JSON.stringify(invalidReferences.slice(0, 5).map((row) => ({
    storedKey: row[0],
    employeeName: row[2],
    computed: computedByName.get(String(row[2] ?? "").trim().toLowerCase()) || "not-found",
    timeZone,
  })), null, 2));
  throw new Error(`Employee-key verification failed for ${invalidReferences.length} stored HR record(s). No source data was changed.`);
}

await updateValues(DATABASE_ID, "Departments!A1:D25", [
  ["Department ID", "Department Name", "Active", "Display Order"],
  ...DEPARTMENTS.map((name, index) => [`DEPT-${String(index + 1).padStart(3, "0")}`, name, true, index + 1]),
]);
await updateValues(DATABASE_ID, "App_Config!A1:B8", [
  ["Setting", "Value"],
  ["Schema Version", "1"],
  ["Environment", "development"],
  ["Employees Sheet", "Employees"],
  ["Documents Folder ID", "1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz"],
  ["Database Spreadsheet ID", DATABASE_ID],
  ["Tracker Source ID", TRACKER_ID],
  ["Updated At", new Date().toISOString()],
]);

refreshed = await metadata(DATABASE_ID);
const formatRequests = [];
for (const title of ["Employees", ...TRACKER_TABS, "Departments", "App_Config"]) {
  const sheet = refreshed.sheets.find((item) => item.properties.title === title);
  if (!sheet) throw new Error(`Expected tab ${title} is missing after setup.`);
  formatRequests.push({
    repeatCell: {
      range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.078, green: 0.129, blue: 0.239 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  });
}
await batchUpdate(DATABASE_ID, formatRequests);

console.log(JSON.stringify({
  databaseId: DATABASE_ID,
  title: refreshed.properties.title,
  employees: keys.filter((row) => row[0]).length,
  tabs: refreshed.sheets.map((sheet) => sheet.properties.title),
  verifiedStoredReferences: storedReferences.length,
}, null, 2));
