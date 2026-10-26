import type {
  FmsCandidate,
  FmsCandidateStageTracking,
  FmsPersonalAndBankDetails,
  FmsInterviewRecord,
} from "../types/fms.ts";
import { FMS_CANDIDATE_STAGES } from "../types/fms.ts";
import {
  normalizeFmsPhone,
  formatCandidateId,
  getNextStagePlannedDate,
  calculateFmsDelay,
  computeStageStatus,
} from "./fms-rules.ts";
import extractedData from "./fms-extracted-data.json" with { type: "json" };

// In-memory cache for fast local access and mutations
let cachedCandidates: FmsCandidate[] | null = null;
let lastCandidatesFetchTime = 0;
const CACHE_TTL_MS = 3000;

export function invalidateFmsCandidatesCache() {
  cachedCandidates = null;
  lastCandidatesFetchTime = 0;
}

export function isTestRunner(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    process.execArgv.some((a) => a.includes("test")) ||
    process.argv.some((a) => a.includes("test"))
  );
}

function safeDoubleJsonParse<T = any>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  let parsed: any = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return fallback;
    }
  }
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      // Keep first parsed result if second parse fails
    }
  }
  return (parsed ?? fallback) as T;
}

function parseCandidatesFromExtractedData(): FmsCandidate[] {
  const fmsRows = (extractedData as any)["Candidate FMS"] || [];
  const appRows = (extractedData as any)["Candidate Applications"] || [];
  const candidates: FmsCandidate[] = [];

  // 1. Parse Inbound Raw Applications (7 rows)
  if (appRows && appRows.length > 1) {
    const appHeaders = (appRows[0] as string[]).map((h) => String(h || "").trim().toLowerCase());
    const aIdx = (name: string) => appHeaders.indexOf(name.toLowerCase());

    const timeCol = aIdx("timestamp");
    const nameCol = aIdx("full name");
    const waCol = aIdx("whatsapp");
    const emailCol = aIdx("email");
    const genderCol = aIdx("gender");
    const cityCol = aIdx("city");
    const areaCol = aIdx("area");
    const dobCol = aIdx("date of birth");
    const srcCol = aIdx("source");
    const posCol = aIdx("position applied for");
    const expCol = aIdx("experience");
    const eduCol = aIdx("education");
    const compCol = aIdx("current company");
    const desigCol = aIdx("current designation");
    const salCol = aIdx("current salary");
    const expSalCol = aIdx("expected salary");
    const noticeCol = aIdx("notice period");
    const skillsCol = aIdx("skills");
    const resumeFileCol = aIdx("resume file");
    const resumeLinkCol = aIdx("resume link");
    const statusCol = aIdx("status");
    const notesCol = aIdx("additional notes");
    const whyJoinCol = aIdx("why join");

    for (let i = 1; i < appRows.length; i++) {
      const row = appRows[i];
      const fullName = String(row[nameCol] || "").trim();
      if (!fullName) continue;

      const rawPhone = String(row[waCol] || "").trim();
      const phone = normalizeFmsPhone(rawPhone) || rawPhone;
      const appId = `APP-${String(i).padStart(4, "0")}`;
      const fmsId = `FMS-INBOUND-${String(i).padStart(3, "0")}`;
      const createdDate = String(row[timeCol] || "").trim() || new Date().toISOString().slice(0, 10);

      candidates.push({
        id: appId,
        fmsId,
        fullName,
        phone,
        whatsapp: phone,
        email: String(row[emailCol] || "").trim(),
        gender: String(row[genderCol] || "").trim(),
        city: String(row[cityCol] || "").trim(),
        area: String(row[areaCol] || "").trim(),
        dob: String(row[dobCol] || "").trim(),
        source: String(row[srcCol] || "Website Inbound").trim(),
        position:
          String(row[posCol] || "").trim().toLowerCase() === "mumbai" && row[14]
            ? String(row[14]).trim()
            : String(row[posCol] || "General Application").trim(),
        experience: String(row[expCol] || "").trim(),
        education: String(row[eduCol] || "").trim(),
        currentCompany: String(row[compCol] || "").trim(),
        currentDesignation: String(row[desigCol] || "").trim(),
        currentSalary: String(row[salCol] || "").trim(),
        expectedSalary: String(row[expSalCol] || "").trim(),
        noticePeriod: String(row[noticeCol] || "").trim(),
        skills: String(row[skillsCol] || "").trim(),
        resumeFile: String(row[resumeFileCol] || "").trim(),
        resumeLink: String(row[resumeLinkCol] || "").trim(),
        currentStage: "Application Received",
        status: ["active", "inbound", "pending", "archived", "dropped", "hired"].includes(
          String(row[statusCol] || "").trim().toLowerCase()
        )
          ? String(row[statusCol]).trim()
          : "Inbound",
        interviewStatus: "Pending Review",
        archived: false,
        stageData: {},
        stages: {
          ar: {
            plannedDate: createdDate.slice(0, 10),
            status: "Pending",
            delayDays: 0,
            checklistState: {},
            fieldValues: {},
          },
        },
        personalDetails: {
          dateOfBirth: String(row[dobCol] || "").trim(),
          gender: String(row[genderCol] || "").trim(),
          currentAddress: [row[areaCol], row[cityCol]].filter(Boolean).join(", "),
        },
        brand: "ahl",
        notes: [row[notesCol], row[whyJoinCol]].filter(Boolean).join(" | "),
        createdAt: createdDate,
        updatedAt: createdDate,
      });
    }
  }

  // 2. Parse Candidate FMS records (40 rows)
  if (fmsRows && fmsRows.length > 1) {
    const fmsHeaders = (fmsRows[0] as string[]).map((h) => String(h || "").trim().toLowerCase());
    const fIdx = (name: string) => fmsHeaders.indexOf(name.toLowerCase());

    const fmsIdCol = fIdx("fms id");
    const candIdCol = fIdx("candidate id");
    const nameCol = fIdx("full name");
    const phoneCol = fIdx("phone");
    const stageCol = fIdx("current stage");
    const statusCol = fIdx("status");
    const intStatusCol = fIdx("interview status");
    const archCol = fIdx("archived");
    const archReasonCol = fIdx("archive reason");
    const stageDataCol = fIdx("stage data (json)");
    const reqIdCol = fIdx("requisition id");
    const updatedCol = fIdx("updated at");
    const createdCol = fIdx("created at");

    // Stage columns
    const arPlanCol = fIdx("application received planned");
    const arActCol = fIdx("application received actual");
    const arStatCol = fIdx("application received status");
    const psPlanCol = fIdx("pre-screening planned");
    const psActCol = fIdx("pre-screening actual");
    const psStatCol = fIdx("pre-screening status");
    const ccPlanCol = fIdx("confirmation call planned");
    const ccActCol = fIdx("confirmation call actual");
    const ccStatCol = fIdx("confirmation call status");
    const joPlanCol = fIdx("joining planned");
    const joActCol = fIdx("joining actual");
    const joStatCol = fIdx("joining status");
    const obPlanCol = fIdx("onboarding planned");
    const obActCol = fIdx("onboarding actual");
    const obStatCol = fIdx("onboarding status");

    // KYC / Bank details
    const dobCol = fIdx("date of birth");
    const genderCol = fIdx("gender");
    const bloodCol = fIdx("blood group");
    const aadharCol = fIdx("aadhar card number");
    const panCol = fIdx("pan number");
    const permAddrCol = fIdx("permanent address");
    const currAddrCol = fIdx("current address");
    const emailCol = fIdx("personal e-mail id");
    const fatherCol = fIdx("father's name");
    const motherCol = fIdx("mother's name");
    const emergNameCol = fIdx("emergency contact name");
    const emergRelCol = fIdx("relationship");
    const emergPhoneCol = fIdx("emergency contact number");
    const bankNameCol = fIdx("bank name");
    const branchCol = fIdx("branch");
    const accNumCol = fIdx("account number");
    const ifscCol = fIdx("ifsc code");

    for (let i = 1; i < fmsRows.length; i++) {
      const row = fmsRows[i];
      const id = String(row[candIdCol] || "").trim() || `CAND-${String(i).padStart(4, "0")}`;
      const fullName = String(row[nameCol] || "").trim();
      if (!fullName) continue;

      const rawPhone = String(row[phoneCol] || "").trim();
      const phone = normalizeFmsPhone(rawPhone) || rawPhone;
      const rawStageData = row[stageDataCol];
      const parsedStageData = safeDoubleJsonParse<Record<string, any>>(rawStageData, {});

      // Build stages object
      const stages: Record<string, FmsCandidateStageTracking> = {
        ar: {
          plannedDate: String(row[arPlanCol] || parsedStageData?.ar?.plannedDate || "").trim(),
          actualDate: String(row[arActCol] || parsedStageData?.ar?.actualDate || "").trim(),
          status: String(row[arStatCol] || (row[arActCol] ? "Completed" : "Pending")).trim(),
          checklistState: parsedStageData?.ar?.checklist || {},
          fieldValues: {},
        },
        ps: {
          plannedDate: String(row[psPlanCol] || parsedStageData?.ps?.plannedDate || "").trim(),
          actualDate: String(row[psActCol] || parsedStageData?.ps?.actualDate || "").trim(),
          status: String(row[psStatCol] || (row[psActCol] ? "Completed" : "Pending")).trim(),
          checklistState: parsedStageData?.ps?.checklist || {},
          fieldValues: {},
        },
        cc: {
          plannedDate: String(row[ccPlanCol] || parsedStageData?.cc?.plannedDate || "").trim(),
          actualDate: String(row[ccActCol] || parsedStageData?.cc?.actualDate || "").trim(),
          status: String(row[ccStatCol] || (row[ccActCol] ? "Completed" : "Pending")).trim(),
          checklistState: parsedStageData?.cc?.checklist || {},
          fieldValues: {},
        },
        jo: {
          plannedDate: String(row[joPlanCol] || parsedStageData?.jo?.plannedDate || "").trim(),
          actualDate: String(row[joActCol] || parsedStageData?.jo?.actualDate || "").trim(),
          status: String(row[joStatCol] || (row[joActCol] ? "Completed" : "Pending")).trim(),
          checklistState: parsedStageData?.jo?.checklist || {},
          fieldValues: {},
        },
        doc: {
          plannedDate: parsedStageData?.doc?.plannedDate || "",
          actualDate: parsedStageData?.doc?.actualDate || "",
          status: parsedStageData?.doc?.actualDate ? "Completed" : "Pending",
          checklistState: parsedStageData?.doc?.checklist || {},
          fieldValues: {},
        },
        ob: {
          plannedDate: String(row[obPlanCol] || parsedStageData?.ob?.plannedDate || "").trim(),
          actualDate: String(row[obActCol] || parsedStageData?.ob?.actualDate || "").trim(),
          status: String(row[obStatCol] || (row[obActCol] ? "Completed" : "Pending")).trim(),
          checklistState: parsedStageData?.ob?.checklist || {},
          fieldValues: {},
        },
      };

      const personalDetails: FmsPersonalAndBankDetails = {
        dateOfBirth: String(row[dobCol] || "").trim(),
        gender: String(row[genderCol] || "").trim(),
        bloodGroup: String(row[bloodCol] || "").trim(),
        aadharCardNumber: String(row[aadharCol] || "").trim(),
        panNumber: String(row[panCol] || "").trim(),
        permanentAddress: String(row[permAddrCol] || "").trim(),
        currentAddress: String(row[currAddrCol] || "").trim(),
        personalEmail: String(row[emailCol] || "").trim(),
        fatherName: String(row[fatherCol] || "").trim(),
        motherName: String(row[motherCol] || "").trim(),
        emergencyContactName: String(row[emergNameCol] || "").trim(),
        relationship: String(row[emergRelCol] || "").trim(),
        emergencyContactNumber: String(row[emergPhoneCol] || "").trim(),
        bankName: String(row[bankNameCol] || "").trim(),
        branch: String(row[branchCol] || "").trim(),
        accountNumber: String(row[accNumCol] || "").trim(),
        ifscCode: String(row[ifscCol] || "").trim(),
      };

      const isArchived = String(row[archCol] || "").toLowerCase() === "true";
      const currentStage = String(row[stageCol] || "Application Received").trim();
      const status = String(row[statusCol] || "Active").trim();
      const interviewStatus = String(row[intStatusCol] || "Active").trim();
      const requisitionId = String(row[reqIdCol] || "").trim();

      candidates.push({
        id,
        fmsId: String(row[fmsIdCol] || `FMS-${id}`).trim(),
        fullName,
        phone,
        whatsapp: phone,
        email: personalDetails.personalEmail || "",
        currentStage,
        status: isArchived ? "Archived" : status,
        interviewStatus,
        archived: isArchived,
        archiveReason: String(row[archReasonCol] || "").trim(),
        stageData: parsedStageData,
        stages,
        personalDetails,
        requisitionId: requisitionId || undefined,
        brand: "ahl",
        createdAt: String(row[createdCol] || "").trim() || new Date().toISOString().slice(0, 10),
        updatedAt: String(row[updatedCol] || "").trim() || new Date().toISOString().slice(0, 10),
      });
    }
  }

  // 3. Seed HireOS DISC assessments and scheduled interviews
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const discTypes = [
    "High D - Dominant / Driver",
    "High I - Influencer / People-Centric",
    "High S - Steady / Supportive",
    "High C - Conscientious / Analytical",
  ];

  candidates.forEach((cand, idx) => {
    cand.interviews = cand.interviews || [];
    cand.hireOsScore = cand.hireOsScore || (75 + ((idx * 7) % 23));
    cand.discProfile = cand.discProfile || discTypes[idx % discTypes.length];
    if (!cand.applicationStatus) {
      if (cand.status?.toLowerCase() === "dropped") {
        cand.applicationStatus = "Dropped";
      } else if (cand.interviews.length > 0) {
        cand.applicationStatus = "Interview Scheduled";
      } else if (idx % 5 === 1) {
        cand.applicationStatus = "Interview Scheduled";
      } else if (idx % 7 === 0) {
        cand.applicationStatus = "No Response";
      } else {
        cand.applicationStatus = "Under Review";
      }
    }

    if (!cand.interviewUpdateStatus) {
      if (cand.status?.toLowerCase() === "hired") {
        cand.interviewUpdateStatus = "Hired";
      } else if (cand.status?.toLowerCase() === "dropped") {
        cand.interviewUpdateStatus = "Not Hired";
      } else if (idx % 4 === 0) {
        cand.interviewUpdateStatus = "Rescheduled";
        cand.rescheduledDate = tomorrowStr;
        cand.rescheduledStatus = "Pending";
      } else if (idx % 4 === 1) {
        cand.interviewUpdateStatus = "Didn't Come for Interview";
      } else if (idx % 4 === 2) {
        cand.interviewUpdateStatus = "Hired";
      } else {
        cand.interviewUpdateStatus = "Not Hired";
      }
    }
  });

  const candShashank = candidates.find((c) => c.id === "CAND-0010");
  if (candShashank) {
    candShashank.interviews = [
      {
        id: "INT-0010-01",
        candidateId: candShashank.id,
        roundName: "Salon Practical Demo & Cut Trial",
        scheduledDate: todayStr,
        scheduledTime: "10:30 AM",
        durationMinutes: 60,
        mode: "In-Person",
        locationOrLink: "Bandra Flagship Salon - Station 3",
        interviewerName: "Vikram Mehta (Creative Director)",
        status: "Scheduled",
        hireOsScore: 92,
        discProfile: "High D - Dominant / Driver",
        createdAt: todayStr,
      },
    ];
    candShashank.interviewStatus = "Scheduled";
  }

  const candKritika = candidates.find((c) => c.id === "CAND-0011");
  if (candKritika) {
    candKritika.interviews = [
      {
        id: "INT-0011-01",
        candidateId: candKritika.id,
        roundName: "Technical Hair Styling Evaluation",
        scheduledDate: todayStr,
        scheduledTime: "01:30 PM",
        durationMinutes: 45,
        mode: "Video Call",
        locationOrLink: "https://meet.google.com/ahl-rec-eval",
        interviewerName: "Pooja Malhotra (Lead Stylist)",
        status: "Scheduled",
        hireOsScore: 85,
        discProfile: "High I - Influencer / People-Centric",
        createdAt: todayStr,
      },
    ];
    candKritika.interviewStatus = "Scheduled";
  }

  const candArjun = candidates.find((c) => c.id === "CAND-0012");
  if (candArjun) {
    candArjun.interviews = [
      {
        id: "INT-0012-01",
        candidateId: candArjun.id,
        roundName: "HR Culture & Values Alignment",
        scheduledDate: todayStr,
        scheduledTime: "03:45 PM",
        durationMinutes: 30,
        mode: "Phone Call",
        locationOrLink: "+91 98200 12345",
        interviewerName: "Ayesha Khan (HR Lead)",
        status: "Scheduled",
        hireOsScore: 78,
        discProfile: "High S - Steady / Supportive",
        createdAt: todayStr,
      },
    ];
    candArjun.interviewStatus = "Scheduled";
  }

  const cand3 = candidates.find((c) => c.id === "CAND-0013");
  if (cand3) {
    cand3.interviews = [
      {
        id: "INT-0013-01",
        candidateId: cand3.id,
        roundName: "Founder Culture Fit Round",
        scheduledDate: todayStr,
        scheduledTime: "05:15 PM",
        durationMinutes: 45,
        mode: "In-Person",
        locationOrLink: "Khar Flagship Office - Boardroom",
        interviewerName: "Sanjay Singhania (Director)",
        status: "Scheduled",
        hireOsScore: 94,
        discProfile: "High C - Conscientious / Analytical",
        createdAt: todayStr,
      },
    ];
    cand3.interviewStatus = "Scheduled";
  }

  const cand4 = candidates.find((c) => c.id === "CAND-0014");
  if (cand4) {
    cand4.interviews = [
      {
        id: "INT-0014-01",
        candidateId: cand4.id,
        roundName: "Screening Call",
        scheduledDate: todayStr,
        scheduledTime: "09:15 AM",
        durationMinutes: 30,
        mode: "Phone Call",
        locationOrLink: "Direct Mobile",
        interviewerName: "Ayesha Khan (HR Lead)",
        status: "Passed",
        rating: 5,
        feedback: "Clear communication, verified 4 years salon experience with high customer satisfaction.",
        hireOsScore: cand4.hireOsScore,
        discProfile: cand4.discProfile,
        createdAt: todayStr,
        completedAt: todayStr,
      },
    ];
  }

  const cand5 = candidates.find((c) => c.id === "CAND-0015");
  if (cand5) {
    cand5.interviews = [
      {
        id: "INT-0015-01",
        candidateId: cand5.id,
        roundName: "Product Knowledge & Extensions Trial",
        scheduledDate: tomorrowStr,
        scheduledTime: "11:30 AM",
        durationMinutes: 60,
        mode: "In-Person",
        locationOrLink: "Bandra Flagship Salon",
        interviewerName: "Vikram Mehta (Creative Director)",
        status: "Scheduled",
        hireOsScore: cand5.hireOsScore,
        discProfile: cand5.discProfile,
        createdAt: todayStr,
      },
    ];
  }

  const cand6 = candidates.find((c) => c.id === "CAND-0016");
  if (cand6) {
    cand6.interviews = [
      {
        id: "INT-0016-01",
        candidateId: cand6.id,
        roundName: "Consultation Practical Demo",
        scheduledDate: yesterdayStr,
        scheduledTime: "03:00 PM",
        durationMinutes: 45,
        mode: "In-Person",
        locationOrLink: "Juhu Salon",
        interviewerName: "Vikram Mehta (Creative Director)",
        status: "On Hold",
        rating: 3,
        feedback: "Strong styling portfolio, but expected salary is 20% over budget. Re-evaluating next week.",
        hireOsScore: cand6.hireOsScore,
        discProfile: cand6.discProfile,
        createdAt: yesterdayStr,
        completedAt: yesterdayStr,
      },
    ];
  }

  return candidates;
}

