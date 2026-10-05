export type EmploymentStatus = "Active" | "Left";
export type MeetingStatus = "Open" | "Completed" | "Cancelled";
export type DocumentStatus = "Missing" | "Pending" | "Uploaded" | "Verified";
export type MeetingType =
  | "Onboarding Feedback"
  | "Quarterly Review"
  | "Appraisal"
  | "Warning"
  | "General"
  | "Follow-Up"
  | "Exit Meeting";

export type DocumentType =
  | "Joining Letter"
  | "Policy Signing"
  | "Meeting Attachment"
  | "Exit"
  | "Relieving Letter"
  | "Onboarding Form"
  | "Other";

export interface MasterField {
  label: string;
  value: string;
}

export interface EmployeeSummary {
  employeeKey: string;
  rowNumber: number;
  fullName: string;
  employeeId: string;
  company: string;
  designation: string;
  department: string;
  manager: string;
  doj: string;
  dob: string;
  gender: string;
  mobile: string;
  companyEmail: string;
  personalEmail: string;
  employmentStatus: EmploymentStatus;
  lastIncrementYear?: string;
  masterFields?: MasterField[];
  statusRecord?: StatusRecord | null;
}

export interface ReviewEvent {
  employeeKey: string;
  employeeName: string;
  department: string;
  date: string;
  dateObj: Date;
  daysUntil: number;
  label: string;
  shortLabel: string;
  meetingType: "Onboarding Feedback" | "Quarterly Review";
  reviewStage?: "onboarding" | "tenure";
  totalMonths?: number;
  employee: EmployeeSummary;
}

export interface BirthdayEvent {
  employeeKey: string;
  employeeName: string;
  department: string;
  date: string;
  dateObj: Date;
  daysUntil: number;
  age: number;
  employee: EmployeeSummary;
}

export interface MeetingRecord {
  meetingId: string;
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  milestone: string;
  meetingType: MeetingType;
  scheduledDate: string;
  meetingDate: string;
  discussionNotes: string;
  warningGiven: "Yes" | "No";
  actionTaken: string;
  nextFollowUpDate: string;
  attachmentLink?: string;
  recordedBy: string;
  recordStatus: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  documentId: string;
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  documentType: DocumentType;
  documentStatus: DocumentStatus;
  fileName?: string;
  driveFileId?: string;
  driveLink?: string;
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface StatusRecord {
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  employmentStatus: EmploymentStatus;
  lastWorkingDate?: string;
  exitReason?: string;
  relievingLetterLink?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  logId: string;
  timestamp: string;
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  actionType: string;
  recordType: string;
  recordId: string;
  details: string;
  performedBy: string;
}

export interface DepartmentMeta {
  departmentId: string;
  departmentName: string;
  active: boolean;
  displayOrder: number;
}

export interface DataQualityMetric {
  key: string;
  label: string;
  complete: number;
  missing: number;
  percent: number;
}

export interface GlobalFiltersState {
  search: string;
  company: string;
  department: string;
  gender: string;
  employmentStatus: string; // 'Active' | 'Left' | '' (All)
}

export interface DashboardApiResponse {
  success: boolean;
  sourceTitle: string;
  sourceSheet: string;
  generatedAt: string;
  employeeCount: number;
  shiftedRowsHandled: number;
  employees: EmployeeSummary[];
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
  statuses: StatusRecord[];
}
