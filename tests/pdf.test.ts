import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { buildOnboardingPdf, pdfSafe } from "../src/lib/onboarding-pdf.ts";
import { buildMasterFields, toEmployeePayload } from "../src/lib/onboarding-fields.ts";

// 1x1 transparent PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const form = {
  fullName: "Priya Sharma", company: "American Hairline (AHL)", designation: "AI Developer", department: "Artificial Intelligence (AI)",
  manager: "Rahul", doj: "2026-10-12", dob: "1995-05-05", mobile: "9876543210", personalEmail: "p@x.co", gender: "Female",
  pan: "abcde1234f", ifsc: "hdfc0001234", politicalBackground: "No", politicalDetails: "should be dropped", signature: "Priya Sharma", signDate: "2026-10-05",
};

test("master fields: stable labels, upper-casing and conditional political details", () => {
  const fields = buildMasterFields(form, "AHL-AI-0044");
  const get = (l: string) => fields.find((f) => f.label === l)?.value;
  assert.equal(fields.length, 47);
  assert.equal(get("Employee ID"), "AHL-AI-0044");
  assert.equal(get("PAN Number"), "ABCDE1234F");
  assert.equal(get("IFSC Code"), "HDFC0001234");
  assert.equal(get("Political Details"), "", "details are dropped unless Political Background is Yes");
  assert.equal(get("Digital Signature"), "Priya Sharma");
});

test("employee payload maps the flat form for the store", () => {
  const p = toEmployeePayload(form, "joiner");
  assert.equal(p.fullName, "Priya Sharma");
  assert.equal(p.doj, "2026-10-12");
  assert.equal(p.createdBy, "joiner");
  assert.ok(p.masterFields.length > 40);
});

test("pdfSafe replaces characters the standard fonts cannot draw", () => {
  assert.equal(pdfSafe("Rahul’s"), "Rahul’s");
  assert.equal(pdfSafe("नमस्ते"), "??????");
  assert.equal(pdfSafe("a\r\nb"), "a\nb");
});

test("builds a valid multi-section PDF with signature, long text and unicode", async () => {
  const fields = buildMasterFields({ ...form, permAddress: "Flat 12, ".repeat(200), strengths: "नमस्ते leadership", accountNumber: "1".repeat(120) }, "AHL-AI-0044");
  const bytes = await buildOnboardingPdf({ company: form.company, employeeId: "AHL-AI-0044", fullName: form.fullName, fields, signaturePng: PNG });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2, "long content flows onto extra pages");
  assert.ok(bytes.length > 2000);
});

test("works without a signature or logo", async () => {
  const bytes = await buildOnboardingPdf({ company: "YDigital", employeeId: "YD-ACC-0001", fullName: "A", fields: [] });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
});