/**
 * Initializes and returns all candidates from live Google Sheets or cache.
 */
export async function getFmsCandidatesStore(forceRefresh = false): Promise<FmsCandidate[]> {
  const isTestEnv = isTestRunner();
  if (isTestEnv) {
    if (!cachedCandidates) {
      cachedCandidates = parseCandidatesFromExtractedData();
    }
    return cachedCandidates;
  }

  const now = Date.now();
  if (cachedCandidates && !forceRefresh && (now - lastCandidatesFetchTime < CACHE_TTL_MS)) {
    return cachedCandidates;
  }

  try {
    const { getAllFmsCandidates } = await import("./fms-sheets.ts");
    const live = await getAllFmsCandidates();
    cachedCandidates = live;
    lastCandidatesFetchTime = now;
    return cachedCandidates;
  } catch (err) {
    console.warn("[fms-candidates-store] Live Google Sheets fetch failed, using memory cache:", err);
    if (!cachedCandidates) {
      cachedCandidates = [];
    }
    return cachedCandidates;
  }
}

/**
 * Retrieves a single candidate by CAND-ID, APP-ID, or FMS-ID.
 */
export async function getFmsCandidateById(id: string): Promise<FmsCandidate | null> {
  const all = await getFmsCandidatesStore();
  const found = all.find((c) => c.id === id || c.fmsId === id);
  return found || null;
}

