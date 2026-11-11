/** Pure helpers for normalizing and merging creatable dropdown options. */

export const OTHER_OPTION_VALUE = "__OTHER__";

export type DropdownOption = string | { value: string; label: string };
export type NormalizedOption = { value: string; label: string };

export function normalizeDropdownCategory(raw: unknown): string {
  const s = String(raw ?? "").trim().replace(/[^a-zA-Z0-9_.-]/g, "");
  return s.slice(0, 80);
}

export function normalizeDropdownValue(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === OTHER_OPTION_VALUE) return "";
  return s.slice(0, 120);
}

export function toNormalizedOption(opt: DropdownOption): NormalizedOption {
  return typeof opt === "string"
    ? { value: opt, label: opt }
    : { value: String(opt.value), label: String(opt.label) };
}

/**
 * Combines built-in options, persisted custom options, and an optional currently-selected value
 * into a deduplicated list while preserving order.
 */
export function mergeDropdownOptions(
  base: readonly DropdownOption[],
  custom: readonly string[] = [],
  currentValue?: string | number | null
): NormalizedOption[] {
  const result: NormalizedOption[] = [];
  const seenValues = new Set<string>();
  const seenLabels = new Set<string>();

  const pushUnique = (opt: NormalizedOption) => {
    const vKey = opt.value.trim().toLowerCase();
    const lKey = opt.label.trim().toLowerCase();
    if (!vKey || seenValues.has(vKey) || seenLabels.has(lKey)) return;
    seenValues.add(vKey);
    seenLabels.add(lKey);
    result.push({ value: opt.value.trim(), label: opt.label.trim() });
  };

  for (const item of base) {
    pushUnique(toNormalizedOption(item));
  }

  for (const val of custom) {
    const clean = normalizeDropdownValue(val);
    if (clean) pushUnique({ value: clean, label: clean });
  }

  const cur = currentValue === null || currentValue === undefined ? "" : String(currentValue).trim();
  if (cur && cur !== OTHER_OPTION_VALUE) {
    pushUnique({ value: cur, label: cur });
  }

  return result;
}
