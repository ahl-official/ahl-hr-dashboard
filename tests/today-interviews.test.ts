import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getInterviewsStore,
  getInterviewsStats,
  scheduleInterviewStore,
  logInterviewOutcomeStore,
  getFmsCandidateById,
} from "../src/lib/fms-candidates-store.ts";
import { normalizeFmsPhone } from "../src/lib/fms-rules.ts";

test("getInterviewsStore loads enriched interview records for today", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const todayInterviews = await getInterviewsStore(today);

  assert.ok(todayInterviews.length >= 3, `Expected at least 3 interviews for today, got ${todayInterviews.length}`);

  const first = todayInterviews[0];
  assert.ok(first.id, "Interview ID must be defined");
  assert.ok(first.candidateId, "Candidate ID must be defined");
  assert.ok(first.candidateName, "Candidate name must be enriched");
  assert.ok(first.candidatePhone, "Candidate phone must be enriched");
  assert.ok(first.roundName, "Round name must be defined");
  assert.ok(first.scheduledTime, "Time slot must be specified");
  assert.ok(["In-Person", "Video Call", "Phone Call"].includes(first.mode));
});

test("getInterviewsStats computes accurate summary metrics", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const stats = await getInterviewsStats(today);

  assert.ok(stats.total >= 3, "Total should be at least 3");
  assert.ok(stats.scheduled >= 2, "Scheduled should be at least 2");
  assert.equal(typeof stats.passed, "number");
  assert.equal(typeof stats.failed, "number");
  assert.equal(typeof stats.onHold, "number");
});

test("scheduleInterviewStore books a new interview slot for an active candidate", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const res = await scheduleInterviewStore({
    candidateId: "CAND-0010",
    roundName: "Technical Cut & Color Demo",
    scheduledDate: today,
    scheduledTime: "04:30 PM",
    mode: "In-Person",
    locationOrLink: "Bandra Flagship Salon - Station 5",
    interviewerName: "Pooja Malhotra (Lead Stylist)",
    durationMinutes: 60,
  });

  assert.ok(res, "Expected scheduleInterviewStore to return result");
  assert.ok(res.interview.id.startsWith("INT-CAND-0010-"), "Interview ID must match convention");
  assert.equal(res.interview.status, "Scheduled");
  assert.equal(res.candidate.interviewStatus, "Scheduled");
  assert.equal(res.interview.interviewerName, "Pooja Malhotra (Lead Stylist)");

  // Verify it appears in today's interviews query
  const todayList = await getInterviewsStore(today);
  const found = todayList.find((i) => i.id === res.interview.id);
  assert.ok(found, "Newly scheduled interview must appear in getInterviewsStore query");
});

test("logInterviewOutcomeStore with status Passed advances candidate to next FMS stage", async () => {
  const candidate = await getFmsCandidateById("CAND-0012");
  assert.ok(candidate, "Candidate CAND-0012 must exist");
  const initialStage = candidate.currentStage;

  // Schedule an interview first
  const today = new Date().toISOString().slice(0, 10);
  const sched = await scheduleInterviewStore({
    candidateId: "CAND-0012",
    roundName: "HR Culture & Values Alignment",
    scheduledDate: today,
    scheduledTime: "02:00 PM",
    mode: "Video Call",
    interviewerName: "Ayesha Khan (HR Lead)",
    durationMinutes: 45,
  });

  assert.ok(sched, "Interview should be scheduled");

  // Log Passed outcome with rating and auto-advance
  const outcomeRes = await logInterviewOutcomeStore("CAND-0012", sched.interview.id, {
    status: "Passed",
    rating: 5,
    feedback: "Exceptional cultural fit, passionate about luxury salon client experience.",
    advanceToNextStage: true,
  });

  assert.ok(outcomeRes, "Outcome should be logged");
  assert.equal(outcomeRes.interview.status, "Passed");
  assert.equal(outcomeRes.interview.rating, 5);
  assert.equal(outcomeRes.candidate.interviewStatus, "Passed");
  assert.notEqual(outcomeRes.candidate.currentStage, initialStage, "Candidate must advance to next stage");
});

test("logInterviewOutcomeStore with status Failed marks candidate dropped", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const sched = await scheduleInterviewStore({
    candidateId: "CAND-0013",
    roundName: "Technical Screen",
    scheduledDate: today,
    scheduledTime: "06:00 PM",
    mode: "Phone Call",
    interviewerName: "Vikram Mehta",
  });

  assert.ok(sched, "Interview should be scheduled");

  // Log Failed outcome
  const failRes = await logInterviewOutcomeStore("CAND-0013", sched.interview.id, {
    status: "Failed",
    rating: 2,
    feedback: "Incomplete technical background for senior role.",
    advanceToNextStage: false,
  });

  assert.ok(failRes, "Failed outcome logged");
  assert.equal(failRes.interview.status, "Failed");
  assert.equal(failRes.candidate.status, "Dropped");
  assert.equal(failRes.candidate.interviewStatus, "Failed");
});

test("WhatsApp reminder generation uses clean normalized phone", () => {
  const rawPhone = "+91 98765 43210";
  const clean = normalizeFmsPhone(rawPhone);
  assert.equal(clean, "9876543210");

  const formattedUrl = `https://wa.me/91${clean}?text=InterviewReminder`;
  assert.equal(formattedUrl, "https://wa.me/919876543210?text=InterviewReminder");
});
