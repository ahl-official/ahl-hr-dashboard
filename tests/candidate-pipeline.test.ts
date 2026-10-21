import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFmsCandidatesStore,
  getFmsCandidateById,
  addFmsCandidateStore,
  updateFmsCandidateStore,
  advanceCandidateStageStore,
  toggleCandidateChecklistStore,
  dropCandidateStore,
  restoreCandidateStore,
} from "../src/lib/fms-candidates-store.ts";
import { calculateFmsDelay, getNextStagePlannedDate } from "../src/lib/fms-rules.ts";
import { FMS_CANDIDATE_STAGES } from "../src/types/fms.ts";

test("calculateFmsDelay computes overdue days accurately", () => {
  const today = new Date();
  const past3Days = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const future3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  // Past date should report 3 days delay
  const delayPast = calculateFmsDelay(past3Days);
  assert.ok(delayPast >= 2 && delayPast <= 4, `Expected ~3 days delay, got ${delayPast}`);

  // Future date should report 0 delay (on track)
  assert.equal(calculateFmsDelay(future3Days), 0);

  // Today should report 0 delay (due today)
  assert.equal(calculateFmsDelay(todayStr), 0);
});

test("advanceCandidateStageStore moves candidate to next stage and auto-computes SLA planned date", async () => {
  // Create test candidate at Stage 1 (Application Received)
  const candidate = await addFmsCandidateStore({
    fullName: "Aarav Mehta",
    phone: "9819001122",
    requisitionId: "REQ-2026-006",
    position: "Senior Hair Stylist",
    brand: "ahl",
  });

  assert.equal(candidate.currentStage, "Application Received");

  // Advance from Application Received -> Interview Updates
  const advanced = await advanceCandidateStageStore(candidate.id, {
    screeningResult: "Pass",
    screeningNotes: "Strong salon experience in Bandra",
  });

  assert.ok(advanced, "Advancement should return updated candidate");
  assert.equal(advanced?.currentStage, "Interview Updates");
  assert.equal(advanced?.stages.ar.status, "Completed");
  assert.ok(advanced?.stages.ar.actualDate, "ar actualDate should be stamped");

  // Interview Updates stage should now have an auto-calculated planned date (approx 3 days out)
  assert.ok(advanced?.stages.ps.plannedDate, "ps plannedDate should be set");
  assert.equal(advanced?.stages.ps.status, "Pending");
});

test("toggleCandidateChecklistStore toggles gate tasks and persists checklist state", async () => {
  const candidate = await addFmsCandidateStore({
    fullName: "Deepika Patel",
    phone: "9820112233",
    requisitionId: "REQ-2026-006",
    position: "Trichologist",
    brand: "alchamae",
  });

  const task = "Verified contact details";
  const updated = await toggleCandidateChecklistStore(candidate.id, "ar", task, true);

  assert.ok(updated, "Candidate checklist toggle should succeed");
  assert.equal(updated?.stages.ar.checklistState?.[task], true);
  assert.equal(updated?.stageData?.ar?.checklist?.[task], true);

  // Toggle off
  const toggledOff = await toggleCandidateChecklistStore(candidate.id, "ar", task, false);
  assert.equal(toggledOff?.stages.ar.checklistState?.[task], false);
});

test("dropCandidateStore and restoreCandidateStore manage candidate rejection and recovery", async () => {
  const candidate = await addFmsCandidateStore({
    fullName: "Kunal Deshmukh",
    phone: "9833445566",
    requisitionId: "REQ-2026-006",
    position: "Salon Stylist",
    brand: "ahl",
  });

  const dropped = await dropCandidateStore(candidate.id, "Failed technical evaluation");
  assert.ok(dropped, "Candidate drop should succeed");
  assert.equal(dropped?.status, "Dropped");
  assert.equal(dropped?.archived, true);
  assert.equal(dropped?.archiveReason, "Failed technical evaluation");

  const restored = await restoreCandidateStore(candidate.id);
  assert.ok(restored, "Candidate restore should succeed");
  assert.equal(restored?.status, "Active");
  assert.equal(restored?.archived, false);
});

test("completing final stage (Onboarding) marks candidate as Hired", async () => {
  const candidate = await addFmsCandidateStore({
    fullName: "Sneha Nair",
    phone: "9820998877",
    requisitionId: "REQ-2026-006",
    position: "Guest Relations Executive",
    brand: "ahl",
  });

  // Fast forward candidate to Onboarding stage
  candidate.currentStage = "Onboarding";
  const finalAdvancement = await advanceCandidateStageStore(candidate.id, {
    empId: "EMP-2026-099",
    mentorName: "Priya Sharma",
  });

  assert.ok(finalAdvancement, "Final advancement should succeed");
  assert.equal(finalAdvancement?.status, "Hired");
  assert.equal(finalAdvancement?.interviewStatus, "Passed");
  assert.equal(finalAdvancement?.stages.ob.status, "Completed");
  assert.equal(finalAdvancement?.stages.ob.actualDate, new Date().toISOString().slice(0, 10));
});

