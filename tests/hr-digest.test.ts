import { test } from "node:test";
import assert from "node:assert/strict";
import { hrDigestId, alreadySentTo, latestDigest } from "../src/lib/hr-digest.ts";

const row = (at: string, id: string, target: string, status: string, error = "") => [at, id, "", "HR digest", target, "HR", "", "text", status, "", error];

test("digest ids are per day", () => {
  assert.equal(hrDigestId("2026-10-06"), "HR_DIGEST_2026-10-06");
});

test("a person who already got today's digest is skipped on a re-run; failures and other days are not", () => {
  const log = [
    row("2026-10-06T03:31:00Z", "HR_DIGEST_2026-10-06", "919000000001", "Sent"),
    row("2026-10-06T03:31:02Z", "HR_DIGEST_2026-10-06", "919000000002", "Failed", "WAHA down"),
    row("2026-10-05T03:31:00Z", "HR_DIGEST_2026-10-05", "919000000002", "Sent"),
    ["2026-10-06T05:30:00Z", "SALON_MEET_2026-10_R1", "", "1 Day Before", "123@g.us", "PROD", "", "", "Sent", "", ""],
  ];
  assert.deepEqual([...alreadySentTo(log, "HR_DIGEST_2026-10-06")], ["919000000001"], "only the Sent one; the failed one will be retried");
  assert.deepEqual([...alreadySentTo(log, "HR_DIGEST_2026-10-07")], []);
  assert.equal(alreadySentTo([], "x").size, 0);
});

test("latest digest summary counts the newest day only and ignores group reminders", () => {
  const log = [
    row("2026-10-05T03:31:00Z", "HR_DIGEST_2026-10-05", "919000000001", "Sent"),
    row("2026-10-06T03:31:00Z", "HR_DIGEST_2026-10-06", "919000000001", "Sent"),
    row("2026-10-06T03:31:02Z", "HR_DIGEST_2026-10-06", "919000000002", "Failed", "x"),
    ["2026-10-06T05:30:00Z", "SALON_MEET_2026-10_R1", "", "1 Day Before", "123@g.us", "PROD", "", "", "Sent", "", ""],
  ];
  assert.deepEqual(latestDigest(log), { date: "2026-10-06", at: "2026-10-06T03:31:02Z", sent: 1, failed: 1 });
  assert.equal(latestDigest([]), null);
  assert.equal(latestDigest([["t", "SALON_MEET_2026-10_R1"]]), null);
});
