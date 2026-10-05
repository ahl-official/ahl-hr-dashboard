import { test } from "node:test";
import assert from "node:assert/strict";
import { companyCode, departmentCode, idNumber, nextEmployeeNumber, formatEmployeeId, DEPARTMENT_CODES } from "../src/lib/employee-id.ts";

test("company and department codes", () => {
  assert.equal(companyCode("American Hairline (AHL)"), "AHL");
  assert.equal(companyCode("alchemane (alc)"), "ALC", "case-insensitive");
  assert.equal(companyCode("YDigital"), "YD");
  assert.equal(departmentCode("Artificial Intelligence (AI)"), "AI");
  assert.equal(departmentCode("  accounts "), "ACC");
  assert.equal(departmentCode("Brand New Team"), "BNT", "unknown departments fall back to initials");
  assert.equal(departmentCode("Legal"), "LEG");
  assert.equal(departmentCode(""), "GEN");
});

test("codes are short, uppercase and unambiguous", () => {
  for (const [dept, code] of Object.entries(DEPARTMENT_CODES)) {
    assert.match(code, /^[A-Z]{2,3}$/, dept);
  }
});

test("idNumber reads new-format IDs only", () => {
  assert.equal(idNumber("AHL-AI-0093"), 93);
  assert.equal(idNumber("YD-CSE-0007"), 7);
  for (const legacy of ["40", "14050298", "patrajoshana08@gmail.com", "", "abc"]) assert.equal(idNumber(legacy), null, legacy);
});

test("numbering ignores messy legacy IDs and other companies", () => {
  const emps = [
    { company: "American Hairline (AHL)", employeeId: "14050298" }, // real-world junk legacy value
    { company: "American Hairline (AHL)", employeeId: "123456" },
    { company: "American Hairline (AHL)", employeeId: "patrajoshana08@gmail.com" },
    { company: "American Hairline (AHL)", employeeId: "AHL-AI-0050" },
    { company: "American Hairline (AHL)", employeeId: "ahl-hr-0007" },
    { company: "Alchemane (ALC)", employeeId: "90" },
    { company: "YDigital", employeeId: "YD-DM-0012" },
  ];
  assert.equal(nextEmployeeNumber(emps, "American Hairline (AHL)"), 51);
  assert.equal(nextEmployeeNumber(emps, "Alchemane (ALC)"), 1, "only legacy IDs so far, so new sequence starts at 1");
  assert.equal(nextEmployeeNumber(emps, "YDigital"), 13);
  assert.equal(nextEmployeeNumber(emps, "Brand New Co"), 1);
  assert.equal(nextEmployeeNumber([], "AHL"), 1);
});

test("the ID prefix, not the company field, decides whose number space an ID uses", () => {
  // an AHL-prefixed ID mistakenly filed under YDigital still blocks that AHL number
  const emps = [{ company: "YDigital", employeeId: "AHL-AI-0999" }];
  assert.equal(nextEmployeeNumber(emps, "American Hairline (AHL)"), 1000);
  assert.equal(nextEmployeeNumber(emps, "YDigital"), 1);
});

test("formatted ID looks like AHL-AI-0093 and numbers are never reused", () => {
  assert.equal(formatEmployeeId("American Hairline (AHL)", "Artificial Intelligence (AI)", 93), "AHL-AI-0093");
  assert.equal(formatEmployeeId("YDigital", "Accounts", 5), "YD-ACC-0005");
  assert.equal(formatEmployeeId("Alchemane (ALC)", "ALC Technician", 12345), "ALC-TEC-12345", "grows past 4 digits instead of truncating");
  // the department part is a label: moving department later does not change the number
  const a = formatEmployeeId("YDigital", "Accounts", 8);
  const b = formatEmployeeId("YDigital", "Purchase", 8);
  assert.equal(a.split("-")[2], b.split("-")[2]);
});
