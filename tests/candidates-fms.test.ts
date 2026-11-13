import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFmsCandidatesStore,
  getFmsCandidateById,
  addFmsCandidateStore,
  updateFmsCandidateStore,
  getFmsCandidatesStats,
} from "../src/lib/fms-candidates-store.ts";
import { normalizeFmsPhone, formatCandidateId } from "../src/lib/fms-rules.ts";

test("candidates store initializes properly with FMS candidates and inbound applications", async () => {
  const all = await getFmsCandidatesStore();
  assert.ok(all.length >= 45, `Expected at least 45 candidates, got ${all.length}`);

  // Test finding by CAND ID
  const first = all.find((c) => c.id === "CAND-0010");
  assert.ok(first, "Expected to find CAND-0010");
  assert.equal(first?.fullName, "Shashank");
  assert.ok(first?.phone.length >= 10, "Phone number should be clean");
  assert.ok(first?.stages?.ar, "Application Received stage should be defined");

  // Test finding by APP ID
  const inbound = all.find((c) => c.id.startsWith("APP-"));
  assert.ok(inbound, "Expected to find at least one inbound APP- record");
  assert.equal(inbound?.currentStage, "Application Received");
  assert.equal(inbound?.status, "Inbound");
});

test("getFmsCandidateById retrieves candidate by id or fmsId", async () => {
  const byId = await getFmsCandidateById("CAND-0010");
  assert.ok(byId, "Candidate should be found by CAND-ID");
  assert.equal(byId?.id, "CAND-0010");

  const byFmsId = await getFmsCandidateById("FMS-9119741f");
  assert.ok(byFmsId, "Candidate should be found by FMS-ID");
  assert.equal(byFmsId?.fullName, "Shashank");
});

test("addFmsCandidateStore creates candidate with next sequence ID and initializes Stage 1", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const newCandidate = await addFmsCandidateStore({
    fullName: "Pooja Verma",
    phone: "+91 98765 43210",
    email: "pooja.verma@example.com",
    requisitionId: "REQ-2026-006",
    position: "Senior Hair Stylist",
    experience: "4 Years",
    source: "LinkedIn",
    currentLocation: "Andheri West, Mumbai",
    preferredLocation: "Bandra Salon",
    expectedSalary: "₹50,000 / mo",
    brand: "ahl",
  });

  assert.ok(newCandidate.id.startsWith("CAND-"), "Candidate ID must start with CAND-");
  const num = parseInt(newCandidate.id.replace("CAND-", ""), 10);
  assert.ok(num >= 42, `Expected sequence number >= 42, got ${num}`);
  assert.equal(newCandidate.phone, "9876543210", "Phone must be normalized to 10 digits");
  assert.equal(newCandidate.currentStage, "Application Received");
  assert.equal(newCandidate.status, "Active");
  assert.equal(newCandidate.requisitionId, "REQ-2026-006");
  assert.equal(newCandidate.stages.ar.plannedDate, today, "Stage 1 plannedDate should be today");
  assert.equal(newCandidate.stages.ar.status, "Pending");

  // Verify it can be retrieved from the store
  const fetched = await getFmsCandidateById(newCandidate.id);
  assert.ok(fetched, "New candidate must be retrievable from store");
  assert.equal(fetched?.fullName, "Pooja Verma");
});

test("updateFmsCandidateStore updates candidate fields and stages", async () => {
  const updated = await updateFmsCandidateStore("CAND-0010", {
    interviewStatus: "Completed",
    notes: "Completed initial screening successfully",
  });

  assert.ok(updated, "Update should succeed");
  assert.equal(updated?.interviewStatus, "Completed");
  assert.equal(updated?.notes, "Completed initial screening successfully");
});

test("getFmsCandidatesStats calculates summary metrics", async () => {
  const stats = await getFmsCandidatesStats();
  assert.ok(stats.total >= 45, "Total count should match candidate volume");
  assert.ok(stats.active >= 1, "Active count should be >= 1");
  assert.ok(stats.inbound >= 5, "Inbound count should be >= 5");
  assert.ok(stats.linkedToReqs >= 10, "Linked requisitions should be >= 10");
  assert.ok(typeof stats.byStage["Application Received"] === "number");
});

