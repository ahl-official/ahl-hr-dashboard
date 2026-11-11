import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OTHER_OPTION_VALUE,
  mergeDropdownOptions,
  normalizeDropdownCategory,
  normalizeDropdownValue,
} from "../src/lib/custom-dropdown-rules.ts";

test("normalizeDropdownCategory sanitizes category identifiers", () => {
  assert.equal(normalizeDropdownCategory("  department "), "department");
  assert.equal(normalizeDropdownCategory("fms_field_notice-Period"), "fms_field_notice-Period");
  assert.equal(normalizeDropdownCategory("bad cat!@#"), "badcat");
  assert.equal(normalizeDropdownCategory(""), "");
});

test("normalizeDropdownValue trims whitespace and blocks empty or sentinel values", () => {
  assert.equal(normalizeDropdownValue("  Operations\n\tTeam  "), "Operations Team");
  assert.equal(normalizeDropdownValue("   "), "");
  assert.equal(normalizeDropdownValue(OTHER_OPTION_VALUE), "");
  assert.equal(normalizeDropdownValue("a".repeat(150)).length, 120);
});

test("mergeDropdownOptions deduplicates built-in and custom values case-insensitively", () => {
  const merged = mergeDropdownOptions(
    ["Human Resources (HR)", "Accounts"],
    ["accounts", "AI Labs", "  Security  ", "ai labs"],
    "Operations"
  );

  assert.deepEqual(
    merged.map((m) => m.label),
    ["Human Resources (HR)", "Accounts", "AI Labs", "Security", "Operations"]
  );
});

test("mergeDropdownOptions preserves value/label pairs and ignores sentinel currentValue", () => {
  const merged = mergeDropdownOptions(
    [
      { value: "ahl", label: "American Hairline" },
      { value: "alchamae", label: "Alchemane" },
    ],
    ["American Hairline", "Studio X"],
    OTHER_OPTION_VALUE
  );

  assert.deepEqual(merged, [
    { value: "ahl", label: "American Hairline" },
    { value: "alchamae", label: "Alchemane" },
    { value: "Studio X", label: "Studio X" },
  ]);
});
