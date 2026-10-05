// One-off migration: replace every Employee ID with the new format (AHL-AI-0001 ...).
//   node scripts/migrate-employee-ids.mjs           -> dry run (default), writes only the backup + mapping files
//   node scripts/migrate-employee-ids.mjs --apply   -> backs up, then updates the sheet and verifies
// "First come, first served": within each company, numbers follow date of joining (oldest = 0001);
// ties and missing dates follow sheet order. Old IDs are kept in a new "Legacy Employee ID" column.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

// ---- env (.env.local) -------------------------------------------------------------------------
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const DB = process.env.HR_DATABASE_SPREADSHEET_ID;
if (!DB) throw new Error("HR_DATABASE_SPREADSHEET_ID missing");
const credentials = JSON.parse(fs.readFileSync(path.join(root, "service account.json"), "utf8"));

// ---- ID rules (kept in sync with src/lib/employee-id.ts, which is unit-tested) -----------------
const COMPANY = { "american hairline (ahl)": "AHL", "alchemane (alc)": "ALC", ydigital: "YD" };
const DEPT = {
  "human resources (hr)": "HR", accounts: "ACC", "video editor": "VED", "graphic designer": "GFX", "digital marketing": "DM",
  "artificial intelligence (ai)": "AI", "mis executive": "MIS", "content writer": "CW", "influencer marketing": "IM",
  videographer: "VID", purchase: "PUR", "customer service executive": "CSE", labour: "LAB", maintenance: "MNT",
  housekeeping: "HK", "process coordinator": "PC", inventory: "INV", "floor manager": "FM", "business development": "BD",
  "ahl technician": "TEC", crr: "CRR", "alc technician": "TEC", consultant: "CON", pmu: "PMU", "male techanican": "TEC", /* typo in sheet */
};
const derive = (n) => {
  const w = n.replace(/\(.*?\)/g, " ").split(/[^A-Za-z0-9]+/).filter(Boolean);
  return ((w.length > 1 ? w.map((x) => x[0]).join("") : w[0] || "").toUpperCase().slice(0, 3)) || "GEN";
};
const code = (table, name) => table[name.trim().toLowerCase()] || derive(name);
const fmt = (co, dept, n) => `${code(COMPANY, co)}-${code(DEPT, dept)}-${String(n).padStart(4, "0")}`;