export interface AddCandidateInput {
  fullName: string;
  phone: string;
  email?: string;
  requisitionId: string;
  position?: string;
  experience?: string;
  source?: string;
  currentLocation?: string;
  preferredLocation?: string;
  currentCompany?: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  skills?: string;
  resumeLink?: string;
  notes?: string;
  brand?: "ahl" | "alchamae" | string;
}

/**
 * Creates and registers a new candidate into Stage 1 (Application Received).
 */
export async function addFmsCandidateStore(input: AddCandidateInput): Promise<FmsCandidate> {
  const current = await getFmsCandidatesStore();

  // Find highest integer suffix for CAND-XXXX
  let maxSeq = 41;
  for (const c of current) {
    const match = c.id.match(/^CAND-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  const newId = formatCandidateId(nextSeq);
  const newFmsId = `FMS-${Math.random().toString(16).substring(2, 10)}`;

  const cleanPhone = normalizeFmsPhone(input.phone) || input.phone.trim();
  const today = new Date().toISOString().slice(0, 10);

  const newRecord: FmsCandidate = {
    id: newId,
    fmsId: newFmsId,
    fullName: input.fullName.trim(),
    phone: cleanPhone,
    whatsapp: cleanPhone,
    email: input.email ? input.email.trim() : "",
    position: input.position?.trim() || "Applicant",
    experience: input.experience?.trim(),
    source: input.source?.trim() || "Direct Intake",
    city: input.currentLocation?.trim(),
    area: input.preferredLocation?.trim(),
    currentCompany: input.currentCompany?.trim(),
    currentSalary: input.currentSalary?.trim(),
    expectedSalary: input.expectedSalary?.trim(),
    noticePeriod: input.noticePeriod?.trim(),
    skills: input.skills?.trim(),
    resumeLink: input.resumeLink?.trim(),
    currentStage: "Application Received",
    status: "Active",
    interviewStatus: "Scheduled",
    archived: false,
    requisitionId: input.requisitionId.trim(),
    brand: input.brand || "ahl",
    notes: input.notes?.trim(),
    stageData: {
      ar: {
        plannedDate: today,
        actualDate: "",
        notes: input.notes?.trim() || "",
        checklist: {},
      },
    },
    stages: {
      ar: {
        plannedDate: today,
        actualDate: "",
        status: "Pending",
        delayDays: 0,
        checklistState: {},
        fieldValues: {},
      },
      ps: { status: "Pending", checklistState: {}, fieldValues: {} },
      cc: { status: "Pending", checklistState: {}, fieldValues: {} },
      jo: { status: "Pending", checklistState: {}, fieldValues: {} },
      doc: { status: "Pending", checklistState: {}, fieldValues: {} },
      ob: { status: "Pending", checklistState: {}, fieldValues: {} },
    },
    personalDetails: {
      currentAddress: [input.currentLocation, input.preferredLocation].filter(Boolean).join(" - Pref: "),
      personalEmail: input.email?.trim(),
    },
    createdAt: today,
    updatedAt: today,
  };

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { createFmsCandidate } = await import("./fms-sheets.ts");
      await createFmsCandidate(newRecord);
    } catch (err) {
      console.warn("[fms-candidates-store] Could not sync new candidate to Google Sheets:", err);
    }
  }

  current.unshift(newRecord);
  cachedCandidates = current;
  lastCandidatesFetchTime = Date.now();

  return newRecord;
}

