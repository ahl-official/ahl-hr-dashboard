import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRIBUTION_AREAS,
  MAX_SAMPLES,
  contributionSummary,
  getWorkSamples,
  samplesRequired,
  validateWorkSample,
  workSampleProgress,
  workSamplesUpdate,
  type WorkSample,
} from "../src/lib/work-samples.ts";
import { applyKitEdit, approveKit, emptyKit, parseIcpMasterRow, icpMasterRow, type PositionKit } from "../src/lib/position-kit.ts";
import { candidateFmsIndex, candidateToRow, rowToCandidateFields, CANDIDATE_FMS_HEADERS } from "../src/lib/candidate-fms-schema.ts";

const sample = (o: Partial<WorkSample> = {}): WorkSample => ({
  id: "WS-1",
  title: "Diwali offer reel",
  link: "https://www.instagram.com/reel/abc123",
  contribution: { idea: "Self", edit: "Self", shoot: "Shared", distribution: "No" },
  candidateRole: "Planned the hook and edited the reel; the brand's videographer shot it.",
  verdict: "Own work",
  hrNotes: "",
  addedAt: "2026-11-18T10:00:00.000Z",
  ...o,
});

test("the SOP's seven contribution questions are all asked", () => {
  assert.deepEqual(
    CONTRIBUTION_AREAS.map((a) => a.key),
    ["idea", "script", "shoot", "edit", "design", "distribution", "results"]
  );
});

test("a sample needs a title, a real link, a marked contribution, their own account and a verdict", () => {
  assert.equal(validateWorkSample(sample()), null);
  assert.match(validateWorkSample(sample({ title: " " }))!, /title/);
  assert.match(validateWorkSample(sample({ link: "my drive" }))!, /link/);
  assert.match(validateWorkSample(sample({ link: "https://x" }))!, /link/);
  assert.match(validateWorkSample(sample({ contribution: {} }))!, /at least one area/);
  assert.match(validateWorkSample(sample({ candidateRole: "" }))!, /says they did/);
  assert.match(validateWorkSample(sample({ verdict: "Great" }))!, /verdict/);
});

test("the summary names what they did themselves and with a team, skipping No", () => {
  assert.equal(
    contributionSummary(sample().contribution),
    "Developed the idea: themselves · Shot it: with a team · Edited it: themselves"
  );
  assert.equal(contributionSummary({}), "");
});

test("progress counts against the kit's minimum only when samples are required", () => {
  assert.deepEqual(workSampleProgress([sample()], true), { count: 1, required: true, min: 2, complete: false });
  assert.equal(workSampleProgress([sample(), sample({ id: "WS-2" })], true).complete, true);
  assert.equal(workSampleProgress([], false).complete, true);
  assert.equal(samplesRequired({ workSamplesRequired: "yes" }), true);
  assert.equal(samplesRequired({ workSamplesRequired: "" }), false);
  assert.equal(samplesRequired(null), false);
});

test("samples are saved in the candidate's stage data and survive the sheet round trip", () => {
  const base: any = { id: "CAND-9200", fullName: "Riya", phone: "9", currentStage: "Interview Updates", status: "Active", stageData: { ps: { interviewSheet: { answers: { noticePeriod: "15 days" } } } }, stages: {}, personalDetails: {} };
  const many = Array.from({ length: 7 }, (_, i) => sample({ id: `WS-${i}` }));
  const update = workSamplesUpdate(base, many);
  assert.equal(getWorkSamples(update as any).length, MAX_SAMPLES);
  assert.equal(update.stageData?.ps?.interviewSheet?.answers?.noticePeriod, "15 days", "other interview data is kept");

  const back = rowToCandidateFields(candidateToRow({ ...base, ...update }), candidateFmsIndex(CANDIDATE_FMS_HEADERS));
  assert.equal(getWorkSamples(back as any)[0].contribution.edit, "Self");
});

test("kits gain the work-sample fields without disturbing kits approved before them", () => {
  const kit: PositionKit = {
    ...emptyKit(),
    departmentHead: "Neha", vacancies: "1", requiredExperience: "2y", keyResponsibilities: "Edit", mustHaveSkills: "Premiere",
    preferredIndustry: "Media", nonNegotiables: "Portfolio", redFlags: "None", rejectionCriteria: "No reel", salaryRange: "30k",
  };
  const approved = approveKit(applyKitEdit(null, { roleName: "Video Editor", status: "active", kit }, "2026-11-01"), "Neha", "2026-11-01");
  // A row written before the new fields existed has no workSamples keys in its JSON.
  const row = icpMasterRow({ ...approved, icpId: "ICP_1" });
  const old = JSON.parse(row[7]);
  delete old.workSamplesRequired;
  delete old.workSampleTypes;
  row[7] = JSON.stringify(old);
  const loaded = parseIcpMasterRow(row);
  assert.equal(loaded.kit?.workSamplesRequired, "");
  const resaved = applyKitEdit(loaded, { roleName: "Video Editor", status: "active", kit: loaded.kit! }, "2026-11-18");
  assert.deepEqual([resaved.approval, resaved.version], ["Approved", "1"]);

  const turnedOn = applyKitEdit(loaded, { roleName: "Video Editor", status: "active", kit: { ...loaded.kit!, workSamplesRequired: "yes" } }, "2026-11-18");
  assert.deepEqual([turnedOn.approval, turnedOn.version], ["Draft", "2"], "requiring samples is a kit change that needs approval");
});
