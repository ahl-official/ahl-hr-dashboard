// Integration checks against the running dev server (npm run dev). Skipped when it is not up.
// Only reads data and sends requests that must be rejected BEFORE anything is written to the sheet.
import { test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";
let up = false;
let employees: any[] = [];
let meetings: any[] = [];
let dept = "";

const call = (path: string, init?: RequestInit) =>
  fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json" } }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));

before(async () => {
  try {
    const d = await call("/api/dashboard");
    up = d.status === 200;
    employees = d.body?.employees ?? [];
    meetings = d.body?.meetings ?? [];
    dept = (await call("/api/meta/departments")).body?.data?.[0]?.departmentName ?? "";
  } catch {
    up = false;
  }
});

const t = (name: string, fn: () => Promise<void>) =>
  test(name, async (ctx) => {
    if (!up) return ctx.skip("dev server not running");
    await fn();
  });

t("health reports a connected database", async () => {
  const r = await call("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.services.storage.database, "connected");
});

t("dashboard data is internally consistent", async () => {
  assert.ok(employees.length > 0);
  const keys = employees.map((e) => e.employeeKey);
  assert.equal(new Set(keys).size, keys.length, "employeeKey must be unique");
  for (const e of employees) {
    assert.ok(e.fullName, `row ${e.rowNumber} has no name`);
    assert.ok(["Active", "Left"].includes(e.employmentStatus));
  }
  const known = new Set(keys);
  for (const m of meetings) assert.ok(known.has(m.employeeKey), `meeting ${m.meetingId} points at a missing employee`);
});

t("dates in the master sheet are valid ISO (data-quality report)", async () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const bad = employees.filter((e) => (e.doj && !iso.test(e.doj)) || (e.dob && !iso.test(e.dob)));
  if (bad.length) console.log(`  ! ${bad.length} employees have non-ISO DOJ/DOB:`, bad.map((e) => `${e.fullName}(${e.doj}|${e.dob})`).join(", "));
  assert.equal(bad.length, 0, "unparseable dates silently drop people from birthdays and reviews");
});

t("employee IDs are unique within each company (data-quality report)", async () => {
  // IDs are numbered per company, so only (company, id) pairs must be unique.
  const seen = new Map<string, string[]>();
  for (const e of employees.filter((x) => x.employeeId && x.employeeId !== "0")) {
    const k = `${e.company}|${e.employeeId}`;
    seen.set(k, [...(seen.get(k) ?? []), e.fullName]);
  }
  const dups = [...seen].filter(([, v]) => v.length > 1);
  if (dups.length) console.log("  ! same ID twice in one company (fix in the sheet):", dups.map(([k, v]) => `${k}: ${v.join(" / ")}`).join("; "));
  const blank = employees.filter((e) => !e.employeeId || e.employeeId === "0" || !e.company);
  if (blank.length) console.log(`  ! ${blank.length} rows with a missing/0 ID or missing company:`, blank.map((e) => e.fullName).join(", "));
});

t("POST /api/meetings validates input", async () => {
  assert.equal((await call("/api/meetings", { method: "POST", body: "{}" })).status, 400);
  const r = await call("/api/meetings", {
    method: "POST",
    body: JSON.stringify({ employeeKey: "EMP-DOES-NOT-EXIST", discussionNotes: "x", recordedBy: "test" }),
  });
  assert.equal(r.status, 404);
  const key = employees[0].employeeKey;
  const bad = await call("/api/meetings", {
    method: "POST",
    body: JSON.stringify({ employeeKey: key, discussionNotes: "x", recordedBy: "t", nextFollowUpDate: "2026-02-30" }),
  });
  assert.equal(bad.status, 400, "impossible date must be rejected, not written to the sheet");
  const badType = await call("/api/meetings", {
    method: "POST",
    body: JSON.stringify({ employeeKey: key, discussionNotes: "x", recordedBy: "t", meetingType: "Bogus" }),
  });
  assert.equal(badType.status, 400);
});

t("PATCH /api/meetings rejects bad status and unknown ids", async () => {
  assert.equal((await call("/api/meetings", { method: "PATCH", body: "{}" })).status, 400);
  assert.equal((await call("/api/meetings", { method: "PATCH", body: JSON.stringify({ meetingId: "MTG-X", recordStatus: "Bogus" }) })).status, 400);
  assert.equal((await call("/api/meetings", { method: "PATCH", body: JSON.stringify({ meetingId: "MTG-NOPE", recordStatus: "Completed" }) })).status, 404);
});

t("PUT employee status validates", async () => {
  const key = employees[0].employeeKey;
  const put = (k: string, b: object) => call(`/api/employees/${k}/status`, { method: "PUT", body: JSON.stringify(b) });
  assert.equal((await put(key, {})).status, 400);
  assert.equal((await put(key, { employmentStatus: "Left" })).status, 400, "Left needs a last working date");
  assert.equal((await put(key, { employmentStatus: "Left", lastWorkingDate: "2026-02-30" })).status, 400);
  assert.equal((await put(key, { employmentStatus: "Left", lastWorkingDate: "1990-01-01" })).status, 400, "LWD before DOJ");
  assert.equal((await put("EMP-NOPE", { employmentStatus: "Active" })).status, 404);
});

t("POST /api/documents validates input", async () => {
  assert.equal((await call("/api/documents", { method: "POST", body: "{}" })).status, 400);
  const r = await call("/api/documents", {
    method: "POST",
    body: JSON.stringify({ employeeKey: employees[0].employeeKey, documentType: "Other", documentStatus: "Verified", uploadedBy: "t" }),
  });
  assert.equal(r.status, 400, "Verified needs a drive link");
});

t("creating employees directly over the API is closed (joiners go through /api/join)", async () => {
  const r = await call("/api/employees", { method: "POST", body: JSON.stringify({ fullName: "Zz", company: "AHL", department: dept }) });
  assert.equal(r.status, 405);
});

t("GET /api/employees filters and paginates", async () => {
  const r = await call("/api/employees?pageSize=5&page=1");
  assert.equal(r.body.data.length, 5);
  assert.ok(r.body.pagination.total >= 5);
  const none = await call("/api/employees?search=zzzzzz-no-match");
  assert.equal(none.body.pagination.total, 0);
  assert.equal((await call("/api/employees/EMP-NOPE")).status, 404);
});
