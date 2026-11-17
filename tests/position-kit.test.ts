import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ICP_MASTER_HEADERS,
  applyKitEdit,
  approveKit,
  emptyKit,
  icpMasterRow,
  kitApprovalProblems,
  kitChecklist,
  kitLines,
  normalizeKit,
  parseIcpMasterRow,
  renderIcpContent,
  type PositionKit,
} from "../src/lib/position-kit.ts";
import { pickIcpForPosition } from "../src/lib/cv-screening.ts";

const NOW = "2026-11-17T10:00:00.000Z";
const LATER = "2026-11-20T10:00:00.000Z";

const fullKit = (o: Partial<PositionKit> = {}): PositionKit => ({
  ...emptyKit(),
  department: "Sales",
  departmentHead: "Neha Kapoor",
  vacancies: "3",
  requiredExperience: "2-5 years in salon sales",
  keyResponsibilities: "Consult walk-in clients\nClose treatment packages",
  mustHaveSkills: "- Client consultation\n- Upselling",
  preferredIndustry: "Salons, aesthetics clinics",
  nonNegotiables: "Fluent Hindi and English\nCan work weekends",
  redFlags: "More than 3 jobs in 2 years",
  rejectionCriteria: "No customer-facing experience",
  salaryRange: "₹25,000–35,000 + incentives",
  ...o,
});

test("approval needs the department head and all nine ICP fields", () => {
  assert.deepEqual(kitApprovalProblems("Sales Consultant", fullKit()), []);
  assert.deepEqual(kitApprovalProblems("", fullKit({ departmentHead: "", redFlags: "" })), [
    "Position name",
    "Department head",
    "Red flags",
  ]);
  assert.equal(kitApprovalProblems("Sales", null).length, 10, "department head + the nine ICP fields");
});

test("a new kit starts as a draft v1 and approval records who and when", () => {
  const draft = applyKitEdit(null, { roleName: " Sales Consultant ", status: "active", kit: fullKit() }, NOW);
  assert.deepEqual([draft.roleName, draft.version, draft.approval], ["Sales Consultant", "1", "Draft"]);
  assert.throws(() => approveKit(draft, " ", NOW), /who approved/);
  assert.throws(() => approveKit({ ...draft, kit: fullKit({ salaryRange: "" }) }, "Neha", NOW), /Expected salary range/);

  const approved = approveKit(draft, "Neha Kapoor", LATER);
  assert.deepEqual([approved.approval, approved.approvedBy, approved.approvedAt], ["Approved", "Neha Kapoor", LATER]);
});

test("editing an approved kit makes a new draft version; saving without changes keeps the approval", () => {
  const approved = approveKit(applyKitEdit(null, { roleName: "Sales Consultant", status: "active", kit: fullKit() }, NOW), "Neha", NOW);

  const unchanged = applyKitEdit(approved, { roleName: "Sales Consultant", status: "active", kit: fullKit() }, LATER);
  assert.deepEqual([unchanged.version, unchanged.approval, unchanged.approvedBy], ["1", "Approved", "Neha"]);

  // Tests after joining are part of the kit too, so changing them needs approval again.
  const edited = applyKitEdit(approved, { roleName: "Sales Consultant", status: "active", kit: fullKit({ day1Test: "Product quiz" }) }, LATER);
  assert.deepEqual([edited.version, edited.approval, edited.approvedBy, edited.approvedAt], ["2", "Draft", "", ""]);

  // Deactivating alone is not a content change.
  const inactive = applyKitEdit(approved, { roleName: "Sales Consultant", status: "inactive", kit: fullKit() }, LATER);
  assert.deepEqual([inactive.status, inactive.approval], ["inactive", "Approved"]);
});

test("the ICP text for the AI is built from the fields", () => {
  const text = renderIcpContent("Sales Consultant", fullKit());
  assert.match(text, /^# IDEAL CANDIDATE PROFILE – SALES CONSULTANT/);
  assert.match(text, /## Non-negotiables \(hard rules\)\nFluent Hindi and English/);
  assert.match(text, /Vacancies: 3/);
  assert.doesNotMatch(renderIcpContent("X", emptyKit()), /##/, "empty sections are left out");

  const draft = applyKitEdit(null, { roleName: "Sales Consultant", status: "active", kit: fullKit() }, NOW);
  assert.equal(draft.icpContent, text);
});

test("ICP_Master rows round-trip, and old free-text rows still load", () => {
  const rec = approveKit(applyKitEdit(null, { roleName: "Sales Consultant", status: "active", kit: fullKit() }, NOW), "Neha", LATER);
  const row = icpMasterRow({ ...rec, icpId: "ICP_SALES_1" });
  assert.equal(row.length, ICP_MASTER_HEADERS.length);
  assert.deepEqual(parseIcpMasterRow(row), { ...rec, icpId: "ICP_SALES_1" });

  const legacy = parseIcpMasterRow(["ICP_CRM_EXEC_001", "CRM Executive", "active", 1, "# old text", NOW, NOW]);
  assert.deepEqual([legacy.version, legacy.kit, legacy.approval, legacy.icpContent], ["1", null, "Draft", "# old text"]);
  assert.equal(parseIcpMasterRow(["X", "Y", "active", "1", "", "", "", "{broken"]).kit, null);
});

test("stored kits are cleaned: unknown keys dropped, values trimmed", () => {
  const kit = normalizeKit({ vacancies: 3, redFlags: "  late  ", hack: "x", day1Test: null });
  assert.equal(kit.vacancies, "3");
  assert.equal(kit.redFlags, "late");
  assert.equal(kit.day1Test, "");
  assert.ok(!("hack" in kit));
});

test("checklist covers the SOP step 8 items", () => {
  const c = kitChecklist({ kit: fullKit({ interviewQuestions: "Q1", day1Test: "Quiz" }), approval: "Draft" });
  assert.equal(c.total, 10);
  assert.deepEqual(c.items.filter((i) => i.done).map((i) => i.label), ["Interview questions", "Non-negotiables", "Red flags", "Day 1 test"]);
  assert.equal(kitChecklist({ kit: null, approval: "Approved" }).done, 1);
});

test("multi-line fields split into clean items", () => {
  assert.deepEqual(kitLines("- One\n2) Two\n\n  • Three  \n4. Four"), ["One", "Two", "Three", "Four"]);
});

test("positions find their kit by whole titles only, preferring approved kits", () => {
  const k = (roleName: string, approval = "Draft", status = "active") =>
    ({ icpId: roleName, roleName, status, version: "1", icpContent: "", approval });
  const kits = [k("Hair Technician"), k("CRM Executive"), k("Sales Consultant", "Approved"), k("Senior Sales Consultant")];

  assert.equal(pickIcpForPosition(kits, "Hair stylist"), null, "one shared word is not a match");
  assert.equal(pickIcpForPosition(kits, "CRM")?.icpId, "CRM Executive");
  assert.equal(pickIcpForPosition(kits, "Sales")?.icpId, "Sales Consultant", "approved kit wins the tie");
  assert.equal(pickIcpForPosition(kits, "senior sales consultant")?.icpId, "Senior Sales Consultant", "exact name first");
  assert.equal(pickIcpForPosition([k("Video Editor")], "Senior Video Editor")?.icpId, "Video Editor");
  assert.equal(pickIcpForPosition([k("Receptionist", "Approved", "inactive")], "Receptionist"), null);
});