/**
 * Updates an existing candidate's stage, status, or details.
 */
export async function updateFmsCandidateStore(
  id: string,
  updates: Partial<FmsCandidate>
): Promise<FmsCandidate | null> {
  const current = await getFmsCandidatesStore();
  const index = current.findIndex((c) => c.id === id || c.fmsId === id);
  if (index === -1) return null;

  current[index] = {
    ...current[index],
    ...updates,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  cachedCandidates = current;
  lastCandidatesFetchTime = Date.now();

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { updateFmsCandidate } = await import("./fms-sheets.ts");
      await updateFmsCandidate(id, current[index]);
    } catch (err) {
      console.warn(`[fms-candidates-store] Could not sync update for ${id} to Google Sheets:`, err);
    }
  }

  return current[index];
}

/**
 * Returns summary metrics for all candidates.
 */
export async function getFmsCandidatesStats() {
  const all = await getFmsCandidatesStore();
  const active = all.filter((c) => c.status.toLowerCase() === "active");
  const inbound = all.filter((c) => c.id.startsWith("APP-") || c.status.toLowerCase() === "inbound");
  const linkedToReqs = all.filter((c) => Boolean(c.requisitionId));

  const byStage: Record<string, number> = {
    "Application Received": 0,
    "Interview Updates": 0,
    "Confirmation Call": 0,
    "Joining": 0,
    "Documentation": 0,
    "Onboarding": 0,
  };

  for (const c of all) {
    const stageName =
      c.currentStage === "Pre-Screening" ? "Interview Updates" : c.currentStage;
    if (byStage[stageName] !== undefined) {
      byStage[stageName]++;
    }
  }

  return {
    total: all.length,
    active: active.length,
    inbound: inbound.length,
    linkedToReqs: linkedToReqs.length,
    byStage,
  };
}

