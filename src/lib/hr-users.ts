import "server-only";

import { ensureSheet, getValues } from "./google-sheets";
import { cleanPhoneNumber } from "./whatsapp";

// The HR team lives in the "HR_Users" sheet tab, so people can be added or removed without a redeploy.
// Today it decides who gets WhatsApp reminders; the same list becomes the login allow-list later (Email column).
// The tab is created empty (headers only): add the HR people there. No phone numbers are kept in code.
const TAB = "HR_Users";
const COLUMNS = ["Name", "Email", "WhatsApp", "Role", "Active"];

export type HrUser = { name: string; email: string; whatsapp: string; role: string; active: boolean };

let cache: { at: number; users: HrUser[] } | null = null;

export async function getHrUsers(): Promise<HrUser[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.users;
  await ensureSheet(TAB, COLUMNS);
  const rows = await getValues(`${TAB}!A:E`); // an empty tab simply means nobody is listed yet
  const c = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  const users = rows.slice(1).filter((r) => c(r[0])).map((r) => ({
    name: c(r[0]), email: c(r[1]).toLowerCase(), whatsapp: cleanPhoneNumber(c(r[2])), role: c(r[3]) || "HR", active: c(r[4]).toLowerCase() !== "no",
  }));
  cache = { at: Date.now(), users };
  return users;
}

/** WhatsApp numbers (country code, digits only) of every active HR user. */
export async function getHrWhatsAppNumbers(): Promise<string[]> {
  return (await getHrUsers()).filter((u) => u.active && u.whatsapp).map((u) => u.whatsapp);
}
