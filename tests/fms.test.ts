import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFmsDelay,
  computeStageStatus,
  getNextStagePlannedDate,
  normalizeFmsPhone,
  formatCandidateId,
  formatRequisitionId,
} from "../src/lib/fms-rules.ts";
import { FMS_CANDIDATE_STAGES } from "../src/types/fms.ts";

test("FMS Candidate Stages configuration and ordering", () => {
  assert.equal(FMS_CANDIDATE_STAGES.length, 6);
  assert.deepEqual(
    FMS_CANDIDATE_STAGES.map((s) => s.id),
    ["ar", "ps", "cc", "jo", "doc", "ob"]
  );
  assert.equal(FMS_CANDIDATE_STAGES[0].name, "Application Received");
  assert.equal(FMS_CANDIDATE_STAGES[1].name, "Interview Updates");
  assert.equal(FMS_CANDIDATE_STAGES[2].name, "Confirmation Call");
  assert.equal(FMS_CANDIDATE_STAGES[3].name, "Joining");
  assert.equal(FMS_CANDIDATE_STAGES[4].name, "Documentation");
  assert.equal(FMS_CANDIDATE_STAGES[5].name, "Onboarding");
});

test("calculateFmsDelay computes positive days of delay", () => {
  const planned = "2026-05-10";
  const actualLate = "2026-05-15";
  assert.equal(calculateFmsDelay(planned, actualLate), 5);

  const actualOnTime = "2026-05-10";
  assert.equal(calculateFmsDelay(planned, actualOnTime), 0);

  const actualEarly = "2026-05-08";
  assert.equal(calculateFmsDelay(planned, actualEarly), 0);
});

test("computeStageStatus evaluates stage lifecycle", () => {
  assert.equal(computeStageStatus("2029-05-10", "2029-05-12"), "Completed");

  assert.equal(
    computeStageStatus("2029-05-10", "", { item1: true, item2: true }, 2),
    "Completed"
  );

  assert.equal(
    computeStageStatus("2029-05-10", "", { item1: true, item2: false }, 2),
    "In Progress"
  );

  const pastDate = "2020-01-01";
  assert.equal(computeStageStatus(pastDate, "", {}), "Overdue");
});

test("getNextStagePlannedDate calculates SLA target date", () => {
  const start = new Date("2026-05-01T00:00:00Z");
  const nextDate = getNextStagePlannedDate(start, 1); // 1 week = 7 days
  assert.equal(nextDate, "2026-05-08");
});

test("normalizeFmsPhone formats Indian phone numbers cleanly", () => {
  assert.equal(normalizeFmsPhone("9876543210"), "9876543210");
  assert.equal(normalizeFmsPhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizeFmsPhone("919876543210"), "9876543210");
});

test("formatCandidateId and formatRequisitionId format IDs sequentially", () => {
  assert.equal(formatCandidateId(1), "CAND-0001");
  assert.equal(formatCandidateId(45), "CAND-0045");
  assert.equal(formatRequisitionId(2026, 6), "REQ-2026-006");
});
