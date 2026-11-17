// AI CV screening against the role's Ideal Candidate Profile (recruitment SOP, step 2).
// Pure: builds the prompt, picks the ICP and validates the model's answer. The API call lives in hireos-ai.ts.

export const CV_VERDICTS = ["Proceed", "Hold", "Reject"] as const;
export type CvVerdict = (typeof CV_VERDICTS)[number];

export type CvScreeningReport = {
  matchScore: number; // 0-100
  verdict: CvVerdict;
  summary: string;
  relevantExperience: string;
  strengths: string[];
  missingSkills: string[];
  redFlags: string[];
  /** Questions drawn from this CV, to ask in the telephonic interview next to the standard ones. */
  interviewQuestions: string[];
  icpId: string;
  icpRole: string;
  icpVersion: string;
  cvSource: "pdf" | "text";
  cvFileName: string;
  screenedAt: string;
};

export type IcpOption = { icpId: string; roleName: string; status: string; version: string; icpContent: string };

export type ScreeningRoleContext = {
  position: string;
  requisition?: {
    jobTitle?: string;
    department?: string;
    minExp?: string;
    maxExp?: string;
    requiredSkills?: string;
    jobDescription?: string;
    budget?: string;
  };
  icp?: IcpOption | null;
};

export const MAX_CV_CHARS = 15000;
export const MIN_CV_CHARS = 150;

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

/**
 * The active ICP whose role name best matches the position: exact name first, then the most shared words.
 * Returns null when nothing matches, so HR is told to create or pick one instead of using the wrong profile.
 */
export function pickIcpForPosition(icps: IcpOption[], ...titles: Array<string | undefined>): IcpOption | null {
  const active = icps.filter((i) => (i.status || "active").toLowerCase() === "active" && i.roleName.trim());
  const names = titles.map((t) => (t || "").trim().toLowerCase()).filter(Boolean);
  for (const name of names) {
    const exact = active.find((i) => i.roleName.trim().toLowerCase() === name);
    if (exact) return exact;
  }
  let best: { icp: IcpOption; score: number } | null = null;
  for (const icp of active) {
    const icpWords = words(icp.roleName);
    for (const name of names) {
      const score = [...words(name)].filter((w) => icpWords.has(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { icp, score };
    }
  }
  return best?.icp ?? null;
}

export function buildCvScreeningMessages(candidateName: string, cvText: string, role: ScreeningRoleContext) {
  const req = role.requisition || {};
  const roleLines = [
    `Position: ${role.position || req.jobTitle || "Not specified"}`,
    req.department && `Department: ${req.department}`,
    (req.minExp || req.maxExp) && `Required experience: ${[req.minExp, req.maxExp].filter(Boolean).join(" to ")} years`,
    req.requiredSkills && `Required skills: ${req.requiredSkills}`,
    req.budget && `Salary budget: ${req.budget}`,
    req.jobDescription && `Job description: ${req.jobDescription.slice(0, 2000)}`,
  ].filter(Boolean);

  const icpBlock = role.icp
    ? `IDEAL CANDIDATE PROFILE (approved, version ${role.icp.version || "1"}):\n${role.icp.icpContent.slice(0, 5000)}`
    : "No Ideal Candidate Profile is available for this role. Judge against the role details only, and say so in the summary.";

  return [
    {
      role: "system" as const,
      content:
        "You are a strict, fair recruitment screener for a hair, beauty and aesthetics company in Mumbai (salons in Khar West). " +
        "Compare the candidate's CV with the Ideal Candidate Profile and role details. Treat the ICP's non-negotiables, red flags " +
        "and rejection criteria as hard rules: a candidate who fails one gets verdict Reject or Hold and the reason in redFlags. " +
        "Only use facts stated in the CV; when something required is not in the CV, list it under missingSkills instead of assuming it. " +
        "Return ONLY a JSON object with keys: matchScore (integer 0-100), verdict (\"Proceed\" | \"Hold\" | \"Reject\"), " +
        "summary (2-3 sentences: is this a good match and why), relevantExperience (string), strengths (array of strings), " +
        "missingSkills (array of strings), redFlags (array of strings: concerns such as job hopping, unexplained gaps, " +
        "mismatched claims, location or salary concerns), interviewQuestions (array of 5 questions to verify this CV's claims " +
        "and gaps in a telephonic interview).",
    },
    {
      role: "user" as const,
      content: `${icpBlock}\n\nROLE DETAILS:\n${roleLines.join("\n")}\n\nCANDIDATE: ${candidateName}\nCV TEXT:\n${cvText.slice(0, MAX_CV_CHARS)}`,
    },
  ];
}

const strings = (v: unknown, max = 8): string[] =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as any).title || (x as any).detail || "") : ""))
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, max)
    : [];

/** Validates the model's JSON. Throws when it is unusable, so a broken answer is never saved as a report. */
export function parseCvScreeningResponse(content: string): Omit<CvScreeningReport, "icpId" | "icpRole" | "icpVersion" | "cvSource" | "cvFileName" | "screenedAt"> {
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("The AI returned an unreadable answer. Please try again.");
  }
  const score = Math.round(Number(raw?.matchScore));
  const verdict = CV_VERDICTS.find((v) => v.toLowerCase() === String(raw?.verdict || "").trim().toLowerCase());
  const summary = String(raw?.summary || "").trim();
  if (!Number.isFinite(score) || !verdict || !summary) {
    throw new Error("The AI answer was missing the score, verdict or summary. Please try again.");
  }
  return {
    matchScore: Math.min(100, Math.max(0, score)),
    verdict,
    summary,
    relevantExperience: String(raw?.relevantExperience || "").trim(),
    strengths: strings(raw?.strengths),
    missingSkills: strings(raw?.missingSkills),
    redFlags: strings(raw?.redFlags),
    interviewQuestions: strings(raw?.interviewQuestions, 6),
  };
}