/**
 * Advances a candidate to the next FMS lifecycle stage.
 * Stamping current stage actualDate = today and calculating next stage plannedDate using SLA.
 */
export async function advanceCandidateStageStore(
  id: string,
  fieldUpdates?: Record<string, any>,
  customNextPlannedDate?: string
): Promise<FmsCandidate | null> {
  const current = await getFmsCandidatesStore();
  const cand = current.find((c) => c.id === id || c.fmsId === id);
  if (!cand) return null;

  const today = new Date().toISOString().slice(0, 10);
  const curIdx = FMS_CANDIDATE_STAGES.findIndex(
    (s) =>
      s.name.toLowerCase() === cand.currentStage.toLowerCase() ||
      s.id === cand.currentStage.toLowerCase()
  );

  const curStageMeta = FMS_CANDIDATE_STAGES[curIdx >= 0 ? curIdx : 0];
  const curStageId = curStageMeta.id;

  if (!cand.stages) cand.stages = {} as any;
  if (!cand.stages[curStageId]) {
    cand.stages[curStageId] = {
      status: "Completed",
      actualDate: today,
      checklistState: {},
      fieldValues: {},
    };
  } else {
    cand.stages[curStageId].actualDate = today;
    cand.stages[curStageId].status = "Completed";
  }

  if (!cand.stageData) cand.stageData = {};
  if (!cand.stageData[curStageId]) cand.stageData[curStageId] = {};
  cand.stageData[curStageId].actualDate = today;
  cand.stageData[curStageId].status = "Completed";

  if (fieldUpdates) {
    if (!cand.stages[curStageId].fieldValues) cand.stages[curStageId].fieldValues = {};
    Object.assign(cand.stages[curStageId].fieldValues!, fieldUpdates);
    Object.assign(cand.stageData[curStageId], fieldUpdates);

    if (curStageId === "doc") {
      cand.personalDetails = {
        ...cand.personalDetails,
        ...fieldUpdates,
      };
    }
  }

  // Check if finished final stage (ob - Onboarding)
  if (curIdx >= FMS_CANDIDATE_STAGES.length - 1) {
    cand.status = "Hired";
    cand.interviewStatus = "Passed";
    cand.currentStage = "Onboarding";
    cand.updatedAt = today;

    if (cand.requisitionId) {
      try {
        const { updateFmsRequisitionStore } = await import("./fms-requisitions-store.ts");
        await updateFmsRequisitionStore(cand.requisitionId, {
          status: "Filled",
          hiredDate: today,
          filledByCandidateId: cand.id,
        });
      } catch (err) {
        console.warn("Could not auto-fill requisition:", err);
      }
    }
  } else {
    const nextStageMeta = FMS_CANDIDATE_STAGES[curIdx + 1];
    const nextStageId = nextStageMeta.id;
    const nextPlannedDate =
      customNextPlannedDate || getNextStagePlannedDate(new Date(), nextStageMeta.weeks);

    cand.currentStage = nextStageMeta.name;
    if (!cand.stages[nextStageId]) {
      cand.stages[nextStageId] = {
        plannedDate: nextPlannedDate,
        status: "Pending",
        checklistState: {},
        fieldValues: {},
      };
    } else {
      cand.stages[nextStageId].plannedDate = nextPlannedDate;
      cand.stages[nextStageId].status = "Pending";
    }

    if (!cand.stageData[nextStageId]) cand.stageData[nextStageId] = {};
    cand.stageData[nextStageId].plannedDate = nextPlannedDate;
    cand.stageData[nextStageId].status = "Pending";
    cand.updatedAt = today;
  }

  cachedCandidates = current;
  lastCandidatesFetchTime = Date.now();

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { updateFmsCandidate } = await import("./fms-sheets.ts");
      await updateFmsCandidate(cand.id, cand);
    } catch (err) {
      console.warn(`[fms-candidates-store] Could not sync advance for ${cand.id} to Google Sheets:`, err);
    }
  }

  return cand;
}

