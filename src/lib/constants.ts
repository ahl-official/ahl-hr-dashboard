export const CANONICAL_DEPARTMENTS: string[] = [
  "Human Resources (HR)",
  "Accounts",
  "Video Editor",
  "Graphic Designer",
  "Digital Marketing",
  "Artificial Intelligence (AI)",
  "MIS Executive",
  "Content Writer",
  "Influencer Marketing",
  "Videographer",
  "Purchase",
  "Customer Service Executive",
  "Labour",
  "Maintenance",
  "Housekeeping",
  "Process Coordinator",
  "Inventory",
  "Floor Manager",
  "Business Development",
  "AHL Technician",
  "CRR",
  "ALC Technician",
  "Consultant",
  "PMU",
];

export const COMPANIES: string[] = [
  "American Hairline (AHL)",
  "Alchemane (ALC)",
  "YDigital",
];

export const MEETING_TYPES = [
  "Onboarding Feedback",
  "Quarterly Review",
  "Appraisal",
  "Warning",
  "General",
  "Follow-Up",
  "Exit Meeting",
] as const;

export const MEETING_STATUSES = ["Open", "Completed", "Cancelled"] as const;

export const DOCUMENT_TYPES = [
  "Joining Letter",
  "Policy Signing",
  "Meeting Attachment",
  "Exit",
  "Relieving Letter",
  "Onboarding Form",
  "Other",
] as const;

export const DOCUMENT_STATUSES = [
  "Missing",
  "Pending",
  "Uploaded",
  "Verified",
] as const;

export const GENDERS = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say",
] as const;

export const DIETARY_PREFERENCES = ["Veg", "Non-Veg", "Maybe"] as const;

export const VEHICLE_OWNERSHIPS = ["Car", "Bike", "Scooty", "None"] as const;

export const HOUSING_STATUSES = ["Rented Property", "Own Property"] as const;

export const SENSITIVE_FIELDS_HR_MASK: string[] = [
  "Aadhar Card Number",
  "PAN Number",
  "Bank Name",
  "Branch",
  "Account Number",
  "IFSC Code",
  "Current Salary",
  "Permanent Address",
  "Current Address",
];

// Muted, brand-led categorical palette (key names kept so chart code is unchanged)
export const CHART_COLORS = {
  navy: "#0B1F2A",
  indigo: "#136573", // brand teal
  emerald: "#5B8F6B", // sage
  sky: "#3B6EA5", // steel blue
  violet: "#7A5C99", // plum
  rose: "#B5614A", // clay
  amber: "#C08A2B", // ochre
  slate: "#64748B",
  light: "#E2E8F0",
};

export const PALETTE = [
  "#136573",
  "#3B6EA5",
  "#C08A2B",
  "#5B8F6B",
  "#7A5C99",
  "#B5614A",
  "#64748B",
  "#4BA3B2",
  "#8FB3D9",
  "#D9B36A",
  "#9CC3A8",
  "#B9A3CF",
];
