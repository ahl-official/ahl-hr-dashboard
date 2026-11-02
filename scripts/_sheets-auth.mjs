// Shared service-account auth for one-off sheet scripts (reads .env / "service account.json").
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";

export const envVar = (name) => process.env[name] || env.match(new RegExp(`^${name}=([^\r\n]*)`, "m"))?.[1]?.trim();

const inlineCreds = envVar("GOOGLE_SERVICE_ACCOUNT_JSON");
const credentials = inlineCreds
  ? JSON.parse(inlineCreds)
  : JSON.parse(fs.readFileSync(path.join(root, "service account.json"), "utf8"));

export const FMS_SHEET_ID = envVar("HR_FMS_SPREADSHEET_ID");

async function getToken() {
  const b64 = (v) => Buffer.from(v).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now - 30,
    exp: now + 3300,
  }))}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  return (await res.json()).access_token;
}

let tokenPromise;
/** Calls the Sheets API for HR_FMS_SPREADSHEET_ID; `url` is appended to /spreadsheets/{id}. */
export async function sheetsApi(url, init = {}) {
  tokenPromise ||= getToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${FMS_SHEET_ID}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${await tokenPromise}`, "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body.error || body));
  return body;
}