test("Stage 1 Application Status dropdown options update candidate state", async () => {
  const candidate = await addFmsCandidateStore({
    fullName: "Rohan Kapoor",
    phone: "9811223344",
    requisitionId: "REQ-2026-006",
    position: "Senior Hair Stylist",
    brand: "ahl",
  });

  assert.equal(candidate.currentStage, "Application Received");

  // Default initial status
  const updated1 = await updateFmsCandidateStore(candidate.id, {
    applicationStatus: "Under Review",
  });
  assert.equal(updated1?.applicationStatus, "Under Review");

  // Change to Interview Scheduled
  const updated2 = await updateFmsCandidateStore(candidate.id, {
    applicationStatus: "Interview Scheduled",
    interviewStatus: "Scheduled",
  });
  assert.equal(updated2?.applicationStatus, "Interview Scheduled");
  assert.equal(updated2?.interviewStatus, "Scheduled");

  // Change to No Response
  const updated3 = await updateFmsCandidateStore(candidate.id, {
    applicationStatus: "No Response",
  });
  assert.equal(updated3?.applicationStatus, "No Response");

  // Change to Dropped
  const updated4 = await updateFmsCandidateStore(candidate.id, {
    applicationStatus: "Dropped",
    status: "Dropped",
    archived: true,
    archiveReason: "Dropped at Application Received stage",
  });
  assert.equal(updated4?.applicationStatus, "Dropped");
  assert.equal(updated4?.status, "Dropped");
  assert.equal(updated4?.archived, true);
});

test("Stage 2 Interview Updates: updates interview status, reschedule date, and follow-up status", async () => {
  const candidate = await addFmsCandidateStore({
    fullName: "Simran Kaur",
    phone: "9833445566",
    requisitionId: "REQ-2026-006",
    position: "Senior Stylist",
    brand: "ahl",
  });

  // Advance to Stage 2 (Interview Updates)
  const atStage2 = await advanceCandidateStageStore(candidate.id, {});
  assert.equal(atStage2?.currentStage, "Interview Updates");

  // 1. Mark as Rescheduled with date and follow-up status
  const rescheduled = await updateFmsCandidateStore(candidate.id, {
    interviewUpdateStatus: "Rescheduled",
    rescheduledDate: "2026-10-25",
    rescheduledStatus: "Pending",
    interviewStatus: "Rescheduled",
  });
  assert.equal(rescheduled?.interviewUpdateStatus, "Rescheduled");
  assert.equal(rescheduled?.rescheduledDate, "2026-10-25");
  assert.equal(rescheduled?.rescheduledStatus, "Pending");
  assert.equal(rescheduled?.interviewStatus, "Rescheduled");

  // 2. Candidate attends rescheduled interview and is Hired
  const hiredFromReschedule = await updateFmsCandidateStore(candidate.id, {
    rescheduledStatus: "Hired",
    interviewStatus: "Passed",
  });
  assert.equal(hiredFromReschedule?.rescheduledStatus, "Hired");
  assert.equal(hiredFromReschedule?.interviewStatus, "Passed");

  // 3. Mark candidate as Didn't Come for Interview
  const noShow = await updateFmsCandidateStore(candidate.id, {
    interviewUpdateStatus: "Didn't Come for Interview",
    interviewStatus: "Cancelled",
  });
  assert.equal(noShow?.interviewUpdateStatus, "Didn't Come for Interview");
  assert.equal(noShow?.interviewStatus, "Cancelled");

  // 4. Mark candidate as Not Hired
  const notHired = await updateFmsCandidateStore(candidate.id, {
    interviewUpdateStatus: "Not Hired",
    interviewStatus: "Failed",
  });
  assert.equal(notHired?.interviewUpdateStatus, "Not Hired");
  assert.equal(notHired?.interviewStatus, "Failed");

  // 5. Mark candidate as Hired directly
  const directlyHired = await updateFmsCandidateStore(candidate.id, {
    interviewUpdateStatus: "Hired",
    interviewStatus: "Passed",
  });
  assert.equal(directlyHired?.interviewUpdateStatus, "Hired");
  assert.equal(directlyHired?.interviewStatus, "Passed");
});