// ---- Google Sheets ---------------------------------------------------------------------------
let token = "";
const b64 = (v) => Buffer.from(v).toString("base64url");
async function auth() {
  if (token) return token;
  const date = (await fetch("https://oauth2.googleapis.com/token", { method: "HEAD" })).headers.get("date");
  const now = Math.floor((date ? Date.parse(date) : Date.now()) / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now - 30, exp: now + 3300 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${body}`), credentials.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Google auth failed: " + (j.error_description || j.error));
  return (token = j.access_token);
}
async function api(method, suffix, data) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DB}${suffix}`, { method, headers: { Authorization: `Bearer ${await auth()}`, "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`Sheets ${method} ${suffix.slice(0, 40)} -> ${r.status}: ${j.error?.message}`);
  return j;
}
const read = async (range) => (await api("GET", `/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`)).values || [];
const write = (range, values) => api("PUT", `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { range, majorDimension: "ROWS", values });
const colLetter = (i) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const norm = (v) => String(v ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());

// ---- plan ------------------------------------------------------------------------------------
const rows = await read("Employees!A:AW");
const headers = rows[0].map(clean);
const col = (name) => headers.findIndex((h) => norm(h) === norm(name));
const C = { id: col("Employee ID"), name: col("Full Name"), company: col("Company"), dept: col("Department"), doj: col("Date of Joining (DOJ)"), key: col("Employee Key"), legacy: col("Legacy Employee ID") };
for (const k of ["id", "name", "company", "dept", "doj", "key"]) if (C[k] < 0) throw new Error(`Column not found: ${k}`);

// DOJ may be a sheet serial number or an ISO string
const dojValue = (v) => {
  if (typeof v === "number") return v;
  const m = clean(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000 : Infinity;
};
// Some sheet rows are shifted one column to the right after the blank header column (the dashboard's
// store.ts compensates the same way), so columns after that blank must be read one position earlier.
const blank = headers.findIndex((h) => !h);
const cell = (r, idx) => (blank >= 0 && clean(r[blank]) !== "" && idx > blank ? r[idx - 1] : r[idx]);
const people = rows.slice(1).map((r, i) => ({ row: i + 2, name: clean(cell(r, C.name)), company: clean(cell(r, C.company)), dept: clean(cell(r, C.dept)), doj: dojValue(cell(r, C.doj)), key: clean(r[C.key]), oldId: clean(cell(r, C.id)) })).filter((p) => p.name);
const skipped = people.filter((p) => !p.company || !p.key);
const plan = new Map(); // row -> new id
const perCompany = {};
const byCompany = Object.groupBy(people.filter((p) => p.company && p.key), (p) => p.company);
for (const [company, list] of Object.entries(byCompany)) {
  list.sort((a, b) => a.doj - b.doj || a.row - b.row);
  list.forEach((p, i) => plan.set(p.row, fmt(company, p.dept || "General", i + 1)));
  perCompany[company] = list.length;
}
const newIds = [...plan.values()];
if (new Set(newIds).size !== newIds.length) throw new Error("Generated IDs are not unique - aborting");

// ---- backup + mapping (always) ---------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(root, "..", "backups");
fs.mkdirSync(outDir, { recursive: true });
const related = { HR_Meetings: { sheet: "HR_Meetings", id: 2, key: 1 }, HR_Documents: { sheet: "HR_Documents", id: 2, key: 1 }, HR_Status: { sheet: "HR_Status", id: 1, key: 0 }, HR_Audit_Log: { sheet: "HR_Audit_Log", id: 3, key: 2 } };
const relatedData = {};
for (const t of Object.values(related)) relatedData[t.sheet] = await read(`${t.sheet}!A:Z`);
fs.writeFileSync(path.join(outDir, `employee-id-backup-${stamp}.json`), JSON.stringify({ takenAt: new Date().toISOString(), Employees: rows, ...relatedData }));
const mapping = people.map((p) => `${p.row},"${p.name.replace(/"/g, '""')}","${p.company}",${JSON.stringify(p.oldId)},${plan.get(p.row) || ""}`);
fs.writeFileSync(path.join(outDir, `employee-id-mapping-${stamp}.csv`), "row,name,company,old_id,new_id\n" + mapping.join("\n") + "\n");

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY RUN (nothing written to the sheet)");
console.log("Employees:", people.length, "| to renumber:", plan.size, "| per company:", perCompany);
console.log("Skipped (no company or no employee key):", skipped.map((p) => `${p.name} [row ${p.row}]`));
console.log("Sample:", [...plan].slice(0, 4).map(([row, id]) => `row ${row}: ${people.find((p) => p.row === row).oldId || "(blank)"} -> ${id}`));
console.log("Backup + mapping saved in:", outDir);
if (!APPLY) process.exit(0);

// ---- apply -----------------------------------------------------------------------------------
const legacyCol = C.legacy >= 0 ? C.legacy : headers.length;
if (C.legacy < 0) {
  // make sure the sheet grid is wide enough for the extra column
  const meta = await api("GET", "?fields=sheets.properties");
  const grid = meta.sheets.find((s) => s.properties.title === "Employees").properties;
  if (legacyCol >= grid.gridProperties.columnCount) {
    await api("POST", ":batchUpdate", { requests: [{ appendDimension: { sheetId: grid.sheetId, dimension: "COLUMNS", length: legacyCol + 1 - grid.gridProperties.columnCount } }] });
  }
}
if (C.legacy < 0) await write(`Employees!${colLetter(legacyCol)}1`, [["Legacy Employee ID"]]);
const idCol = colLetter(C.id), lgCol = colLetter(legacyCol);
const dataRows = rows.slice(1);
await write(`Employees!${idCol}2:${idCol}${rows.length}`, dataRows.map((r, i) => [plan.get(i + 2) ?? r[C.id] ?? ""]));
await write(`Employees!${lgCol}2:${lgCol}${rows.length}`, dataRows.map((r, i) => [plan.has(i + 2) ? (r[C.id] ?? "") : (r[legacyCol] ?? "")]));

// keep the id columns of the related tabs in step (matched by the stable employee key)
const idByKey = new Map(people.filter((p) => plan.has(p.row)).map((p) => [p.key, plan.get(p.row)]));
for (const t of Object.values(related)) {
  const data = relatedData[t.sheet];
  if (data.length < 2) continue;
  const L = colLetter(t.id);
  const values = data.slice(1).map((r) => [idByKey.get(clean(r[t.key])) ?? r[t.id] ?? ""]);
  await write(`${t.sheet}!${L}2:${L}${data.length}`, values);
  console.log(`  ${t.sheet}: ${data.length - 1} rows re-linked`);
}

// ---- verify ----------------------------------------------------------------------------------
const after = await read("Employees!A:AW");
const ids = after.slice(1).map((r) => clean(r[C.id])).filter(Boolean);
const okFormat = ids.filter((id) => /^[A-Z]{2,3}-[A-Z]{2,3}-\d{4,}$/.test(id)).length;
console.log(`VERIFY: ${ids.length} IDs, ${new Set(ids).size} unique, ${okFormat} in new format (skipped rows keep their old ID: ${skipped.length}).`);