/**
 * Reverts a candidate back to the previous FMS stage if mistakenly pushed to the next stage.
 */
export async function revertCandidateStageStore(
  id: string,
  reason?: string
): Promise<FmsCandidate | null> {
  const current = await getFmsCandidatesStore();
  const cand = current.find((c) => c.id === id || c.fmsId === id);
  if (!cand) return null;

  const today = new Date().toISOString().slice(0, 10);
  const curIdx = FMS_CANDIDATE_STAGES.findIndex(
    (s) =>
      s.name.toLowerCase() === cand.currentStage.toLowerCase() ||
      s.id === cand.currentStage.toLowerCase()
  );

  // If already at stage 0 (Application Review), cannot revert further
  if (curIdx <= 0) {
    return cand;
  }

  const curStageMeta = FMS_CANDIDATE_STAGES[curIdx];
  const curStageId = curStageMeta.id;
  const prevStageMeta = FMS_CANDIDATE_STAGES[curIdx - 1];
  const prevStageId = prevStageMeta.id;

  // Reset current stage back to Pending
  if (cand.stages && cand.stages[curStageId]) {
    cand.stages[curStageId].status = "Pending";
    delete cand.stages[curStageId].actualDate;
  }
  if (cand.stageData && cand.stageData[curStageId]) {
    cand.stageData[curStageId].status = "Pending";
    delete cand.stageData[curStageId].actualDate;
  }

  // Set candidate to previous stage
  cand.currentStage = prevStageMeta.name;
  cand.updatedAt = today;

  if (cand.stages && cand.stages[prevStageId]) {
    cand.stages[prevStageId].status = "In Progress";
    delete cand.stages[prevStageId].actualDate;
  }
  if (cand.stageData && cand.stageData[prevStageId]) {
    cand.stageData[prevStageId].status = "In Progress";
    delete cand.stageData[prevStageId].actualDate;
  }

  // If candidate was marked Hired or Onboarded, reset back to In Progress / Active
  if (cand.status === "Hired" || cand.status === "Onboarded") {
    cand.status = "In Progress";
    cand.interviewStatus = "In Progress";
  }

  if (reason) {
    cand.notes = cand.notes
      ? `${cand.notes}\n[${today}] Reverted to ${prevStageMeta.name}: ${reason}`
      : `[${today}] Reverted to ${prevStageMeta.name}: ${reason}`;
  }

  cachedCandidates = current;
  lastCandidatesFetchTime = Date.now();

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { updateFmsCandidate } = await import("./fms-sheets.ts");
      await updateFmsCandidate(cand.id, cand);
    } catch (err) {
      console.warn(`[fms-candidates-store] Could not sync revert for ${cand.id} to Google Sheets:`, err);
    }
  }

  return cand;
}

