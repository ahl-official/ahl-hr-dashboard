// Position Kit: everything the recruitment SOP keeps per position (steps 1 and 8) — the Ideal Candidate
// Profile with its ten fields, the interview and qualifying test, and the after-joining tests — plus the
// department head's approval. Pure, so the rules are unit-tested; stored in the ICP_Master tab by hireos-sheets.ts.

export const QUALIFYING_TEST_TYPES = ["Course-based", "Work-based", "Practical", "Role-play", "Written (online)"] as const;

export type PositionKit = {
  department: string;
  departmentHead: string;
  // SOP step 1 — the Ideal Candidate Profile
  vacancies: string;
  requiredExperience: string;
  keyResponsibilities: string;
  mustHaveSkills: string;
  preferredIndustry: string;
  nonNegotiables: string;
  redFlags: string;
  rejectionCriteria: string;
  salaryRange: string;
  // SOP step 8 — interview, qualifying test, assessment
  interviewQuestions: string; // one per line, asked on top of the eight standard questions
  qualifyingTestType: string;
  qualifyingTest: string;
  qualifyingTestLink: string;
  assessmentInstructions: string;
  // SOP step 4 — work samples for creative and skill-based positions
  workSamplesRequired: string; // "yes" or ""
  workSampleTypes: string; // what to ask for, e.g. "2 edited reels and 1 long-form video"
  // SOP step 9 — tests after joining
  day1Test: string;
  day6Test: string;
  week2Test: string;
  month1Test: string;
};

export type KitApproval = "Draft" | "Approved";

/** An ICP_Master row. Older rows have only `icpContent`; `kit` is null for them until edited. */
export type PositionKitRecord = {
  icpId: string;
  roleName: string;
  status: string; // "active" | "inactive"
  version: string;
  icpContent: string; // what the AI reads; generated from the kit
  createdAt: string;
  updatedAt: string;
  kit: PositionKit | null;
  approval: KitApproval;
  approvedBy: string;
  approvedAt: string;
};

export const emptyKit = (): PositionKit => ({
  department: "",
  departmentHead: "",
  vacancies: "",
  requiredExperience: "",
  keyResponsibilities: "",
  mustHaveSkills: "",
  preferredIndustry: "",
  nonNegotiables: "",
  redFlags: "",
  rejectionCriteria: "",
  salaryRange: "",
  interviewQuestions: "",
  qualifyingTestType: "",
  qualifyingTest: "",
  qualifyingTestLink: "",
  assessmentInstructions: "",
  workSamplesRequired: "",
  workSampleTypes: "",
  day1Test: "",
  day6Test: "",
  week2Test: "",
  month1Test: "",
});

const KIT_KEYS = Object.keys(emptyKit()) as Array<keyof PositionKit>;

/** Keeps only known fields, as trimmed strings, so stored JSON can never break the form or the prompt. */
export function normalizeKit(raw: unknown): PositionKit {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kit = emptyKit();
  for (const key of KIT_KEYS) {
    const v = src[key];
    kit[key] = v === null || v === undefined ? "" : String(v).trim();
  }
  return kit;
}

export function parseKitJson(value: unknown): PositionKit | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    return normalizeKit(JSON.parse(text));
  } catch {
    return null;
  }
}

/** The SOP step 1 fields that must be filled before the department head can approve. */
export const ICP_FIELDS: Array<{ key: keyof PositionKit; label: string }> = [
  { key: "vacancies", label: "Number of vacancies" },
  { key: "requiredExperience", label: "Required experience" },
  { key: "keyResponsibilities", label: "Key responsibilities" },
  { key: "mustHaveSkills", label: "Must-have skills" },
  { key: "preferredIndustry", label: "Preferred industry experience" },
  { key: "nonNegotiables", label: "Non-negotiables" },
  { key: "redFlags", label: "Red flags" },
  { key: "rejectionCriteria", label: "Candidate rejection criteria" },
  { key: "salaryRange", label: "Expected salary range" },
];

/** What is still missing before approval (role name, department head and the ICP fields). */
export function kitApprovalProblems(roleName: string, kit: PositionKit | null): string[] {
  const k = kit || emptyKit();
  const missing: string[] = [];
  if (!roleName.trim()) missing.push("Position name");
  if (!k.departmentHead) missing.push("Department head");
  for (const f of ICP_FIELDS) if (!k[f.key]) missing.push(f.label);
  return missing;
}

