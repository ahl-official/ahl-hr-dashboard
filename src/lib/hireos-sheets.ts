import "server-only";

import { googleRequest } from "./google-auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function getHireOSSpreadsheetId() {
  const id = process.env.HIREOS_SPREADSHEET_ID;
  if (!id) {
    throw new Error("HIREOS_SPREADSHEET_ID is not configured in .env");
  }
  return id;
}

export type HireOSCandidate = {
  id: string;
  candidateId: string;
  name: string;
  mobile: string;
  email: string;
  position: string;
  experience: string;
  status: "Pending" | "Completed";
  score: number | null;
  tabSwitches: number;
  createdAt: string;
  submittedAt: string | null;
  testUrl: string;
  timeLimit?: number;
  aiSummary?: string;
  discStatus?: string;
  discProfile?: string;
  questions?: Array<{
    id: number;
    question: string;
    expectedAnswer?: string;
    topic?: string;
    difficulty?: string;
    candidateAnswer?: string;
    score?: number | null;
    feedback?: string;
  }>;
};

export async function getHireOSValues(range: string) {
  const ssId = getHireOSSpreadsheetId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
  const result = await googleRequest<{ values?: unknown[][] }>(url);
  return result.values || [];
}

export async function appendHireOSValues(range: string, values: unknown[][]) {
  const ssId = getHireOSSpreadsheetId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return googleRequest<any>(url, {
    method: "POST",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

export async function updateHireOSValues(range: string, values: unknown[][]) {
  const ssId = getHireOSSpreadsheetId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return googleRequest<any>(url, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

export async function clearHireOSValues(range: string) {
  const ssId = getHireOSSpreadsheetId();
  const url = `${SHEETS_BASE}/${ssId}/values/${encodeURIComponent(range)}:clear`;
  return googleRequest<any>(url, { method: "POST", body: "{}" });
}

// ==========================================
// 1. CANDIDATES
// ==========================================

export async function getHireOSCandidates(): Promise<HireOSCandidate[]> {
  const [candidateRows, psychometricRows] = await Promise.all([
    getHireOSValues("HireOS_Candidates!A2:O"),
    getHireOSValues("PsychometricResults!A2:O").catch(() => []),
  ]);

  const discMap: Record<string, { status: string; profile: string }> = {};
  psychometricRows.forEach((r) => {
    const id = String(r[0] || "").trim();
    if (id) {
      discMap[id] = {
        status: String(r[11] || (r[6] ? "Completed" : "Pending")),
        profile: String(r[11] || ""),
      };
    }
  });

  if (!candidateRows.length) return [];

  return candidateRows.map((r) => {
    const candidateId = String(r[0] || "");
    let parsedQuestions = [];
    try {
      if (r[13]) parsedQuestions = JSON.parse(String(r[13]));
    } catch (e) {}

    const disc = discMap[candidateId] || { status: "Not Started", profile: "" };

    return {
      id: candidateId,
      candidateId,
      name: String(r[1] || ""),
      mobile: String(r[2] || ""),
      email: String(r[3] || ""),
      position: String(r[4] || ""),
      experience: String(r[5] || ""),
      status: (String(r[6] || "").toLowerCase() === "completed" ? "Completed" : "Pending") as "Pending" | "Completed",
      score: r[7] !== "" && r[7] !== null && r[7] !== undefined ? Number(r[7]) : null,
      tabSwitches: Number(r[8] || 0),
      createdAt: String(r[9] || ""),
      submittedAt: r[10] ? String(r[10]) : null,
      testUrl: String(r[11] || ""),
      aiSummary: String(r[12] || ""),
      discStatus: disc.status,
      discProfile: disc.profile,
      timeLimit: Number(r[14] || 15),
      questions: parsedQuestions,
    };
  });
}

export async function getCandidateDetails(candidateId: string) {
  const candidates = await getHireOSCandidates();
  const candidate = candidates.find((c) => c.candidateId === candidateId || c.id === candidateId);
  if (!candidate) return null;

  // Question details from HireOS_Questions
  const qRows = await getHireOSValues("HireOS_Questions!A2:H");
  const questions = qRows
    .filter((r) => String(r[0]) === candidateId)
    .map((r) => ({
      id: Number(r[1]),
      category: String(r[2] || "Technical"),
      question: String(r[3] || ""),
      expectedAnswer: String(r[4] || ""),
      candidateAnswer: String(r[5] || ""),
      score: r[6] !== "" && r[6] !== null ? Number(r[6]) : null,
      feedback: String(r[7] || ""),
    }));

  return {
    ...candidate,
    questions: questions.length > 0 ? questions : candidate.questions || [],
    perQuestionScores: questions.map((q) => ({ score: q.score || 0 })),
    candidateAnswers: questions.map((q) => q.candidateAnswer),
    questionTypes: questions.map((q) => q.category),
  };
}

export async function createHireOSCandidate(candidate: {
  candidateId: string;
  name: string;
  mobile: string;
  email: string;
  position: string;
  experience: string;
  timeLimit?: number;
  testUrl: string;
  questions: Array<{
    id: number;
    question: string;
    expectedAnswer: string;
    topic: string;
    difficulty: string;
  }>;
}) {
  const now = new Date().toISOString();
  const timeLimit = Number(candidate.timeLimit || 15);
  const candidateRow = [
    candidate.candidateId,
    candidate.name,
    candidate.mobile,
    candidate.email,
    candidate.position,
    candidate.experience,
    "Pending",
    "",
    0,
    now,
    "",
    candidate.testUrl,
    "",
    JSON.stringify(candidate.questions),
    timeLimit,
  ];

  await appendHireOSValues("HireOS_Candidates!A:O", [candidateRow]);

  const questionRows = candidate.questions.map((q) => [
    candidate.candidateId,
    q.id,
    q.topic || "Technical",
    q.question,
    q.expectedAnswer || "",
    "",
    "",
    "",
  ]);

  if (questionRows.length > 0) {
    await appendHireOSValues("HireOS_Questions!A:H", questionRows);
  }

  return { candidateId: candidate.candidateId, createdAt: now };
}

export async function deleteCandidate(candidateId: string) {
  const rows = await getHireOSValues("HireOS_Candidates!A:A");
  const remainingCandidates = [];
  const allRows = await getHireOSValues("HireOS_Candidates!A1:N");
  const headers = allRows[0];

  for (let i = 1; i < allRows.length; i++) {
    if (String(allRows[i][0]) !== candidateId) {
      remainingCandidates.push(allRows[i]);
    }
  }

  await clearHireOSValues("HireOS_Candidates!A:N");
  await updateHireOSValues("HireOS_Candidates!A1:N", [headers, ...remainingCandidates]);
  return { success: true };
}

export async function deleteCandidates(candidateIds: string[]) {
  const set = new Set(candidateIds);
  const allRows = await getHireOSValues("HireOS_Candidates!A1:N");
  const headers = allRows[0];
  const remainingCandidates = [];

  for (let i = 1; i < allRows.length; i++) {
    if (!set.has(String(allRows[i][0]))) {
      remainingCandidates.push(allRows[i]);
    }
  }

  await clearHireOSValues("HireOS_Candidates!A:N");
  await updateHireOSValues("HireOS_Candidates!A1:N", [headers, ...remainingCandidates]);
  return { success: true };
}

export async function submitCandidateTest(payload: {
  candidateId: string;
  answers: Array<{ id: number; answer: string }>;
  tabSwitches: number;
  overallScore: number;
  aiSummary: string;
  perQuestionResults: Array<{
    id: number;
    score: number;
    feedback: string;
  }>;
}) {
  const now = new Date().toISOString();
  const candidateRows = await getHireOSValues("HireOS_Candidates!A:A");
  const rowIndex = candidateRows.findIndex((r) => String(r[0]) === payload.candidateId) + 1;

  if (rowIndex > 1) {
    await updateHireOSValues(`HireOS_Candidates!G${rowIndex}:K${rowIndex}`, [
      ["Completed", payload.overallScore, payload.tabSwitches, "", now],
    ]);
    await updateHireOSValues(`HireOS_Candidates!M${rowIndex}`, [[payload.aiSummary]]);
  }

  const qRows = await getHireOSValues("HireOS_Questions!A:B");
  for (let i = 1; i < qRows.length; i++) {
    const qCandidateId = String(qRows[i][0]);
    const qNum = Number(qRows[i][1]);
    if (qCandidateId === payload.candidateId) {
      const qAnswer = payload.answers.find((a) => a.id === qNum)?.answer || "";
      const qResult = payload.perQuestionResults.find((r) => r.id === qNum);
      const score = qResult ? qResult.score : "";
      const feedback = qResult ? qResult.feedback : "";

      const actualRow = i + 1;
      await updateHireOSValues(`HireOS_Questions!F${actualRow}:H${actualRow}`, [
        [qAnswer, score, feedback],
      ]);
    }
  }

  return { success: true, submittedAt: now };
}

// ==========================================
// 2. IDEAL CANDIDATE PROFILES (ICPs)
// ==========================================

export async function getAllICPs() {
  const rows = await getHireOSValues("ICP_Master!A2:G");
  if (!rows.length) {
    // Seed default sample ICPs if empty
    const samples = [
      [
        "ICP_AI_DEV_001",
        "AI Developer",
        "active",
        "1.0",
        "# IDEAL CANDIDATE PROFILE – AI DEVELOPER\n\n## 1. BASIC ROLE DETAILS\n- Role Name: AI Developer\n- Department: Engineering\n\n## 2. MAIN PURPOSE\nBuild and optimize LLM workflows, fine-tuning, and RAG pipelines.\n\n## 7. SKILLS REQUIRED\n- Python\n- OpenAI & OpenRouter\n- Next.js & TypeScript\n- Vector DBs",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
      [
        "ICP_CRM_EXEC_001",
        "CRM Executive",
        "active",
        "1.0",
        "# IDEAL CANDIDATE PROFILE – CRM EXECUTIVE\n\n## 1. BASIC ROLE DETAILS\n- Role Name: CRM Executive\n- Department: Marketing & Sales\n\n## 2. MAIN PURPOSE\nManage client retention, WhatsApp workflows, and CRM database accuracy.\n\n## 7. SKILLS REQUIRED\n- HubSpot / Zoho CRM\n- Excel & Data Hygiene\n- Customer Retention Strategies",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    ];
    await appendHireOSValues("ICP_Master!A:G", samples);
    return samples.map((r) => ({
      icpId: r[0],
      roleName: r[1],
      status: r[2],
      version: r[3],
      icpContent: r[4],
      createdAt: r[5],
      updatedAt: r[6],
    }));
  }

  return rows.map((r) => ({
    icpId: String(r[0] || ""),
    roleName: String(r[1] || ""),
    status: String(r[2] || "active"),
    version: String(r[3] || "1.0"),
    icpContent: String(r[4] || ""),
    createdAt: String(r[5] || ""),
    updatedAt: String(r[6] || ""),
  }));
}

export async function getActiveICPs() {
  const all = await getAllICPs();
  return all.filter((i) => i.status.toLowerCase() === "active");
}

export async function saveICP(data: {
  icpId?: string;
  roleName: string;
  status: string;
  version?: string;
  icpContent: string;
}) {
  const now = new Date().toISOString();
  const isNew = !data.icpId;
  const icpId =
    data.icpId ||
    `ICP_${data.roleName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_${Date.now().toString(36)}`;

  if (isNew) {
    const row = [icpId, data.roleName, data.status || "active", data.version || "1.0", data.icpContent, now, now];
    await appendHireOSValues("ICP_Master!A:G", [row]);
    return { icpId, ...data, createdAt: now, updatedAt: now };
  } else {
    const rows = await getHireOSValues("ICP_Master!A:A");
    const idx = rows.findIndex((r) => String(r[0]) === data.icpId) + 1;
    if (idx > 1) {
      await updateHireOSValues(`ICP_Master!B${idx}:E${idx}`, [
        [data.roleName, data.status, data.version || "1.0", data.icpContent],
      ]);
      await updateHireOSValues(`ICP_Master!G${idx}`, [[now]]);
    }
    return { icpId: data.icpId, ...data, updatedAt: now };
  }
}

// ==========================================
// 3. AUDIO REVIEWS
// ==========================================

export async function getAllAudioReviews() {
  const rows = await getHireOSValues("AudioReviews!A2:S");
  if (!rows.length) return [];

  return rows.map((r) => {
    let report = {};
    try {
      if (r[10]) report = JSON.parse(String(r[10]));
    } catch (e) {}

    return {
      id: String(r[0] || ""),
      name: String(r[1] || ""),
      role: String(r[2] || ""),
      hrNotes: String(r[3] || ""),
      audioFileName: String(r[4] || ""),
      audioMimeType: String(r[5] || ""),
      audioDriveFileId: String(r[6] || ""),
      audioDriveUrl: String(r[7] || ""),
      transcript: String(r[8] || ""),
      report,
      recommendation: String(r[11] || ""),
      finalVerdict: String(r[12] || ""),
      status: String(r[15] || "Completed"),
      timestamp: String(r[16] || ""),
    };
  });
}

export async function saveAudioReview(review: {
  id: string;
  name: string;
  role: string;
  hrNotes: string;
  audioFileName?: string;
  transcript: string;
  report: any;
  recommendation?: string;
  finalVerdict?: string;
}) {
  const now = new Date().toISOString();
  const row = [
    review.id,
    review.name,
    review.role,
    review.hrNotes,
    review.audioFileName || "",
    "audio/mpeg",
    "",
    "",
    review.transcript,
    "web-speech-api",
    JSON.stringify(review.report),
    review.recommendation || review.report.recommendation || "",
    review.finalVerdict || review.report.finalVerdict || "",
    "",
    "",
    "Completed",
    now,
    now,
    "",
  ];

  await appendHireOSValues("AudioReviews!A:S", [row]);
  return { ...review, status: "Completed", timestamp: now };
}

export async function getCandidateTestById(candidateId: string) {
  const candidate = await getCandidateDetails(candidateId);
  if (!candidate) return null;
  return {
    candidateId: candidate.id || candidate.candidateId,
    name: candidate.name,
    position: candidate.position,
    status: candidate.status,
    score: candidate.score,
    timeLimit: Number(candidate.timeLimit || 15),
    tabSwitches: candidate.tabSwitches,
    questions: (candidate.questions || []).map((q: any) => ({
      id: q.id,
      category: q.category || q.topic || "Technical",
      question: q.question,
      candidateAnswer: q.candidateAnswer || "",
    })),
  };
}

// ==========================================
// 4. PSYCHOMETRIC / DISC ASSESSMENT
// ==========================================

export async function getPsychometricResult(id: string, entityType = "Candidate") {
  const rows = await getHireOSValues("PsychometricResults!A2:O");
  const row = rows.find((r) => String(r[0]) === id);

  if (!row) {
    const candidates = await getHireOSCandidates();
    const candidate = candidates.find((c) => c.id === id || c.candidateId === id);
    return {
      id,
      entityType,
      candidateName: candidate?.name || "Candidate",
      email: candidate?.email || "",
      whatsapp: candidate?.mobile || "",
      position: candidate?.position || "",
      status: "Not Started",
      testSentAt: "",
      testCompletedAt: "",
      discD: 0,
      discI: 0,
      discS: 0,
      discC: 0,
      discProfile: "",
      appliedRole: candidate?.position || "",
      roleFitScore: 0,
      roleFitLabel: "",
      discSummary: "",
      recommendedRoles: [],
    };
  }

  return {
    id: String(row[0] || ""),
    candidateName: String(row[1] || ""),
    entityType: String(row[2] || entityType),
    email: String(row[3] || ""),
    whatsapp: String(row[4] || ""),
    testSentAt: String(row[5] || ""),
    testCompletedAt: String(row[6] || ""),
    discD: Number(row[7] || 0),
    discI: Number(row[8] || 0),
    discS: Number(row[9] || 0),
    discC: Number(row[10] || 0),
    discProfile: String(row[11] || ""),
    roleFitScore: Number(row[12] || 0),
    roleFitLabel: String(row[13] || ""),
    discSummary: String(row[14] || ""),
    status: row[6] ? "Completed" : "Pending",
  };
}

export async function sendPsychometricTestLink(id: string) {
  const candidates = await getHireOSCandidates();
  const candidate = candidates.find((c) => c.id === id || c.candidateId === id);
  const now = new Date().toISOString();

  // Upsert into PsychometricResults
  const rows = await getHireOSValues("PsychometricResults!A:A");
  const idx = rows.findIndex((r) => String(r[0]) === id) + 1;

  if (idx > 1) {
    await updateHireOSValues(`PsychometricResults!F${idx}`, [[now]]);
  } else {
    await appendHireOSValues("PsychometricResults!A:O", [
      [
        id,
        candidate?.name || "",
        "Candidate",
        candidate?.email || "",
        candidate?.mobile || "",
        now,
        "",
        0,
        0,
        0,
        0,
        "",
        0,
        "",
        "",
      ],
    ]);
  }

  return { success: true, sentAt: now };
}

export async function logHireOSAudit(candidateId: string, eventType: string, details: string) {
  const now = new Date().toISOString();
  await appendHireOSValues("HireOS_Audit!A:D", [[candidateId, eventType, now, details]]);
}

export async function getEmployeeDiscRoster() {
  const { getAllEmployees } = await import("./store");
  const allEmployees = await getAllEmployees();
  const activeEmployees = allEmployees.filter((e) => e.employmentStatus === "Active");

  const psychRows = await getHireOSValues("PsychometricResults!A:O");
  // row schema:
  // [0] ID, [1] Name, [2] Entity_Type, [3] Email, [4] WhatsApp, [5] Test_Sent_At, [6] Test_Completed_At,
  // [7] DISC_D, [8] DISC_I, [9] DISC_S, [10] DISC_C, [11] DISC_Profile, [12] Role_Fit_Score, [13] Role_Fit_Label, [14] DISC_Summary

  const psychoMap = new Map<string, any>();
  for (let i = 1; i < psychRows.length; i++) {
    const r = psychRows[i];
    const id = String(r[0] || "").trim();
    const entity = String(r[2] || "").trim().toLowerCase();
    if (id && (entity === "employee" || !entity)) {
      psychoMap.set(id, {
        id,
        name: String(r[1] || ""),
        entityType: "Employee",
        email: String(r[3] || ""),
        whatsapp: String(r[4] || ""),
        testSentAt: String(r[5] || ""),
        testCompletedAt: String(r[6] || ""),
        discD: Number(r[7] || 0),
        discI: Number(r[8] || 0),
        discS: Number(r[9] || 0),
        discC: Number(r[10] || 0),
        discProfile: String(r[11] || ""),
        roleFitScore: Number(r[12] || 0),
        roleFitLabel: String(r[13] || ""),
        discSummary: String(r[14] || ""),
        status: r[6] ? "Completed" : r[5] ? "Pending" : "Not Started",
      });
    }
  }

  const list = activeEmployees.map((emp) => {
    const id = emp.employeeId || emp.employeeKey;
    const psycho = psychoMap.get(id);

    const status: "Completed" | "Pending" | "Not Started" = psycho?.status || "Not Started";

    return {
      employeeId: id,
      fullName: emp.fullName,
      designation: emp.designation || "Staff",
      department: emp.department || "General",
      company: emp.company || "",
      mobile: emp.mobile || "",
      companyEmail: emp.companyEmail || "",
      discStatus: status,
      discProfile: psycho?.discProfile || "",
      discD: psycho?.discD || 0,
      discI: psycho?.discI || 0,
      discS: psycho?.discS || 0,
      discC: psycho?.discC || 0,
      discSummary: psycho?.discSummary || "",
      roleFitScore: psycho?.roleFitScore || 0,
      roleFitLabel: psycho?.roleFitLabel || "",
      testSentAt: psycho?.testSentAt || null,
      testCompletedAt: psycho?.testCompletedAt || null,
    };
  });

  const stats = {
    totalActive: activeEmployees.length,
    completed: list.filter((e) => e.discStatus === "Completed").length,
    pending: list.filter((e) => e.discStatus === "Pending").length,
    notStarted: list.filter((e) => e.discStatus === "Not Started").length,
  };

  return { list, stats };
}

export async function sendEmployeeDiscInvite(employeeId: string, baseUrl = "http://localhost:3000") {
  const { getAllEmployees } = await import("./store");
  const allEmployees = await getAllEmployees();
  const emp = allEmployees.find((e) => e.employeeId === employeeId || e.employeeKey === employeeId);

  if (!emp) {
    throw new Error(`Employee with ID ${employeeId} not found`);
  }

  const now = new Date().toISOString();
  const cleanPhone = String(emp.mobile || "").replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const testUrl = `${baseUrl.replace(/\/$/, "")}/psychometric/${encodeURIComponent(employeeId)}?entity=Employee`;

  const firstName = emp.fullName.split(" ")[0] || emp.fullName;
  const message = `Hi ${firstName},\n\nPlease take this short DISC personality & workplace assessment (~10 minutes). Your assessment link:\n\n${testUrl}\n\n– American Hairline HR`;
  const whatsappLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : "";

  // Upsert into PsychometricResults
  const rows = await getHireOSValues("PsychometricResults!A:C");
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowId = String(rows[i][0] || "").trim();
    const entity = String(rows[i][2] || "").trim().toLowerCase();
    if (rowId === employeeId && (entity === "employee" || !entity)) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    await updateHireOSValues(`PsychometricResults!F${rowIndex}`, [[now]]);
  } else {
    await appendHireOSValues("PsychometricResults!A:O", [
      [
        employeeId,
        emp.fullName,
        "Employee",
        emp.companyEmail || "",
        emp.mobile || "",
        now,
        "",
        0,
        0,
        0,
        0,
        "",
        0,
        "",
        "",
      ],
    ]);
  }

  return {
    success: true,
    employeeId,
    name: emp.fullName,
    sentAt: now,
    testUrl,
    whatsappLink,
    message,
  };
}

export async function submitDiscAssessment(payload: {
  id: string;
  entityType?: "Candidate" | "Employee";
  answers: Record<number, "D" | "I" | "S" | "C">;
}) {
  const { calculateDiscResult } = await import("./disc-questions");
  const result = calculateDiscResult(payload.answers);
  const entityType = payload.entityType || "Candidate";
  const now = new Date().toISOString();

  const rows = await getHireOSValues("PsychometricResults!A:C");
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowId = String(rows[i][0] || "").trim();
    const rowEntity = String(rows[i][2] || "").trim().toLowerCase();
    if (rowId === payload.id && rowEntity === entityType.toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  // Row columns:
  // G: Test_Completed_At (col 7)
  // H: DISC_D (col 8)
  // I: DISC_I (col 9)
  // J: DISC_S (col 10)
  // K: DISC_C (col 11)
  // L: DISC_Profile (col 12)
  // M: Role_Fit_Score (col 13)
  // N: Role_Fit_Label (col 14)
  // O: DISC_Summary (col 15)

  const scoresRow = [
    now,
    result.scores.D,
    result.scores.I,
    result.scores.S,
    result.scores.C,
    result.profileCode,
    85,
    "Strong Fit",
    `${result.headline}: ${result.summary}`,
  ];

  if (rowIndex > 0) {
    await updateHireOSValues(`PsychometricResults!G${rowIndex}:O${rowIndex}`, [scoresRow]);
  } else {
    // Look up name
    let name = payload.id;
    let email = "";
    let mobile = "";

    if (entityType === "Employee") {
      const { getAllEmployees } = await import("./store");
      const emps = await getAllEmployees();
      const emp = emps.find((e) => e.employeeId === payload.id || e.employeeKey === payload.id);
      if (emp) {
        name = emp.fullName;
        email = emp.companyEmail || "";
        mobile = emp.mobile || "";
      }
    } else {
      const candidates = await getHireOSCandidates();
      const c = candidates.find((x) => x.id === payload.id || x.candidateId === payload.id);
      if (c) {
        name = c.name;
        email = c.email;
        mobile = c.mobile;
      }
    }

    await appendHireOSValues("PsychometricResults!A:O", [
      [
        payload.id,
        name,
        entityType,
        email,
        mobile,
        now,
        ...scoresRow,
      ],
    ]);
  }

  return {
    success: true,
    completedAt: now,
    ...result,
  };
}

