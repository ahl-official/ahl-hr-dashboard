import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");

let credentials = null;
let spreadsheetId = "1uybjrh8Uy6t8rM9HSNCOHptfhx16rqcYT9exaUqpaV8";

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, "utf8");
  const credsMatch = envContent.match(/GOOGLE_SERVICE_ACCOUNT_JSON=([^\r\n]+)/);
  if (credsMatch) {
    try {
      credentials = JSON.parse(credsMatch[1]);
    } catch (e) {}
  }
  const sheetMatch = envContent.match(/HIREOS_SPREADSHEET_ID=([^\r\n]+)/);
  if (sheetMatch) {
    spreadsheetId = sheetMatch[1].trim();
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
  console.log(`Setting up new HireOS sheet: ${spreadsheetId}`);
  const token = await getAccessToken();

  // 1. Get current tabs
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meta = await metaRes.json();
  const existingSheets = meta.sheets || [];
  const existingTitles = new Set(existingSheets.map(s => s.properties?.title));

  const requiredTabs = [
    "HireOS_Candidates",
    "HireOS_Questions",
    "HireOS_Audit",
    "ICP_Master",
    "AudioReviews",
    "PsychometricResults"
  ];

  const addRequests = [];
  for (const tab of requiredTabs) {
    if (!existingTitles.has(tab)) {
      addRequests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (addRequests.length > 0) {
    console.log(`Adding missing tabs: ${addRequests.map(r => r.addSheet.properties.title).join(", ")}`);
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests: addRequests })
    });
    if (!addRes.ok) {
      console.error("Failed to add tabs:", await addRes.json());
      return;
    }
  }

  // 2. Write headers & schemas
  const now = new Date().toISOString();
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
      },
      {
        range: "ICP_Master!A1:G1",
        values: [[
          "icpId",
          "roleName",
          "status",
          "version",
          "icpContent",
          "createdAt",
          "updatedAt"
        ]]
      },
      {
        range: "AudioReviews!A1:S1",
        values: [[
          "ID",
          "Candidate Name",
          "Role",
          "HR Notes",
          "Audio File Name",
          "Audio Mime Type",
          "Audio Drive File ID",
          "Audio Drive URL",
          "Transcript",
          "Transcript Model",
          "Report JSON",
          "Recommendation",
          "Final Verdict",
          "PDF Drive File ID",
          "PDF Drive URL",
          "Status",
          "Timestamp",
          "Updated At",
          "Error Message"
        ]]
      },
      {
        range: "PsychometricResults!A1:O1",
        values: [[
          "ID",
          "Name",
          "Entity_Type",
          "Email",
          "WhatsApp",
          "Test_Sent_At",
          "Test_Completed_At",
          "DISC_D",
          "DISC_I",
          "DISC_S",
          "DISC_C",
          "DISC_Profile",
          "Role_Fit_Score",
          "Role_Fit_Label",
          "DISC_Summary"
        ]]
      },
      // Seed sample ICPs
      {
        range: "ICP_Master!A2:G3",
        values: [
          [
            "ICP_AI_DEV_001",
            "AI Developer",
            "active",
            "1.0",
            "# IDEAL CANDIDATE PROFILE – AI DEVELOPER\n\n## 1. BASIC DETAILS\n- Role Name: AI Developer\n- Department: Engineering\n\n## 2. PURPOSE\nBuild & optimize internal AI agents, fine-tune models, and deploy RAG systems.\n\n## 7. MANDATORY SKILLS\n- Python & TypeScript\n- Next.js & React\n- Prompt Engineering & Tool Calling",
            now,
            now
          ],
          [
            "ICP_CRM_EXEC_001",
            "CRM Executive",
            "active",
            "1.0",
            "# IDEAL CANDIDATE PROFILE – CRM EXECUTIVE\n\n## 1. BASIC DETAILS\n- Role Name: CRM Executive\n- Department: Marketing & Sales\n\n## 2. PURPOSE\nOversee customer communication, retention workflows, and WhatsApp follow-ups.\n\n## 7. MANDATORY SKILLS\n- CRM Platforms\n- Data Hygiene\n- Proactive Customer Retention",
            now,
            now
          ]
        ]
      }
    ]
  };

  const headerRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(headersPayload)
  });

  if (headerRes.ok) {
    console.log("Headers and seed data successfully initialized!");
  } else {
    console.error("Header write warning:", await headerRes.json());
  }

  // 3. Remove initial empty default Sheet1 if present
  const defaultSheet = existingSheets.find(s => s.properties?.title === "Sheet1");
  if (defaultSheet) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [{ deleteSheet: { sheetId: defaultSheet.properties?.sheetId } }]
      })
    });
    console.log("Cleaned up default Sheet1.");
  }

  console.log("\n==========================================");
  console.log("SUCCESS! All 6 HireOS tabs configured inside:");
  console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log("==========================================\n");
}

main().catch(console.error);
