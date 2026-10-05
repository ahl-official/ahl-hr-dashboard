import { test, before } from "node:test";
import assert from "node:assert/strict";
import { newToken, hashToken, isTokenShape, expiryFor, inviteState } from "../src/lib/invite-rules.ts";

test("tokens are unguessable, url-safe and only their hash is stored", () => {
  const a = newToken(), b = newToken();
  assert.notEqual(a, b);
  assert.ok(isTokenShape(a));
  assert.ok(a.length >= 30);
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a), hashToken(a));
  for (const bad of ["", "short", "../../etc/passwd", "a".repeat(20) + " ", "x".repeat(100), 5]) assert.ok(!isTokenShape(bad as any), String(bad));
});

test("expiry: 7 days for links, 24 hours for a handed-over device", () => {
  const from = new Date("2026-10-05T10:00:00Z");
  assert.equal(expiryFor("link", from).toISOString(), "2026-10-12T10:00:00.000Z");
  assert.equal(expiryFor("device", from).toISOString(), "2026-10-06T10:00:00.000Z");
});

test("invite state machine", () => {
  const now = new Date("2026-10-05T10:00:00Z");
  const future = "2026-10-06T10:00:00.000Z", past = "2026-10-04T10:00:00.000Z";
  assert.equal(inviteState({ status: "Invited", expiresAt: future }, now), "ok");
  assert.equal(inviteState({ status: "Opened", expiresAt: future }, now), "ok");
  assert.equal(inviteState({ status: "Invited", expiresAt: past }, now), "expired");
  assert.equal(inviteState({ status: "Invited", expiresAt: "garbage" }, now), "expired");
  assert.equal(inviteState({ status: "Submitted", expiresAt: future }, now), "used", "single use");
  assert.equal(inviteState({ status: "Cancelled", expiresAt: future }, now), "cancelled");
  assert.equal(inviteState({ status: "Processing", expiresAt: future }, now), "busy");
});

// ---- endpoint checks (skipped when the dev server is not running); nothing here writes data ----
const BASE = process.env.BASE_URL || "http://localhost:3000";
let up = false;
before(async () => { try { up = (await fetch(BASE + "/api/health")).ok; } catch { up = false; } });
const t = (name: string, fn: () => Promise<void>) => test(name, async (ctx) => { if (!up) return ctx.skip("dev server not running"); await fn(); });
const post = (path: string, body: object) => fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

t("POST /api/invites validates before creating anything", async () => {
  assert.equal((await post("/api/invites", {})).status, 400);
  const base = { name: "Zz Test", company: "American Hairline (AHL)", department: "Accounts", designation: "T", manager: "M", doj: "2026-10-12", mobile: "9876543210" };
  assert.equal((await post("/api/invites", { ...base, mode: "link", mobile: "123" })).status, 400, "bad WhatsApp number");
  assert.equal((await post("/api/invites", { ...base, doj: "2026-02-30" })).status, 400);
  assert.equal((await post("/api/invites", { ...base, company: "Nope Inc" })).status, 400);
  assert.equal((await post("/api/invites", { ...base, department: "Nope" })).status, 400);
});

t("public join endpoints reject bad or unknown tokens", async () => {
  assert.equal((await fetch(BASE + "/api/join/short")).status, 404);
  assert.equal((await fetch(BASE + "/api/join/" + "a".repeat(32))).status, 404);
  assert.equal((await post("/api/join/" + "a".repeat(32), { form: {} })).status, 404);
});
