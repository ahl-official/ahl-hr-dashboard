export type FmsCandidateStageId = "ar" | "ps" | "cc" | "jo" | "doc" | "ob";

export interface FmsStageMeta {
  id: FmsCandidateStageId;
  name: string;
  color: string;
  bg: string;
  textColor: string;
  weeks: number;
  checklist: string[];
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "date";
    opts?: string[];
    ph?: string;
  }>;
}

export const FMS_CANDIDATE_STAGES: FmsStageMeta[] = [
  {
    id: "ar",
    name: "Application Received",
    color: "#2563EB",
    bg: "#EFF6FF",
    textColor: "#1D4ED8",
    weeks: 0.14,
    checklist: [],
    fields: [
      {
        key: "applicationStatus",
        label: "Application Status",
        type: "select",
        opts: ["Under Review", "Interview Scheduled", "No Response", "Dropped"],
      },
      { key: "sourceChannel", label: "How did they apply?", type: "text", ph: "LinkedIn, walk-in, referral…" },
      { key: "initialNotes", label: "Initial notes", type: "textarea", ph: "First impressions, relevant observations…" },
    ],
  },
  {
    id: "ps",
    name: "Interview Updates",
    color: "#D97706",
    bg: "#FFFBEB",
    textColor: "#92400E",
    weeks: 0.43,
    checklist: [],
    fields: [
      {
        key: "interviewUpdateStatus",
        label: "Interview Status",
        type: "select",
        opts: ["Hired", "Not Hired", "Didn't Come for Interview", "Rescheduled"],
      },
      {
        key: "rescheduledDate",
        label: "Rescheduled Date",
        type: "date",
      },
      {
        key: "rescheduledStatus",
        label: "Rescheduled Status",
        type: "select",
        opts: ["Pending", "Hired", "Not Hired", "Didn't Come for Interview"],
      },
      { key: "screeningNotes", label: "Interview Notes / Remarks", type: "textarea", ph: "Candidate response, feedback, trial observations…" },
    ],
  },
  {
    id: "cc",
    name: "Confirmation Call",
    color: "#7C3AED",
    bg: "#F5F3FF",
    textColor: "#5B21B6",
    weeks: 0.29,
    checklist: [],
    fields: [
      { key: "callDate", label: "Call date", type: "date" },
      { key: "noticePeriod", label: "Notice period", type: "text", ph: "e.g. 30 days, immediate" },
      { key: "salaryExpected", label: "Expected salary", type: "text", ph: "e.g. ₹5-6 LPA" },
      { key: "callNotes", label: "Call notes", type: "textarea", ph: "Summary of conversation…" },
    ],
  },
  {
    id: "jo",
    name: "Joining",
    color: "#0D9488",
    bg: "#F0FDFA",
    textColor: "#115E59",
    weeks: 1,
    checklist: [],
    fields: [
      { key: "offerDate", label: "Offer letter date", type: "date" },
      { key: "joiningDate", label: "Confirmed joining date", type: "date" },
      { key: "offeredSalary", label: "Offered salary/CTC", type: "text", ph: "e.g. ₹6 LPA" },
      { key: "uniformSize", label: "Uniform Size", type: "select", opts: ["S", "M", "L", "XL", "XXL", "Custom"] },
      { key: "uniformDetails", label: "Uniform details/remarks", type: "textarea", ph: "Color, quantity, special fit…" },
      { key: "joiningNotes", label: "Notes", type: "textarea", ph: "Any special arrangements…" },
    ],
  },
  {
    id: "doc",
    name: "Documentation",
    color: "#6366F1",
    bg: "#EEF2FF",
    textColor: "#4338CA",
    weeks: 0.5,
    checklist: [],
    fields: [
      { key: "dateOfBirth", label: "Date of Birth", type: "date" },
      { key: "gender", label: "Gender", type: "select", opts: ["Male", "Female", "Other"] },
      { key: "bloodGroup", label: "Blood Group", type: "select", opts: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      { key: "aadharCardNumber", label: "Aadhar Number", type: "text" },
      { key: "panNumber", label: "PAN Number", type: "text" },
      { key: "bankName", label: "Bank Name", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
      { key: "accountNumber", label: "Account Number", type: "text" },
      { key: "ifscCode", label: "IFSC Code", type: "text" },
    ],
  },
  {
    id: "ob",
    name: "Onboarding",
    color: "#16A34A",
    bg: "#F0FDF4",
    textColor: "#14532D",
    weeks: 2,
    checklist: [],
    fields: [
      { key: "empId", label: "Employee ID assigned", type: "text", ph: "e.g. EMP-0045" },
      { key: "mentorName", label: "Mentor/Buddy assigned", type: "text", ph: "Name of mentor" },
      { key: "onboardingNotes", label: "Onboarding notes", type: "textarea", ph: "How did it go? Any concerns?" },
    ],
  },
];

export interface FmsCandidateStageTracking {
  plannedDate?: string;
  actualDate?: string;
  status: "Pending" | "In Progress" | "Completed" | "Overdue" | "Dropped" | string;
  delayDays?: number;
  checklistState?: Record<string, boolean>;
  fieldValues?: Record<string, string>;
}

export interface FmsPersonalAndBankDetails {
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  aadharCardNumber?: string;
  panNumber?: string;
  permanentAddress?: string;
  currentAddress?: string;
  personalEmail?: string;
  fatherName?: string;
  motherName?: string;
  emergencyContactName?: string;
  relationship?: string;
  emergencyContactNumber?: string;
  numberOfSiblings?: string;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  ifscCode?: string;
  primaryHobbies?: string;
  dietaryPreference?: string;
  vehicleOwnership?: string;
  housingStatus?: string;
}

export interface FmsInterviewRecord {
  id: string; // e.g. INT-001
  candidateId: string;
  roundName: string; // e.g. "Screening Call", "Salon Practical Trial", "Technical Interview", "Final HR Round"
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // e.g. "11:00 AM"
  durationMinutes?: number;
  mode: "In-Person" | "Video Call" | "Phone Call";
  locationOrLink?: string; // e.g. "Bandra Salon" or "Google Meet"
  interviewerName: string;
  status: "Scheduled" | "Passed" | "Failed" | "On Hold" | "Rescheduled" | "Cancelled";
  rating?: number; // 1 to 5
  feedback?: string;
  hireOsScore?: number; // e.g. 88
  discProfile?: string; // e.g. "High D / Driver"
  createdAt?: string;
  completedAt?: string;
}

export interface FmsCandidate {
  id: string; // e.g. CAND-0010
  fmsId: string; // e.g. FMS-9119741f
  fullName: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  gender?: string;
  city?: string;
  area?: string;
  dob?: string;
  source?: string;
  position?: string;
  experience?: string;
  education?: string;
  currentCompany?: string;
  currentDesignation?: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  skills?: string;
  resumeLink?: string;
  resumeFile?: string;
  currentStage: string; // "Application Received" | "Pre-Screening" | "Confirmation Call" | "Joining" | "Documentation" | "Onboarding"
  status: "Active" | "Archived" | "Dropped" | "Hired" | string;
  interviewStatus?: string; // "Active" | "Scheduled" | "Completed" | "Dropped"
  archived?: boolean;
  archiveReason?: string;
  applicationStatus?: "Under Review" | "Interview Scheduled" | "No Response" | "Dropped" | string;
  interviewUpdateStatus?: "Hired" | "Not Hired" | "Didn't Come for Interview" | "Rescheduled" | string;
  rescheduledDate?: string;
  rescheduledStatus?: "Pending" | "Hired" | "Not Hired" | "Didn't Come for Interview" | string;
  stageData: Record<string, any>;
  stages: Record<string, FmsCandidateStageTracking>;
  personalDetails: FmsPersonalAndBankDetails;
  requisitionId?: string;
  brand: "ahl" | "alchamae" | string;
  assignedTo?: string;
  followUpDate?: string;
  notes?: string;
  interviews?: FmsInterviewRecord[];
  hireOsScore?: number;
  discProfile?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FmsRequisition {
  id: string; // e.g. REQ-2026-006
  jobTitle: string;
  department: string;
  hiringManager: string;
  jobLevel: string;
  employmentType: string;
  location: string;
  deadline: string;
  reason: string;
  status: "Open" | "Filled" | "Cancelled" | string;
  createdDate: string;
  hiredDate?: string;
  filledByCandidateId?: string;
  brand: "ahl" | "alchamae" | "both" | string;
  minExp?: string;
  maxExp?: string;
  openings?: number;
  budget?: string;
  workLocation?: string;
  requiredSkills?: string;
  recruiterName?: string;
  priority: "High" | "Medium" | "Low" | string;
  targetStart?: string;
  jobDescription?: string;
  notes?: string;
}

export interface FmsProblemStage {
  plannedDate?: string;
  actualDate?: string;
  status: string;
  delayDays?: number;
}

export interface FmsProblem {
  id: string; // e.g. PRB-20260508-6491
  dateLogged: string;
  description: string;
  raisedBy: string;
  assignedTo?: string;
  department: string;
  priority: "Urgent" | "High" | "Medium" | "Low" | string;
  owner: string;
  deadline: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed" | string;
  nextAction?: string;
  category?: string;
  author?: string;
  stageData: Record<string, FmsProblemStage>;
  createdAt: string;
  updatedAt: string;
}

export interface FmsTraining {
  id: string; // e.g. TRN-0000
  brand: "ahl" | "alchamae" | "both" | string;
  title: string;
  department: string;
  trainer: string;
  plannedStart: string;
  duration: string | number;
  description: string;
  currentStage: "tr_plan" | "tr_schedule" | "tr_progress" | "tr_eval" | "tr_closed" | string;
  status: "Active" | "Completed" | "Cancelled" | string;
  stageData: Record<string, any>;
  createdDate: string;
  updatedDate: string;
}

export interface FmsLeave {
  id: string; // e.g. LV-0000
  employeeId: string;
  brand: "ahl" | "alchamae" | "both" | string;
  leaveType: "Casual Leave" | "Sick Leave" | "Paid Leave" | string;
  days: number | string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  createdDate: string;
  approvedBy?: string;
}

export interface FmsHoliday {
  id: string; // e.g. HOL-000
  name: string;
  date: string;
  type: "National" | "Festival" | string;
  appliesTo: "ahl" | "alchamae" | "both" | string;
  createdDate: string;
}
