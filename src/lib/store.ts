import "server-only";

import crypto from "node:crypto";
import {
  EmployeeSummary,
  MeetingRecord,
  DocumentRecord,
  StatusRecord,
  DashboardApiResponse,
  DepartmentMeta,
} from "@/types";
import {
  appendValues,
  batchGetValues,
  getSpreadsheetMetadata,
  getValues,
  serialToIsoDate,
  serialToIsoDateTime,
  updateValues,
} from "./google-sheets";
import { trustedNowMs } from "./google-auth";

const RANGES = ["Employees!A:AV", "HR_Meetings!A:Q", "HR_Documents!A:M", "HR_Status!A:L", "Departments!A:D"] as const;

type Snapshot = {
  employees: EmployeeSummary[];
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
  statuses: StatusRecord[];
  departments: DepartmentMeta[];
  sourceTitle: string;
  shiftedRows: number;
};

let snapshotCache: { expiresAt: number; value: Snapshot } | null = null;

function clean(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
}

function headerMap(headers: unknown[]) {
  const result = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key && !result.has(key)) result.set(key, index);
  });
  return result;
}

function readField(row: unknown[], map: Map<string, number>, aliases: string[], blankIndex = -1, shifted = false) {
  for (const alias of aliases) {
    const index = map.get(normalizeHeader(alias));
    if (index === undefined) continue;
    const adjusted = shifted && blankIndex >= 0 && index > blankIndex ? index - 1 : index;
    return row[adjusted];
  }
  return "";
}

function masterFieldValue(value: unknown, label: string) {
  const key = normalizeHeader(label);
  if (typeof value === "number" && (key === "timestamp" || key.includes("date") || key === "dob" || key === "doj")) {
    return key === "timestamp" ? serialToIsoDateTime(value) : serialToIsoDate(value);
  }
  return clean(value);
}

function parseEmployees(rows: unknown[][]) {
  if (!rows.length) return { employees: [], shiftedRows: 0 };
  const headers = rows[0].map(clean);
  const map = headerMap(headers);
  const blankIndex = headers.findIndex((header) => !header);
  let shiftedRows = 0;

  const employees = rows.slice(1).map((row, index): EmployeeSummary | null => {
    const shifted = blankIndex >= 0 && clean(row[blankIndex]) !== "";
    if (shifted) shiftedRows += 1;
    const field = (aliases: string[]) => readField(row, map, aliases, blankIndex, shifted);
    const fullName = clean(field(["Full Name"]));
    if (!fullName) return null;
    const employeeKeyIndex = map.get("employeekey");
    const employeeKey = employeeKeyIndex === undefined ? "" : clean(row[employeeKeyIndex]);
    if (!employeeKey) throw new Error(`Employee Key is missing on Employees row ${index + 2}.`);

    return {
      employeeKey,
      rowNumber: index + 2,
      fullName,
      employeeId: clean(field(["Employee ID"])),
      company: clean(field(["Company"])),
      designation: clean(field(["Current Designation", "Designation"])),
      department: clean(field(["Department"])),
      manager: clean(field(["Reporting Manager", "Manager"])),
      doj: serialToIsoDate(field(["Date of Joining (DOJ)", "Date of Joining", "DOJ"])),
      dob: serialToIsoDate(field(["Date of Birth", "DOB"])),
      gender: clean(field(["Gender"])),
      mobile: clean(field(["Mobile Number", "Phone Number", "Mobile"])),
      companyEmail: clean(field(["Company E-mail ID", "Company Email ID"])),
      personalEmail: clean(field(["Personal E-mail ID", "Personal Email ID"])),
      employmentStatus: "Active",
      lastIncrementYear: clean(field(["Last Increment Year", "Last Salary Increment (Year)"])),
      masterFields: headers.map((label, headerIndex) => {
        if (!label || normalizeHeader(label) === "employeekey") return null;
        const adjusted = shifted && blankIndex >= 0 && headerIndex > blankIndex ? headerIndex - 1 : headerIndex;
        return { label, value: masterFieldValue(row[adjusted], label) };
      }).filter(Boolean) as Array<{ label: string; value: string }>,
    };
  }).filter(Boolean) as EmployeeSummary[];

  return { employees, shiftedRows };
}