/** The SOP step 8 checklist: which parts of the kit exist. */
export function kitChecklist(record: Pick<PositionKitRecord, "kit" | "approval">) {
  const k = record.kit || emptyKit();
  const items = [
    { label: "ICP approved", done: record.approval === "Approved" },
    { label: "Interview questions", done: Boolean(k.interviewQuestions) },
    { label: "Qualifying test", done: Boolean(k.qualifyingTest) },
    { label: "Assessment instructions", done: Boolean(k.assessmentInstructions) },
    { label: "Non-negotiables", done: Boolean(k.nonNegotiables) },
    { label: "Red flags", done: Boolean(k.redFlags) },
    { label: "Day 1 test", done: Boolean(k.day1Test) },
    { label: "Day 6 test", done: Boolean(k.day6Test) },
    { label: "2-week test", done: Boolean(k.week2Test) },
    { label: "1-month test", done: Boolean(k.month1Test) },
  ];
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

/** The ICP as text for the AI (CV screening, test generation). */
export function renderIcpContent(roleName: string, kit: PositionKit): string {
  const section = (title: string, body: string) => (body ? `## ${title}\n${body}` : "");
  return [
    `# IDEAL CANDIDATE PROFILE – ${roleName.toUpperCase()}`,
    section("Role", [kit.department && `Department: ${kit.department}`, kit.vacancies && `Vacancies: ${kit.vacancies}`].filter(Boolean).join("\n")),
    section("Required experience", kit.requiredExperience),
    section("Key responsibilities", kit.keyResponsibilities),
    section("Must-have skills", kit.mustHaveSkills),
    section("Preferred industry experience", kit.preferredIndustry),
    section("Non-negotiables (hard rules)", kit.nonNegotiables),
    section("Red flags", kit.redFlags),
    section("Candidate rejection criteria", kit.rejectionCriteria),
    section("Expected salary range", kit.salaryRange),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Lines of a multi-line field, e.g. the extra interview questions. */
export const kitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

const nextVersion = (v: string) => String(Math.floor(Number(v) || 1) + 1);

/**
 * Saving an edit. A change to an approved kit's content starts a new version that needs approval again,
 * so recruitment never runs on an ICP the department head has not seen.
 */
export function applyKitEdit(
  prev: PositionKitRecord | null,
  edit: { roleName: string; status: string; kit: PositionKit },
  now: string
): PositionKitRecord {
  const kit = normalizeKit(edit.kit);
  const roleName = edit.roleName.trim();
  const content = renderIcpContent(roleName, kit);
  if (!prev) {
    return {
      icpId: "",
      roleName,
      status: edit.status || "active",
      version: "1",
      icpContent: content,
      createdAt: now,
      updatedAt: now,
      kit,
      approval: "Draft",
      approvedBy: "",
      approvedAt: "",
    };
  }
  const changed = prev.roleName !== roleName || JSON.stringify(prev.kit) !== JSON.stringify(kit);
  const reapprove = changed && prev.approval === "Approved";
  return {
    ...prev,
    roleName,
    status: edit.status || prev.status,
    version: reapprove ? nextVersion(prev.version) : prev.version,
    icpContent: changed || !prev.kit ? content : prev.icpContent,
    updatedAt: now,
    kit,
    approval: reapprove ? "Draft" : prev.approval,
    approvedBy: reapprove ? "" : prev.approvedBy,
    approvedAt: reapprove ? "" : prev.approvedAt,
  };
}

/** The department head's approval. Throws with the missing fields when the ICP is incomplete. */
export function approveKit(record: PositionKitRecord, approvedBy: string, now: string): PositionKitRecord {
  const missing = kitApprovalProblems(record.roleName, record.kit);
  if (missing.length) throw new Error(`Fill these before approval: ${missing.join(", ")}.`);
  if (!approvedBy.trim()) throw new Error("Enter who approved it.");
  return { ...record, approval: "Approved", approvedBy: approvedBy.trim(), approvedAt: now, updatedAt: now };
}

// ── ICP_Master row mapping ───────────────────────────────

export const ICP_MASTER_HEADERS = [
  "ICP_ID", "Role_Name", "Status", "Version", "ICP_Content", "Created_At", "Updated_At",
  "Kit_JSON", "Approval", "Approved_By", "Approved_At",
];

export function parseIcpMasterRow(r: unknown[]): PositionKitRecord {
  const s = (i: number) => (r[i] === null || r[i] === undefined ? "" : String(r[i]).trim());
  return {
    icpId: s(0),
    roleName: s(1),
    status: s(2) || "active",
    version: s(3) || "1",
    icpContent: s(4),
    createdAt: s(5),
    updatedAt: s(6),
    kit: parseKitJson(r[7]),
    approval: s(8) === "Approved" ? "Approved" : "Draft",
    approvedBy: s(9),
    approvedAt: s(10),
  };
}

export function icpMasterRow(rec: PositionKitRecord): string[] {
  return [
    rec.icpId, rec.roleName, rec.status, rec.version, rec.icpContent, rec.createdAt, rec.updatedAt,
    rec.kit ? JSON.stringify(rec.kit) : "", rec.approval, rec.approvedBy, rec.approvedAt,
  ];
}
