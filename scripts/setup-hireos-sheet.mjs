import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");

let folderId = "1NroiWT_PDFuYDxMjcRflvVyV0Y1ILEoz";
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, "utf8");
  const match = envContent.match(/HR_DOCUMENTS_FOLDER_ID=([^\r\n]+)/);
  if (match) folderId = match[1].trim();
}

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
  const credentialPath = path.join(root, "service account.json");
  if (fs.existsSync(credentialPath)) {
    credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  }
}

if (!credentials) {
  throw new Error("Service account credential not found in .env or service account.json");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  const clockResponse = await fetch("https://oauth2.googleapis.com/token", { method: "HEAD" });
  const googleDate = clockResponse.headers.get("date");
  const nowSeconds = Math.floor((googleDate ? Date.parse(googleDate) : Date.now()) / 1000);
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
  if (!response.ok || !body.access_token) {
    throw new Error(`Google authentication failed: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function main() {
  console.log("Authenticating with Google...");
  const token = await getAccessToken();
  console.log("Authenticated as:", credentials.client_email);

  // 1. Search for existing HireOS sheet
  console.log(`Checking HR Documents folder (${folderId}) for existing HireOS sheet...`);
  const q = `'${folderId}' in parents and name = 'HR - HireOS Candidate Assessments' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();
  
  let sheetId = "";
  let sheetLink = "";

  if (searchData.files && searchData.files.length > 0) {
    sheetId = searchData.files[0].id;
    sheetLink = searchData.files[0].webViewLink;
    console.log(`Found existing sheet: ${searchData.files[0].name} (${sheetId})`);
  } else {
    console.log("Creating new spreadsheet 'HR - HireOS Candidate Assessments'...");
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: "HR - HireOS Candidate Assessments"
        },
        sheets: [
          { properties: { title: "Candidates" } },
          { properties: { title: "Questions_Responses" } },
          { properties: { title: "Audit_Logs" } }
        ]
      })
    });
    const sheetData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(`Failed to create spreadsheet: ${JSON.stringify(sheetData)}`);
    }
    sheetId = sheetData.spreadsheetId;
    sheetLink = sheetData.spreadsheetUrl;
    console.log(`Created spreadsheet: ${sheetId}`);

    // Move file to folderId
    console.log(`Moving spreadsheet to folder ${folderId}...`);
    const moveUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${folderId}&fields=id,parents`;
    await fetch(moveUrl, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Ensure header rows
  console.log("Setting up standard header schemas...");
  const headersPayload = {
    valueInputOption: "USER_ENTERED",
    data: [
      {
        range: "Candidates!A1:N1",
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
        range: "Questions_Responses!A1:H1",
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
        range: "Audit_Logs!A1:D1",
        values: [[
          "Candidate ID",
          "Event Type",
          "Timestamp",
          "Details"
        ]]
      }
    ]
  };

  const batchUpdateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(headersPayload)
  });
  
  if (!batchUpdateRes.ok) {
    const err = await batchUpdateRes.json();
    console.warn("Header setup warning:", err);
  } else {
    console.log("Headers initialized successfully.");
  }

  console.log("\n==========================================");
  console.log("HIREOS SPREADSHEET SETUP COMPLETE!");
  console.log("Spreadsheet ID:", sheetId);
  console.log("Spreadsheet URL:", sheetLink || `https://docs.google.com/spreadsheets/d/${sheetId}`);
  console.log("==========================================\n");

  // Output recommendation for .env
  console.log(`Please add this to .env:\nHIREOS_SPREADSHEET_ID=${sheetId}\n`);
}

main().catch(err => {
  console.error("Error setting up sheet:", err);
  process.exit(1);
});
