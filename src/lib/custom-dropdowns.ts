import "server-only";

import { appendValues, ensureSheet, getValues } from "./google-sheets";
import { ValidationError } from "./validate";
import { normalizeDropdownCategory, normalizeDropdownValue } from "./custom-dropdown-rules";

const TAB = "Custom_Dropdown_Options";
const HEADERS = ["Category", "Value", "Active", "CreatedAt"];
const CACHE_TTL_MS = 20_000;

let cache: { expiresAt: number; data: Record<string, string[]> } | null = null;

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function invalidateCustomDropdownsCache() {
  cache = null;
}

export async function getAllCustomDropdownOptions(forceRefresh = false): Promise<Record<string, string[]>> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  let rows: unknown[][] = [];
  try {
    rows = await getValues(`${TAB}!A:D`);
  } catch {
    // Tab may not exist yet on first run; create it cleanly and return empty options.
    try {
      await ensureSheet(TAB, HEADERS);
    } catch {
      return {};
    }
    rows = [];
  }

  const map: Record<string, string[]> = {};
  const seen = new Map<string, Set<string>>();

  for (const row of rows.slice(1)) {
    const category = normalizeDropdownCategory(row[0]);
    const value = normalizeDropdownValue(row[1]);
    const activeCell = clean(row[2]).toLowerCase();
    const isActive = row[2] === undefined || row[2] === "" || row[2] === true || activeCell === "true" || activeCell === "yes";
    if (!category || !value || !isActive) continue;

    if (!seen.has(category)) {
      seen.set(category, new Set());
      map[category] = [];
    }
    const vKey = value.toLowerCase();
    if (!seen.get(category)!.has(vKey)) {
      seen.get(category)!.add(vKey);
      map[category].push(value);
    }
  }

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, data: map };
  return map;
}

export async function getCustomDropdownOptions(category: string, forceRefresh = false): Promise<string[]> {
  const cat = normalizeDropdownCategory(category);
  if (!cat) return [];
  const all = await getAllCustomDropdownOptions(forceRefresh);
  return all[cat] || [];
}

export async function addCustomDropdownOption(rawCategory: string, rawValue: string) {
  const category = normalizeDropdownCategory(rawCategory);
  const value = normalizeDropdownValue(rawValue);

  if (!category) throw new ValidationError("Dropdown category is required.");
  if (!value) throw new ValidationError("Please enter a valid option name.");

  await ensureSheet(TAB, HEADERS);
  const currentMap = await getAllCustomDropdownOptions(true);
  const existing = currentMap[category] || [];
  const matched = existing.find((item) => item.toLowerCase() === value.toLowerCase());

  if (matched) {
    return { category, value: matched, options: existing };
  }

  const nowIso = new Date().toISOString();
  await appendValues(`${TAB}!A:D`, [[category, value, true, nowIso]]);
  invalidateCustomDropdownsCache();

  const updated = [...existing, value];
  if (cache) {
    cache.data[category] = updated;
  }

  return { category, value, options: updated };
}