function parseMeetings(rows: unknown[][]): MeetingRecord[] {
  return rows.slice(1).filter((row) => clean(row[0])).map((row) => ({
    meetingId: clean(row[0]), employeeKey: clean(row[1]), employeeId: clean(row[2]), employeeName: clean(row[3]),
    milestone: clean(row[4]), meetingType: clean(row[5]) as MeetingRecord["meetingType"],
    scheduledDate: serialToIsoDate(row[6]), meetingDate: serialToIsoDate(row[7]), discussionNotes: clean(row[8]),
    warningGiven: (clean(row[9]) === "Yes" ? "Yes" : "No") as MeetingRecord["warningGiven"], actionTaken: clean(row[10]),
    nextFollowUpDate: serialToIsoDate(row[11]), attachmentLink: clean(row[12]), recordedBy: clean(row[13]),
    recordStatus: (clean(row[14]) || "Open") as MeetingRecord["recordStatus"],
    createdAt: serialToIsoDateTime(row[15]), updatedAt: serialToIsoDateTime(row[16]),
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function parseDocuments(rows: unknown[][]): DocumentRecord[] {
  return rows.slice(1).filter((row) => clean(row[0])).map((row) => ({
    documentId: clean(row[0]), employeeKey: clean(row[1]), employeeId: clean(row[2]), employeeName: clean(row[3]),
    documentType: clean(row[4]) as DocumentRecord["documentType"], documentStatus: clean(row[5]) as DocumentRecord["documentStatus"],
    fileName: clean(row[6]), driveFileId: clean(row[7]), driveLink: clean(row[8]), notes: clean(row[9]),
    uploadedBy: clean(row[10]), uploadedAt: serialToIsoDateTime(row[11]), updatedAt: serialToIsoDateTime(row[12]),
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function parseStatuses(rows: unknown[][]): StatusRecord[] {
  return rows.slice(1).filter((row) => clean(row[0])).map((row) => ({
    employeeKey: clean(row[0]), employeeId: clean(row[1]), employeeName: clean(row[2]),
    employmentStatus: (clean(row[3]) || "Active") as StatusRecord["employmentStatus"],
    lastWorkingDate: serialToIsoDate(row[4]), exitReason: clean(row[5]), relievingLetterLink: clean(row[6]),
    deactivatedAt: serialToIsoDateTime(row[7]), deactivatedBy: clean(row[8]),
    restoredAt: serialToIsoDateTime(row[9]), restoredBy: clean(row[10]), updatedAt: serialToIsoDateTime(row[11]),
  }));
}

function parseDepartments(rows: unknown[][]): DepartmentMeta[] {
  return rows.slice(1).filter((row) => clean(row[1])).map((row, index) => ({
    departmentId: clean(row[0]) || `DEPT-${String(index + 1).padStart(3, "0")}`,
    departmentName: clean(row[1]), active: row[2] === true || clean(row[2]).toLowerCase() === "true",
    displayOrder: Number(row[3]) || index + 1,
  })).sort((a, b) => a.displayOrder - b.displayOrder);
}

async function loadSnapshot(force = false): Promise<Snapshot> {
  if (!force && snapshotCache && snapshotCache.expiresAt > Date.now()) return snapshotCache.value;
  const [metadata, values] = await Promise.all([getSpreadsheetMetadata(), batchGetValues([...RANGES])]);
  const employeeData = parseEmployees(values[0]);
  const statuses = parseStatuses(values[3]);
  const statusMap = new Map(statuses.map((status) => [status.employeeKey, status]));
  const employees = employeeData.employees.map((employee) => ({
    ...employee,
    statusRecord: statusMap.get(employee.employeeKey) || null,
    employmentStatus: statusMap.get(employee.employeeKey)?.employmentStatus || "Active",
  }));
  const value: Snapshot = {
    employees, meetings: parseMeetings(values[1]), documents: parseDocuments(values[2]), statuses,
    departments: parseDepartments(values[4]), sourceTitle: metadata.properties?.title || "HR OS Database - Development",
    shiftedRows: employeeData.shiftedRows,
  };
  snapshotCache = { expiresAt: Date.now() + 20_000, value };
  return value;
}

function invalidateCache() { snapshotCache = null; }
function nowSerial() { return (trustedNowMs() + 330 * 60000 - Date.UTC(1899, 11, 30)) / 86400000; }
function dateSerial(value?: string) {
  if (!value) return "";
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
  return (Date.UTC(parts[0], parts[1] - 1, parts[2]) - Date.UTC(1899, 11, 30)) / 86400000;
}

function employeeKeyFromSerial(value: unknown, employeeId: string, fullName: string, rowNumber: number) {
  let anchor = typeof value === "number" && Number.isFinite(value)
    ? new Date(Math.round(Date.UTC(1899, 11, 30) + value * 86400000 - 330 * 60000)).toISOString()
    : clean(value).toLowerCase();
  if (!anchor) anchor = ["fallback", employeeId.toLowerCase(), fullName.toLowerCase(), rowNumber].join("|");
  return `EMP-${crypto.createHash("sha256").update(anchor).digest("hex").slice(0, 20).toUpperCase()}`;
}

function validRecordId(value: unknown, prefix: string) {
  const text = clean(value).toUpperCase();
  return new RegExp(`^${prefix}-[A-Z0-9-]{8,80}$`).test(text) ? text : `${prefix}-${crypto.randomUUID().toUpperCase()}`;
}

async function appendAudit(entry: { employee: EmployeeSummary; actionType: string; recordType: string; recordId: string; details: string; performedBy: string }) {
  await appendValues("HR_Audit_Log!A:J", [[`LOG-${crypto.randomUUID().toUpperCase()}`, nowSerial(), entry.employee.employeeKey,
    entry.employee.employeeId, entry.employee.fullName, entry.actionType, entry.recordType, entry.recordId, entry.details, entry.performedBy]]);
}

export async function getAllEmployees() { return (await loadSnapshot()).employees; }
export async function getEmployeeByKey(key: string) { return (await loadSnapshot()).employees.find((employee) => employee.employeeKey === key); }

export async function addEmployeeRecord(payload: any): Promise<EmployeeSummary> {
  const snapshot = await loadSnapshot(true);
  const fullName = clean(payload.fullName), employeeId = clean(payload.employeeId), department = clean(payload.department);
  if (!fullName || !employeeId || !department) throw new Error("Full name, employee ID, and department are required.");
  if (snapshot.employees.some((employee) => employee.employeeId.toLowerCase() === employeeId.toLowerCase())) throw new Error(`Employee ID ${employeeId} already exists.`);
  if (!snapshot.departments.some((item) => item.active && item.departmentName === department)) throw new Error("Please select a valid active department.");

  const headerRows = await getValues("Employees!A1:AV1");
  const headers = (headerRows[0] || []).map(clean), map = headerMap(headers), values = Array(headers.length).fill("");
  const supplied = new Map<string, unknown>((payload.masterFields || []).map((item: any) => [normalizeHeader(item.label), item.value]));
  const fallback: Record<string, unknown> = { fullname: fullName, employeeid: employeeId, company: payload.company,
    currentdesignation: payload.designation, department, reportingmanager: payload.manager, dateofjoiningdoj: payload.doj,
    dateofbirth: payload.dob, gender: payload.gender, mobilenumber: payload.mobile, companyemailid: payload.companyEmail,
    personalemailid: payload.personalEmail, lastincrementyear: payload.lastIncrementYear };
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key || key === "employeekey") return;
    let value = supplied.has(key) ? supplied.get(key) : fallback[key];
    if (key === "timestamp") value = nowSerial();
    if (key === "pannumber" || key === "pancardnumber") value = clean(value).toUpperCase();
    if (key === "pdflink" && value === "#") value = "";
    values[index] = value ?? "";
  });
  const appended = await appendValues("Employees!A:AV", [values]);
  const match = clean(appended.updates?.updatedRange).match(/![A-Z]+(\d+):/);
  const rowNumber = match ? Number(match[1]) : snapshot.employees.length + 2;
  const timestampIndex = map.get("timestamp") ?? 0;
  const key = employeeKeyFromSerial(values[timestampIndex], employeeId, fullName, rowNumber);
  await updateValues(`Employees!AV${rowNumber}`, [[key]]);
  const employee: EmployeeSummary = { employeeKey: key, rowNumber, fullName, employeeId, company: clean(payload.company),
    designation: clean(payload.designation), department, manager: clean(payload.manager), doj: clean(payload.doj), dob: clean(payload.dob),
    gender: clean(payload.gender), mobile: clean(payload.mobile), companyEmail: clean(payload.companyEmail), personalEmail: clean(payload.personalEmail),
    employmentStatus: "Active", lastIncrementYear: clean(payload.lastIncrementYear), masterFields: payload.masterFields || [] };
  await appendAudit({ employee, actionType: "CREATE_EMPLOYEE", recordType: "Employee", recordId: key, details: department,
    performedBy: clean(payload.createdBy) || "HR Command User" });
  invalidateCache();
  return employee;
}

export async function getAllMeetings() { return (await loadSnapshot()).meetings; }
export async function addMeetingRecord(meeting: any): Promise<MeetingRecord> {
  const snapshot = await loadSnapshot(true), employee = snapshot.employees.find((item) => item.employeeKey === clean(meeting.employeeKey));
  if (!employee) throw new Error("Selected employee was not found.");
  const meetingId = validRecordId(meeting.meetingId, "MTG"), existing = snapshot.meetings.find((item) => item.meetingId === meetingId);
  if (existing) return existing;
  const now = nowSerial();
  const row = [meetingId, employee.employeeKey, employee.employeeId, employee.fullName, clean(meeting.milestone), clean(meeting.meetingType) || "General",
    dateSerial(meeting.scheduledDate), dateSerial(meeting.meetingDate), clean(meeting.discussionNotes), meeting.warningGiven === "Yes" ? "Yes" : "No",
    clean(meeting.actionTaken), dateSerial(meeting.nextFollowUpDate), clean(meeting.attachmentLink), clean(meeting.recordedBy),
    clean(meeting.recordStatus) || "Open", now, now];
  await appendValues("HR_Meetings!A:Q", [row]);
  await appendAudit({ employee, actionType: "CREATE_MEETING", recordType: "Meeting", recordId: meetingId,
    details: [row[5], row[14], row[4]].filter(Boolean).join(" · "), performedBy: clean(meeting.recordedBy) });
  invalidateCache();
  return parseMeetings([[], row])[0];
}

export async function updateMeetingStatus(meetingId: string, status: "Open" | "Completed" | "Cancelled", performedBy = "HR Command User"): Promise<MeetingRecord | null> {
  const snapshot = await loadSnapshot(true);
  const targetMeeting = snapshot.meetings.find((m) => m.meetingId === meetingId);
  if (!targetMeeting) return null;

  const rawRows = await getValues("HR_Meetings!A:Q");
  const rowIndex = rawRows.slice(1).findIndex((row) => clean(row[0]) === meetingId);
  if (rowIndex < 0) return null;
  const actualRow = rowIndex + 2;
  const now = nowSerial();

  // Column O is recordStatus, Column Q is updatedAt
  await updateValues(`HR_Meetings!O${actualRow}:Q${actualRow}`, [[status, rawRows[actualRow - 1][15] || now, now]]);

  const employee = snapshot.employees.find((e) => e.employeeKey === targetMeeting.employeeKey);
  if (employee) {
    await appendAudit({
      employee,
      actionType: "UPDATE_MEETING_STATUS",
      recordType: "Meeting",
      recordId: meetingId,
      details: `Status changed to ${status}`,
      performedBy,
    });
  }

  invalidateCache();
  const refreshed = await loadSnapshot(true);
  return refreshed.meetings.find((m) => m.meetingId === meetingId) || null;
}

export async function getAllDocuments() { return (await loadSnapshot()).documents; }
export async function addDocumentRecord(document: any): Promise<DocumentRecord> {
  const snapshot = await loadSnapshot(true), employee = snapshot.employees.find((item) => item.employeeKey === clean(document.employeeKey));
  if (!employee) throw new Error("Selected employee was not found.");
  const documentId = validRecordId(document.documentId, "DOC"), existing = snapshot.documents.find((item) => item.documentId === documentId);
  if (existing) return existing;
  const status = clean(document.documentStatus) || "Pending", driveLink = clean(document.driveLink);
  if (["Uploaded", "Verified"].includes(status) && !/^https:\/\//i.test(driveLink)) throw new Error("A permanent Google Drive link is required before a document can be Uploaded or Verified.");
  const now = nowSerial();
  const row = [documentId, employee.employeeKey, employee.employeeId, employee.fullName, clean(document.documentType) || "Other", status,
    clean(document.fileName), clean(document.driveFileId), driveLink, clean(document.notes), clean(document.uploadedBy), now, now];
  await appendValues("HR_Documents!A:M", [row]);
  await appendAudit({ employee, actionType: "CREATE_DOCUMENT", recordType: "Document", recordId: documentId,
    details: `${row[4]} · ${status}`, performedBy: clean(document.uploadedBy) });
  invalidateCache();
  return parseDocuments([[], row])[0];
}

export async function updateEmployeeStatusRecord(payload: any): Promise<StatusRecord> {
  const snapshot = await loadSnapshot(true), employee = snapshot.employees.find((item) => item.employeeKey === clean(payload.employeeKey));
  if (!employee) throw new Error("Selected employee was not found.");
  const status = payload.employmentStatus === "Left" ? "Left" : "Active";
  if (status === "Left" && !payload.lastWorkingDate) throw new Error("Last working date is required when an employee leaves.");
  const rawRows = await getValues("HR_Status!A:L"), existingIndex = rawRows.slice(1).findIndex((row) => clean(row[0]) === employee.employeeKey);
  const previous = existingIndex >= 0 ? rawRows[existingIndex + 1] : Array(12).fill(""), now = nowSerial();
  const row = [employee.employeeKey, employee.employeeId, employee.fullName, status,
    status === "Left" ? dateSerial(payload.lastWorkingDate) : previous[4] || "", status === "Left" ? clean(payload.exitReason) : previous[5] || "",
    clean(payload.relievingLetterLink) || previous[6] || "", status === "Left" ? now : previous[7] || "",
    status === "Left" ? clean(payload.updatedBy) : previous[8] || "", status === "Active" ? now : previous[9] || "",
    status === "Active" ? clean(payload.updatedBy) : previous[10] || "", now];
  if (existingIndex >= 0) await updateValues(`HR_Status!A${existingIndex + 2}:L${existingIndex + 2}`, [row]);
  else await appendValues("HR_Status!A:L", [row]);
  const operationId = validRecordId(payload.operationId, "STS");
  await appendAudit({ employee, actionType: status === "Left" ? "DEACTIVATE_EMPLOYEE" : "RESTORE_EMPLOYEE", recordType: "Status",
    recordId: operationId, details: `${status}${payload.exitReason ? ` · ${clean(payload.exitReason)}` : ""}`, performedBy: clean(payload.updatedBy) });
  invalidateCache();
  return parseStatuses([[], row])[0];
}

export async function getCanonicalDepartments() { return (await loadSnapshot()).departments.filter((department) => department.active); }
export async function getFullDashboardData(): Promise<DashboardApiResponse> {
  const snapshot = await loadSnapshot();
  return { success: true, sourceTitle: snapshot.sourceTitle, sourceSheet: "Employees", generatedAt: new Date(trustedNowMs()).toISOString(),
    employeeCount: snapshot.employees.length, shiftedRowsHandled: snapshot.shiftedRows, employees: snapshot.employees,
    meetings: snapshot.meetings, documents: snapshot.documents, statuses: snapshot.statuses };
}
export async function checkStorageHealth() {
  const snapshot = await loadSnapshot(true);
  return { database: "connected", employeeCount: snapshot.employees.length, sourceTitle: snapshot.sourceTitle };
}