test("Candidate FMS delay cell is readable text and parses back to days", async () => {
  const { formatDelayText, parseDelayDays } = await import("../src/lib/candidate-fms-schema.ts");
  assert.equal(formatDelayText("2026-01-10", "2026-01-13", "2026-02-01"), "3 days late");
  assert.equal(formatDelayText("2026-01-10", "2026-01-11", "2026-02-01"), "1 day late");
  assert.equal(formatDelayText("2026-01-10", "2026-01-09", "2026-02-01"), "On time");
  assert.equal(formatDelayText("2026-01-10", "", "2026-01-15"), "5 days overdue");
  assert.equal(formatDelayText("2026-01-10", "", "2026-01-05"), "On track");
  assert.equal(formatDelayText("", "", "2026-01-05"), "");
  assert.equal(parseDelayDays("3 days late"), 3);
  assert.equal(parseDelayDays(4), 4);
  assert.equal(parseDelayDays("On time"), 0);
  assert.equal(parseDelayDays("Dropped – 13 days overdue"), 13);
});

test("dropping stops the pipeline at the current stage and restoring resumes it", async () => {
  const { candidateToRow, rowToCandidateFields, candidateFmsIndex, CANDIDATE_FMS_HEADERS } = await import(
    "../src/lib/candidate-fms-schema.ts"
  );
  const index = candidateFmsIndex(CANDIDATE_FMS_HEADERS);
  const cell = (row: unknown[], header: string) => row[CANDIDATE_FMS_HEADERS.indexOf(header)];
  const base: any = {
    id: "CAND-9001",
    fullName: "Drop Test",
    phone: "9999999999",
    currentStage: "Application Received",
    status: "Active",
    updatedAt: "2026-11-10",
    stageData: {},
    personalDetails: {},
    stages: {
      ar: { plannedDate: "2026-10-29", status: "Pending" },
      // Left behind by an earlier advance + revert.
      ps: { plannedDate: "2026-11-05", status: "Pending" },
    },
  };

  const active = candidateToRow(base, undefined, "2026-11-13");
  assert.equal(cell(active, "Application Received Time Delay (Days)"), "15 days overdue");
  assert.equal(cell(active, "Dropped Date"), "");

  const original = rowToCandidateFields(active, index);
  const dropped = candidateToRow({ ...original, status: "Dropped", archived: true }, original, "2026-11-10");
  assert.equal(cell(dropped, "Application Status"), "Dropped");
  assert.equal(rowToCandidateFields(dropped, index).stages?.ar.status, "Dropped");
  assert.equal(cell(dropped, "Application Received Actual"), "2026-11-10");
  assert.equal(cell(dropped, "Application Received Time Delay (Days)"), "Dropped – 12 days overdue");
  assert.equal(cell(dropped, "Dropped Date"), "2026-11-10");
  assert.equal(cell(dropped, "Interview Updates Planned"), "");
  assert.equal(cell(dropped, "Interview Updates Status"), "");
  assert.equal(cell(dropped, "Interview Updates Time Delay (Days)"), "");

  // Saving the row again later must not move the clock.
  const reread = rowToCandidateFields(dropped, index);
  const later = candidateToRow(reread, reread, "2026-12-31");
  assert.equal(cell(later, "Application Received Time Delay (Days)"), "Dropped – 12 days overdue");
  assert.equal(cell(later, "Dropped Date"), "2026-11-10");

  // Rows dropped before the Dropped Date column existed fall back to their last update.
  const legacy = [...dropped];
  legacy[CANDIDATE_FMS_HEADERS.indexOf("Dropped Date")] = "";
  assert.equal(rowToCandidateFields(legacy, index).droppedDate, "2026-11-10");

  const { applyStatusDates } = await import("../src/lib/candidate-fms-schema.ts");
  // restoreCandidateStore also reopens Application Status.
  const restoredCand = applyStatusDates(
    { ...reread, status: "Active", archived: false, applicationStatus: "Under Review" },
    reread,
    "2026-12-31"
  );
  const restored = candidateToRow(restoredCand, reread, "2026-12-31");
  assert.equal(cell(restored, "Application Status"), "Under Review");
  assert.equal(rowToCandidateFields(restored, index).stages?.ar.status, "In Progress");
  assert.equal(cell(restored, "Application Received Actual"), "");
  assert.equal(cell(restored, "Dropped Date"), "");
  assert.match(String(cell(restored, "Application Received Time Delay (Days)")), /overdue$/);
});

