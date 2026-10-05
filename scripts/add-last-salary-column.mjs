// One-off: adds a "Last Drawn Salary" column (previous employer, per month) to the Employees sheet.
// Safe to run twice: it does nothing when the column already exists.   node scripts/add-last-salary-column.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const DB = process.env.HR_DATABASE_SPREADSHEET_ID;
const credentials = JSON.parse(fs.readFileSync(path.join(root, "service account.json"), "utf8"));
const b64 = (v) => Buffer.from(v).toString("base64url");

async function token() {
  const date = (await fetch("https://oauth2.googleapis.com/token", { method: "HEAD" })).headers.get("date");
  const now = Math.floor((date ? Date.parse(date) : Date.now()) / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now - 30, exp: now + 3300 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${body}`), credentials.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  return (await r.json()).access_token;
}
const T = await token();
const api = async (method, suffix, data) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DB}${suffix}`, { method, headers: { Authorization: `Bearer ${T}`, "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${suffix.slice(0, 40)} -> ${r.status}: ${j.error?.message}`);
  return j;
};

const NAME = "Last Drawn Salary";
const headers = ((await api("GET", `/values/${encodeURIComponent("Employees!1:1")}`)).values || [[]])[0].map((h) => String(h ?? "").trim());
if (headers.includes(NAME)) { console.log("Column already exists - nothing to do."); process.exit(0); }
const index = headers.length; // right after the last used column
const letter = (i) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

const grid = (await api("GET", "?fields=sheets.properties")).sheets.find((s) => s.properties.title === "Employees").properties;
if (index >= grid.gridProperties.columnCount) {
  await api("POST", ":batchUpdate", { requests: [{ appendDimension: { sheetId: grid.sheetId, dimension: "COLUMNS", length: index + 1 - grid.gridProperties.columnCount } }] });
}
await api("PUT", `/values/${encodeURIComponent(`Employees!${letter(index)}1`)}?valueInputOption=RAW`, { range: `Employees!${letter(index)}1`, majorDimension: "ROWS", values: [[NAME]] });
console.log(`Added "${NAME}" in column ${letter(index)} (existing rows stay blank).`);
