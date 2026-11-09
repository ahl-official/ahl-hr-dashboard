// Builds the weekly / monthly HR report sent to the process coordinator.
//
// Headline numbers cover the selected period:
//   Shortlisted = Interview Updates stage completed in the period (excludes Not Hired / No Show).
//   Joined      = Joining stage completed in the period (excludes candidates later dropped).
// Required and the position list describe open positions as of the end of the period:
//   Required    = Openings minus everyone who has joined against that requisition so far.

import type { FmsCandidate, FmsRequisition } from "../types/fms.ts";

export type FmsReportKind = "weekly" | "monthly";

export interface FmsReportPeriod {
  kind: FmsReportKind;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label: string;
}

export interface FmsReportPosition {
  title: string;
  required: number;
  joined: number;
  shortlisted: number;
}

export interface FmsReport {
  period: FmsReportPeriod;
  hrName: string; // Empty means all HR
  totals: { shortlisted: number; joined: number; required: number };
  joinedCandidates: Array<{ name: string; post: string }>;
  positions: FmsReportPosition[];
}

const REJECTED_RESULTS = new Set(["Not Hired", "Didn't Come for Interview"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

/** Accepts ISO dates, ISO timestamps and the serial numbers Sheets returns for date cells. */
function toIsoDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (/^\d{5}$/.test(text)) return iso(new Date((Number(text) - 25569) * 86400000));
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

export function formatReportDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Periods newest first. The first entry is the current, still-running week or month. */
export function getFmsReportPeriods(kind: FmsReportKind, todayIso: string, count = 12): FmsReportPeriod[] {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const periods: FmsReportPeriod[] = [];

  for (let i = 0; i < count; i++) {
    if (kind === "weekly") {
      const monday = addDays(today, -((today.getUTCDay() + 6) % 7) - 7 * i);
      const start = iso(monday);
      const end = iso(addDays(monday, 6));
      const range = `${formatReportDate(start)} - ${formatReportDate(end)}`;
      periods.push({ kind, start, end, label: i === 0 ? `${range} (this week)` : range });
    } else {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      const name = `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
      periods.push({ kind, start: iso(first), end: iso(last), label: i === 0 ? `${name} (this month)` : name });
    }
  }
  return periods;
}

/** "Rakesh sir" and "Rakesh" are the same person in the Recruiter Name column. */
export function normalizeHrName(value: unknown): string {
  return String(value ?? "")
    .replace(/\b(sir|ma'?am|madam)\b\.?/gi, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function listReportHrNames(requisitions: FmsRequisition[]): string[] {
  const names = new Set(requisitions.map((r) => normalizeHrName(r.recruiterName)).filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

const titleKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

const isDropped = (c: FmsCandidate) => c.status === "Dropped" || Boolean(c.archived);

function shortlistDate(c: FmsCandidate): string {
  const result = c.interviewUpdateStatus === "Rescheduled" ? c.rescheduledStatus : c.interviewUpdateStatus;
  return result && REJECTED_RESULTS.has(result) ? "" : toIsoDate(c.stages?.ps?.actualDate);
}

const joinDate = (c: FmsCandidate) => (isDropped(c) ? "" : toIsoDate(c.stages?.jo?.actualDate));

const inPeriod = (date: string, period: FmsReportPeriod) => Boolean(date) && date >= period.start && date <= period.end;

export function buildFmsReport(
  candidates: FmsCandidate[],
  requisitions: FmsRequisition[],
  period: FmsReportPeriod,
  hrName = ""
): FmsReport {
  // Requisition IDs are not unique in the sheet, so the job title settles which one a candidate belongs to.
  const byId = new Map<string, FmsRequisition[]>();
  for (const r of requisitions) byId.set(r.id, [...(byId.get(r.id) || []), r]);
  const requisitionOf = (c: FmsCandidate) => {
    const matches = byId.get(c.requisitionId || "");
    return matches?.find((r) => titleKey(r.jobTitle) === titleKey(c.position)) || matches?.[0];
  };

  const inScope = (r?: FmsRequisition) => !hrName || (r ? normalizeHrName(r.recruiterName) === hrName : false);
  const scoped = candidates.filter((c) => inScope(requisitionOf(c)));

  const joinedInPeriod = scoped.filter((c) => inPeriod(joinDate(c), period));
  const joinedCandidates = joinedInPeriod
    .sort((a, b) => joinDate(a).localeCompare(joinDate(b)))
    .map((c) => ({ name: c.fullName, post: requisitionOf(c)?.jobTitle.trim() || c.position || "" }));

  // Same-titled requisitions are one position in the report.
  const positions = new Map<string, FmsReportPosition>();
  const openRequisitions = requisitions.filter((r) => {
    const created = toIsoDate(r.createdDate);
    return titleKey(r.status) === "open" && inScope(r) && (!created || created <= period.end);
  });

  for (const r of openRequisitions) {
    const own = scoped.filter((c) => requisitionOf(c) === r);
    const joined = own.filter((c) => joinDate(c) && joinDate(c) <= period.end).length;
    const shortlisted = own.filter((c) => {
      const date = shortlistDate(c);
      const hasJoined = joinDate(c) && joinDate(c) <= period.end;
      return date && date <= period.end && !hasJoined && !isDropped(c);
    }).length;
    const required = Math.max(0, (Number(r.openings) || 1) - joined);
    if (required === 0) continue;

    const key = titleKey(r.jobTitle);
    const entry = positions.get(key) || { title: r.jobTitle.trim(), required: 0, joined: 0, shortlisted: 0 };
    entry.required += required;
    entry.joined += joined;
    entry.shortlisted += shortlisted;
    positions.set(key, entry);
  }

  const positionList = [...positions.values()].sort(
    (a, b) => b.joined + b.shortlisted - (a.joined + a.shortlisted) || a.title.localeCompare(b.title)
  );

  return {
    period,
    hrName,
    totals: {
      shortlisted: scoped.filter((c) => inPeriod(shortlistDate(c), period)).length,
      joined: joinedCandidates.length,
      required: positionList.reduce((sum, p) => sum + p.required, 0),
    },
    joinedCandidates,
    positions: positionList,
  };
}

/** "Sales – In Process (1 Joined & 3 Shortlisted)" */
export function formatReportPosition(p: FmsReportPosition): string {
  const progress = [p.joined && `${p.joined} Joined`, p.shortlisted && `${p.shortlisted} Shortlisted`].filter(Boolean).join(" & ");
  return `${p.title} – In Process${progress ? ` (${progress})` : ""}`;
}

export function reportTitle(report: FmsReport): string {
  const name = report.hrName ? `${report.hrName} ` : "";
  const kind = report.period.kind === "monthly" ? "MONTHLY " : "";
  return `${name}HR ${kind}REPORT (${formatReportDate(report.period.start)} - ${formatReportDate(report.period.end)})`;
}

export function reportFileName(report: FmsReport): string {
  const name = report.hrName ? `${report.hrName.replace(/\s+/g, "-")}-` : "";
  const kind = report.period.kind === "monthly" ? "Monthly" : "Weekly";
  return `${name}HR-${kind}-Report-${report.period.start}-to-${report.period.end}.pdf`;
}
