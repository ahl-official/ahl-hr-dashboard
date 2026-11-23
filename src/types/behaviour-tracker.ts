export type BranchColor = "grey" | "red" | "green";
export type BranchStatus = "watching" | "repeat" | "improved";

export type SignalType =
  | "late_marks"
  | "frequent_leaves"
  | "mon_fri_leave"
  | "week_off_extension_leave"
  | "holiday_bridge_leave"
  | "repeated_absences"
  | "hr_conduct_issue";

export interface BehaviourSignal {
  type: SignalType;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  occurrences: number;
  dates: string[];
}

export interface EmployeeBranch {
  id: string; // e.g. "BRN-2026-11-0044"
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  department: string;
  company: string;
  phone: string;
  month: string; // "YYYY-MM"
  color: BranchColor;
  status: BranchStatus;
  signals: BehaviourSignal[];
  hrTalkCompleted: boolean;
  hrTalkNotes?: string;
  hrTalkDate?: string;
  whatsappSentAt?: string;
  whatsappMessage?: string;
  previousBranchId?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BehaviourEvaluationInput {
  employeeKey: string;
  employeeId: string;
  employeeName: string;
  department: string;
  company: string;
  phone: string;
  month: string; // "YYYY-MM"
  lateDaysCount: number;
  lateDays: string[];
  scheduledWeekOff?: number | string; // 0=Sun, 1=Mon, ..., 6=Sat or e.g. "Monday", "Tue"
  workingDays?: string[]; // e.g. ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] from Hazri Box
  leaveRecords: Array<{
    type: string;
    from: string;
    till: string;
    days: number;
    reason?: string;
  }>;
  holidayDates: string[];
  hrWarnings: Array<{
    date: string;
    notes: string;
    actionTaken?: string;
  }>;
}

export interface BirdsEyeSummary {
  month: string;
  totalWatched: number;
  greyCount: number;
  redCount: number;
  greenCount: number;
  branches: {
    grey: EmployeeBranch[];
    red: EmployeeBranch[];
    green: EmployeeBranch[];
  };
}
