import "server-only";

import crypto from "node:crypto";
import { appendValues, ensureSheet, getValues, updateValues } from "./google-sheets";
import { expiryFor, hashToken, newToken, type InviteMode, type InviteStatus } from "./invite-rules";

const TAB = "HR_Invites";
const COLUMNS = [
  "Invite ID", "Token Hash", "Status", "Mode", "Name", "Mobile", "Company", "Department", "Designation", "Manager",
  "Joining Date", "Created By", "Created At", "Expires At", "Opened At", "Submitted At", "Employee Key", "Employee ID", "WhatsApp",
] as const;
type Col = (typeof COLUMNS)[number];

export type Invite = {
  rowNumber: number;
  inviteId: string;
  status: InviteStatus;
  mode: InviteMode;
  name: string;
  mobile: string;
  company: string;
  department: string;
  designation: string;
  manager: string;
  doj: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  openedAt: string;
  submittedAt: string;
  employeeKey: string;
  employeeId: string;
  whatsapp: string;
};

const clean = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
let ready = false;
async function ensure() {
  if (ready) return;
  await ensureSheet(TAB, [...COLUMNS]);
  ready = true;
}
const colLetter = (c: Col) => String.fromCharCode(65 + COLUMNS.indexOf(c));

function parse(row: unknown[], rowNumber: number): Invite {
  const g = (c: Col) => clean(row[COLUMNS.indexOf(c)]);
  return {
    rowNumber, inviteId: g("Invite ID"), status: (g("Status") || "Invited") as InviteStatus, mode: (g("Mode") || "link") as InviteMode,
    name: g("Name"), mobile: g("Mobile"), company: g("Company"), department: g("Department"), designation: g("Designation"),
    manager: g("Manager"), doj: g("Joining Date"), createdBy: g("Created By"), createdAt: g("Created At"), expiresAt: g("Expires At"),
    openedAt: g("Opened At"), submittedAt: g("Submitted At"), employeeKey: g("Employee Key"), employeeId: g("Employee ID"), whatsapp: g("WhatsApp"),
  };
}

export type InviteInput = { name: string; mobile?: string; company: string; department: string; designation: string; manager: string; doj: string };

export async function createInvite(input: InviteInput, mode: InviteMode, createdBy: string) {
  await ensure();
  const now = new Date();
  const token = newToken();
  const expiresAt = expiryFor(mode, now).toISOString();
  const inviteId = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const row = [inviteId, hashToken(token), "Invited", mode, input.name, input.mobile ?? "", input.company, input.department, input.designation,
    input.manager, input.doj, createdBy, now.toISOString(), expiresAt, "", "", "", "", ""];
  await appendValues(`${TAB}!A:S`, [row]);
  return { inviteId, token, expiresAt };
}

export async function findInviteByToken(token: string): Promise<Invite | null> {
  await ensure();
  const hash = hashToken(token);
  const rows = await getValues(`${TAB}!A:S`);
  const i = rows.findIndex((r, idx) => idx > 0 && clean(r[1]) === hash);
  return i < 0 ? null : parse(rows[i], i + 1);
}

export async function listInvites(limit = 12): Promise<Invite[]> {
  await ensure();
  const rows = await getValues(`${TAB}!A:S`);
  return rows.slice(1).map((r, i) => parse(r, i + 2)).filter((x) => x.inviteId).reverse().slice(0, limit);
}

/** Update a few cells of one invite row. */
export async function setInviteFields(rowNumber: number, fields: Partial<Record<Col, string>>) {
  await Promise.all(Object.entries(fields).map(([c, v]) => updateValues(`${TAB}!${colLetter(c as Col)}${rowNumber}`, [[v ?? ""]])));
}