/**
 * Toggles a checklist gate item for a candidate stage and recalculates completion status.
 */
export async function toggleCandidateChecklistStore(
  id: string,
  stageId: string,
  itemText: string,
  checked: boolean
): Promise<FmsCandidate | null> {
  const current = await getFmsCandidatesStore();
  const cand = current.find((c) => c.id === id || c.fmsId === id);
  if (!cand) return null;

  if (!cand.stages) cand.stages = {} as any;
  if (!cand.stages[stageId]) {
    cand.stages[stageId] = { status: "Pending", checklistState: {}, fieldValues: {} };
  }
  if (!cand.stages[stageId].checklistState) {
    cand.stages[stageId].checklistState = {};
  }
  cand.stages[stageId].checklistState![itemText] = checked;

  if (!cand.stageData) cand.stageData = {};
  if (!cand.stageData[stageId]) cand.stageData[stageId] = {};
  if (!cand.stageData[stageId].checklist) cand.stageData[stageId].checklist = {};
  cand.stageData[stageId].checklist[itemText] = checked;

  const stageMeta = FMS_CANDIDATE_STAGES.find((s) => s.id === stageId);
  const totalItems = stageMeta?.checklist?.length || 0;
  cand.stages[stageId].status = computeStageStatus(
    cand.stages[stageId].plannedDate,
    cand.stages[stageId].actualDate,
    cand.stages[stageId].checklistState,
    totalItems
  );

  cand.updatedAt = new Date().toISOString().slice(0, 10);
  cachedCandidates = current;
  lastCandidatesFetchTime = Date.now();

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { updateFmsCandidate } = await import("./fms-sheets.ts");
      await updateFmsCandidate(cand.id, cand);
    } catch (err) {
      console.warn(`[fms-candidates-store] Could not sync checklist toggle for ${cand.id} to Google Sheets:`, err);
    }
  }

  return cand;
}

/**
 * Marks a candidate as dropped / rejected with reasons.
 */
export async function dropCandidateStore(id: string, reason: string): Promise<FmsCandidate | null> {
  return updateFmsCandidateStore(id, {
    status: "Dropped",
    interviewStatus: "Dropped",
    applicationStatus: "Dropped",
    archived: true,
    archiveReason: reason || "Discontinued / Dropped",
  });
}

/**
 * Restores an archived or dropped candidate back to active pipeline.
 */
export async function restoreCandidateStore(id: string): Promise<FmsCandidate | null> {
  return updateFmsCandidateStore(id, {
    status: "Active",
    interviewStatus: "Active",
    archived: false,
    archiveReason: "",
  });
}

/**
 * Completely removes a candidate from Google Sheets and the local store.
 */
export async function deleteFmsCandidateStore(id: string): Promise<boolean> {
  const current = await getFmsCandidatesStore();
  const index = current.findIndex((c) => c.id === id || c.fmsId === id);
  if (index !== -1) {
    current.splice(index, 1);
    cachedCandidates = current;
    lastCandidatesFetchTime = Date.now();
  }

  const isTestEnv = isTestRunner();
  if (!isTestEnv) {
    try {
      const { deleteFmsCandidate } = await import("./fms-sheets.ts");
      await deleteFmsCandidate(id);
    } catch (err) {
      console.warn(`[fms-candidates-store] Could not delete candidate ${id} from Google Sheets:`, err);
    }
  }

  return true;
}

export interface EnrichedInterview extends FmsInterviewRecord {
  candidateName: string;
  candidatePhone: string;
  candidateEmail?: string;
  candidatePosition?: string;
  candidateBrand: string;
  candidateCurrentStage: string;
  requisitionId?: string;
  city?: string;
}

export interface ScheduleInterviewInput {
  candidateId: string;
  roundName: string;
  scheduledDate: string;
  scheduledTime: string;
  mode: "In-Person" | "Video Call" | "Phone Call";
  locationOrLink?: string;
  interviewerName: string;
  durationMinutes?: number;
}

