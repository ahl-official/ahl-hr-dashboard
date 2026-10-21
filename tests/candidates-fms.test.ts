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