test("stage 1 uses Application Status as its only status column", async () => {
  const { CANDIDATE_FMS_HEADERS, candidateToRow, candidateFmsIndex, rowToCandidateFields } = await import(
    "../src/lib/candidate-fms-schema.ts"
  );
  assert.ok(!CANDIDATE_FMS_HEADERS.includes("Application Received Status"));
  assert.ok(CANDIDATE_FMS_HEADERS.includes("Application Status"));
  assert.ok(CANDIDATE_FMS_HEADERS.includes("Interview Updates Status"), "other stages keep their Status column");

  const index = candidateFmsIndex(CANDIDATE_FMS_HEADERS);
  const row = candidateToRow({ id: "CAND-9004", currentStage: "Application Received", status: "Active", stages: {}, stageData: {} } as any);
  assert.equal(row[CANDIDATE_FMS_HEADERS.indexOf("Application Status")], "Under Review", "never blank");

  // The stage status is derived from Current Stage when read back.
  const later = candidateToRow({ id: "CAND-9005", currentStage: "Confirmation Call", status: "Active", stages: {}, stageData: {} } as any);
  const read = rowToCandidateFields(later, index);
  assert.equal(read.stages?.ar.status, "Completed");
  assert.equal(read.stages?.ps.status, "Pending", "stages with a Status column keep their saved value");
});

test("rows are written by column name so a sheet mid-migration stays aligned", async () => {
  const { CANDIDATE_FMS_HEADERS, alignRowToSheetHeader } = await import("../src/lib/candidate-fms-schema.ts");
  const row = CANDIDATE_FMS_HEADERS.map((h) => `v:${h}`);
  // Sheet still has the removed column in the middle and its columns in a different order.
  const sheetHeader = ["FMS ID", "Candidate ID", "Application Received Actual", "Application Received Status", "Application Status", "Dropped Date"];
  assert.deepEqual(alignRowToSheetHeader(row, sheetHeader), [
    "v:FMS ID",
    "v:Candidate ID",
    "v:Application Received Actual",
    null,
    "v:Application Status",
    "v:Dropped Date",
  ]);
});

test("the Drop button keeps the stage-1 outcome of candidates already past stage 1", async () => {
  const { dropCandidateStore } = await import("../src/lib/fms-candidates-store.ts");
  const later = (await getFmsCandidatesStore()).find(
    (c) => !c.archived && c.status === "Active" && c.currentStage !== "Application Received"
  );
  if (!later) return; // seed data without a later-stage candidate
  await updateFmsCandidateStore(later.id, { applicationStatus: "Interview Scheduled" });
  const dropped = await dropCandidateStore(later.id);
  assert.equal(dropped?.applicationStatus, "Interview Scheduled");
});