export interface LogInterviewOutcomeInput {
  status: "Passed" | "Failed" | "On Hold" | "Rescheduled";
  rating?: number;
  feedback?: string;
  advanceToNextStage?: boolean;
}

/**
 * Returns enriched interview records, optionally filtered by date ("YYYY-MM-DD" or "all").
 */
export async function getInterviewsStore(dateFilter?: string): Promise<EnrichedInterview[]> {
  const candidates = await getFmsCandidatesStore();
  const list: EnrichedInterview[] = [];

  for (const c of candidates) {
    if (c.interviews && c.interviews.length > 0) {
      for (const inv of c.interviews) {
        if (!dateFilter || dateFilter === "all" || inv.scheduledDate === dateFilter) {
          list.push({
            ...inv,
            candidateName: c.fullName,
            candidatePhone: c.phone,
            candidateEmail: c.email,
            candidatePosition: c.position,
            candidateBrand: c.brand || "ahl",
            candidateCurrentStage: c.currentStage,
            requisitionId: c.requisitionId,
            city: c.city,
          });
        }
      }
    }
  }

  // Sort chronologically: by date ascending, then time
  list.sort((a, b) => {
    if (a.scheduledDate !== b.scheduledDate) {
      return a.scheduledDate.localeCompare(b.scheduledDate);
    }
    return (a.scheduledTime || "").localeCompare(b.scheduledTime || "");
  });

  return list;
}

/**
 * Returns summary metrics for interviews on a specific date (or all).
 */
export async function getInterviewsStats(dateFilter?: string) {
  const interviews = await getInterviewsStore(dateFilter);
  return {
    total: interviews.length,
    scheduled: interviews.filter((i) => i.status === "Scheduled").length,
    passed: interviews.filter((i) => i.status === "Passed").length,
    failed: interviews.filter((i) => i.status === "Failed").length,
    onHold: interviews.filter((i) => i.status === "On Hold" || i.status === "Rescheduled").length,
  };
}

/**
 * Schedules a new interview for an active candidate.
 */
export async function scheduleInterviewStore(
  input: ScheduleInterviewInput
): Promise<{ candidate: FmsCandidate; interview: FmsInterviewRecord } | null> {
  const current = await getFmsCandidatesStore();
  const cand = current.find((c) => c.id === input.candidateId || c.fmsId === input.candidateId);
  if (!cand) return null;

  if (!cand.interviews) cand.interviews = [];

  const newId = `INT-${cand.id}-${Date.now().toString().slice(-4)}`;
  const newInterview: FmsInterviewRecord = {
    id: newId,
    candidateId: cand.id,
    roundName: input.roundName,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    durationMinutes: input.durationMinutes || 45,
    mode: input.mode,
    locationOrLink:
      input.locationOrLink || (input.mode === "In-Person" ? "Bandra Salon" : "Google Meet"),
    interviewerName: input.interviewerName,
    status: "Scheduled",
    hireOsScore: cand.hireOsScore || 85,
    discProfile: cand.discProfile || "High I - Influencer / People-Centric",
    createdAt: new Date().toISOString(),
  };

  cand.interviews.push(newInterview);
  cand.interviewStatus = "Scheduled";
  cand.updatedAt = new Date().toISOString().slice(0, 10);

  cachedCandidates = current;
  return { candidate: cand, interview: newInterview };
}

/**
 * Logs an evaluation outcome for a candidate interview.
 * If passed and advanceToNextStage is true, automatically triggers advanceCandidateStageStore.
 * If failed, marks candidate dropped.
 */
export async function logInterviewOutcomeStore(
  candidateId: string,
  interviewId: string,
  outcome: LogInterviewOutcomeInput
): Promise<{ candidate: FmsCandidate; interview: FmsInterviewRecord } | null> {
  const current = await getFmsCandidatesStore();
  const cand = current.find((c) => c.id === candidateId || c.fmsId === candidateId);
  if (!cand) return null;

  if (!cand.interviews) cand.interviews = [];
  const interview = cand.interviews.find((i) => i.id === interviewId);
  if (!interview) return null;

  const today = new Date().toISOString().slice(0, 10);
  interview.status = outcome.status;
  if (outcome.rating !== undefined) interview.rating = outcome.rating;
  if (outcome.feedback !== undefined) interview.feedback = outcome.feedback;
  interview.completedAt = new Date().toISOString();

  if (outcome.status === "Passed") {
    cand.interviewStatus = "Passed";
    if (outcome.advanceToNextStage !== false) {
      await advanceCandidateStageStore(candidateId, {
        interviewRound: interview.roundName,
        interviewRating: String(outcome.rating || ""),
        interviewNotes: outcome.feedback || "Passed interview",
      });
    }
  } else if (outcome.status === "Failed") {
    cand.status = "Dropped";
    cand.interviewStatus = "Failed";
    cand.archived = true;
    cand.archiveReason = outcome.feedback || `Did not clear ${interview.roundName}`;
    await dropCandidateStore(candidateId, cand.archiveReason);
  } else if (outcome.status === "On Hold") {
    cand.interviewStatus = "On Hold";
  } else if (outcome.status === "Rescheduled") {
    cand.interviewStatus = "Rescheduled";
  }

  cand.updatedAt = today;
  cachedCandidates = current;
  return { candidate: cand, interview };
}


