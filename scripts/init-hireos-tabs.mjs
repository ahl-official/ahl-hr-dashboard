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

if (!credentials) {
  throw new Error("No service account credentials found");
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
  const spreadsheetId = process.env.HIREOS_SPREADSHEET_ID || "1KAdkNESBpJUIUaLNcxgmneLA-PiDet_Qtm8R4CZTMJY";
  console.log(`Setting up HireOS tabs in spreadsheet: ${spreadsheetId}`);

  // Fetch current sheets
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meta = await metaRes.json();
  const existingTitles = new Set((meta.sheets || []).map(s => s.properties?.title));

  const requiredTabs = ["HireOS_Candidates", "HireOS_Questions", "HireOS_Audit"];
  const addSheetRequests = [];
  for (const tab of requiredTabs) {
    if (!existingTitles.has(tab)) {
      addSheetRequests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (addSheetRequests.length > 0) {
    console.log(`Creating missing tabs: ${addSheetRequests.map(r => r.addSheet.properties.title).join(", ")}`);
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests: addSheetRequests })
    });
    if (!updateRes.ok) {
      console.error("Failed to add sheets:", await updateRes.json());
      return;
    }
  }

  // Set headers
  const headersPayload = {
    valueInputOption: "USER_ENTERED",
    data: [
      {
        range: "HireOS_Candidates!A1:N1",
        values: [[
          "Candidate ID",
          "Name",
          "Mobile",
          "Email",
          "Position",
          "Experience",
          "Status",
          "Score",
          "Tab Switches",
          "Created At",
          "Submitted At",
          "Test URL",
          "AI Summary",
          "Questions JSON"
        ]]
      },
      {
        range: "HireOS_Questions!A1:H1",
        values: [[
          "Candidate ID",
          "Question Number",
          "Category",
          "Question Text",
          "Expected Answer",
          "Candidate Answer",
          "Score",
          "Feedback"
        ]]
      },
      {
        range: "HireOS_Audit!A1:D1",
        values: [[
          "Candidate ID",
          "Event Type",
          "Timestamp",
          "Details"
        ]]
      }
    ]
  };

  const batchHeaderRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(headersPayload)
  });

  if (batchHeaderRes.ok) {
    console.log("Headers successfully written to all HireOS tabs!");
  } else {
    console.error("Failed to write headers:", await batchHeaderRes.json());
  }
}

main().catch(console.error);