test("a status update stamps the Actual date of the candidate's current stage", async () => {
  const { applyStatusDates } = await import("../src/lib/candidate-fms-schema.ts");
  const prev: any = {
    id: "CAND-9002",
    currentStage: "Application Received",
    status: "Active",
    stageData: {},
    stages: { ar: { plannedDate: "2026-11-01", status: "Pending" }, ps: { status: "Pending" } },
  };

  // Stage 1: Application Status set from the pipeline card.
  const scheduled = applyStatusDates({ ...prev, applicationStatus: "Interview Scheduled" }, prev, "2026-11-03");
  assert.equal(scheduled.stages.ar.actualDate, "2026-11-03");
  assert.equal(scheduled.stages.ar.plannedDate, "2026-11-01");

  // A later change moves the date; saving without a change keeps it.
  const noResponse = applyStatusDates({ ...scheduled, applicationStatus: "No Response" }, scheduled, "2026-11-05");
  assert.equal(noResponse.stages.ar.actualDate, "2026-11-05");
  assert.equal(applyStatusDates({ ...noResponse }, noResponse, "2026-11-09").stages.ar.actualDate, "2026-11-05");

  // Back to the open value is not an outcome.
  assert.equal(applyStatusDates({ ...prev, applicationStatus: "Under Review" }, prev, "2026-11-03").stages.ar.actualDate, undefined);

  // The same status set through the stage form (fieldValues) counts too.
  const viaForm = applyStatusDates(
    { ...prev, stages: { ...prev.stages, ar: { ...prev.stages.ar, fieldValues: { applicationStatus: "No Response" } } } },
    prev,
    "2026-11-04"
  );
  assert.equal(viaForm.stages.ar.actualDate, "2026-11-04");

  // Stage 2: Interview Status, then the rescheduled outcome.
  const inInterview: any = { ...prev, currentStage: "Interview Updates", stages: { ...prev.stages, ar: { status: "Completed", actualDate: "2026-11-02" } } };
  const resched = applyStatusDates({ ...inInterview, interviewUpdateStatus: "Rescheduled" }, inInterview, "2026-11-06");
  assert.equal(resched.stages.ps.actualDate, "2026-11-06");
  const hired = applyStatusDates({ ...resched, rescheduledStatus: "Hired" }, resched, "2026-11-08");
  assert.equal(hired.stages.ps.actualDate, "2026-11-08");
  assert.equal(hired.stages.ar.actualDate, "2026-11-02", "completed stages keep their own date");
});

test("dropping stamps only the current stage, never a completed one", async () => {
  const { applyStatusDates } = await import("../src/lib/candidate-fms-schema.ts");
  const prev: any = {
    id: "CAND-9003",
    currentStage: "Joining",
    status: "Active",
    applicationStatus: "Interview Scheduled",
    stageData: {},
    stages: {
      ar: { status: "Completed", actualDate: "2026-10-01" },
      ps: { status: "Completed", actualDate: "2026-10-05" },
      cc: { status: "Completed", actualDate: "2026-10-08" },
      jo: { plannedDate: "2026-10-15", status: "Pending" },
    },
  };
  // The Drop button also sets the stage-1 Application Status to Dropped.
  const dropped = applyStatusDates({ ...prev, status: "Dropped", archived: true, applicationStatus: "Dropped" }, prev, "2026-10-20");
  assert.equal(dropped.droppedDate, "2026-10-20");
  assert.deepEqual(
    [dropped.stages.ar.actualDate, dropped.stages.ps.actualDate, dropped.stages.cc.actualDate, dropped.stages.jo.actualDate],
    ["2026-10-01", "2026-10-05", "2026-10-08", "2026-10-20"]
  );
  assert.equal(dropped.stages.jo.status, "Dropped");
});

test("status updates through the store stamp the Actual date in the pipeline", async () => {
  const cand = (await getFmsCandidatesStore()).find(
    (c) => !c.archived && c.status === "Active" && c.currentStage === "Application Received"
  );
  assert.ok(cand, "An active stage-1 candidate must exist");
  const updated = await updateFmsCandidateStore(cand.id, { applicationStatus: "No Response" });
  assert.equal(updated?.stages.ar.actualDate, new Date().toISOString().slice(0, 10));
});

test("a dropped candidate cannot be advanced to the next stage", async () => {
  const { advanceCandidateStageStore, dropCandidateStore, restoreCandidateStore } = await import(
    "../src/lib/fms-candidates-store.ts"
  );
  const cand = (await getFmsCandidatesStore()).find((c) => c.status === "Active" && !c.archived)!;
  const stage = cand.currentStage;
  await dropCandidateStore(cand.id);
  await assert.rejects(() => advanceCandidateStageStore(cand.id), /is dropped/);
  assert.equal((await getFmsCandidateById(cand.id))?.currentStage, stage);
  await restoreCandidateStore(cand.id);
  assert.equal((await getFmsCandidateById(cand.id))?.status, "Active");
});
