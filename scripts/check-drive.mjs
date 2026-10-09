import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");

let credentials = null;
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, "utf8");
  const match = envContent.match(/GOOGLE_SERVICE_ACCOUNT_JSON=([^\r\n]+)/);
  if (match) {
    try {
      credentials = JSON.parse(match[1]);
    } catch (e) {}
  }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
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
  return body.access_token;
}

async function main() {
  const token = await getAccessToken();
  console.log("Token obtained!");

  // List all files accessible
  const listRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,parents)&includeItemsFromAllDrives=true&supportsAllDrives=true", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = await listRes.json();
  console.log("Accessible files:", JSON.stringify(list.files, null, 2));

  // Check 1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI
  const testId = "1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI";
  const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${testId}?includeGridData=false`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`Sheet ${testId} status:`, sheetRes.status);
  if (sheetRes.ok) {
    const data = await sheetRes.json();
    console.log("Sheet title:", data.properties?.title);
    console.log("Tabs:", data.sheets?.map(s => s.properties?.title));
  }
}

main().catch(console.error);
