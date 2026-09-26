import { EmployeeSummary, BirthdayEvent, ReviewEvent } from "@/types";

export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

export function safeAnniversaryDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
}

export function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  return safeAnniversaryDate(year, month, date.getDate());
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export function formatQuarterlyMilestone(totalMonths: number): {
  label: string;
  shortLabel: string;
} {
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (!years) {
    return {
      label: `${totalMonths}-month milestone`,
      shortLabel: `${totalMonths}M`,
    };
  }
  if (!remainingMonths) {
    return {
      label: `${years}-year completion`,
      shortLabel: `${years}Y`,
    };
  }
  return {
    label: `${years} ${years === 1 ? "year" : "years"} + ${remainingMonths} months milestone`,
    shortLabel: `${years}Y+${remainingMonths}M`,
  };
}

export function getNextEmployeeReview(doj: Date, today: Date): {
  date: Date;
  label: string;
  shortLabel: string;
  meetingType: "Onboarding Feedback" | "Quarterly Review";
  reviewStage: "onboarding" | "tenure";
  totalMonths: number;
} {
  const onboardingReviews = [
    { date: addCalendarDays(doj, 7), label: "7-day feedback", shortLabel: "7D", months: 0 },
    { date: addCalendarDays(doj, 15), label: "15-day feedback", shortLabel: "15D", months: 0 },
    { date: addMonthsClamped(doj, 1), label: "1-month feedback", shortLabel: "1M", months: 1 },
  ];

  const upcomingOnboardingReview = onboardingReviews.find((review) => review.date >= today);

  if (upcomingOnboardingReview) {
    return {
      date: upcomingOnboardingReview.date,
      label: upcomingOnboardingReview.label,
      shortLabel: upcomingOnboardingReview.shortLabel,
      meetingType: "Onboarding Feedback",
      reviewStage: "onboarding",
      totalMonths: upcomingOnboardingReview.months,
    };
  }

  const approximateMonths = Math.max(
    3,
    (today.getFullYear() - doj.getFullYear()) * 12 + today.getMonth() - doj.getMonth()
  );
  let milestoneMonths = Math.max(3, Math.floor(approximateMonths / 3) * 3);
  let milestoneDate = addMonthsClamped(doj, milestoneMonths);

  while (milestoneDate < today) {
    milestoneMonths += 3;
    milestoneDate = addMonthsClamped(doj, milestoneMonths);
  }
  while (milestoneMonths > 3 && addMonthsClamped(doj, milestoneMonths - 3) >= today) {
    milestoneMonths -= 3;
    milestoneDate = addMonthsClamped(doj, milestoneMonths);
  }

  const milestoneName = formatQuarterlyMilestone(milestoneMonths);
  return {
    date: milestoneDate,
    label: milestoneName.label,
    shortLabel: milestoneName.shortLabel,
    meetingType: "Quarterly Review",
    reviewStage: "tenure",
    totalMonths: milestoneMonths,
  };
}

export function calculateBirthdays(
  employees: EmployeeSummary[],
  horizonDays: number = 30
): BirthdayEvent[] {
  const today = startOfDay(new Date());
  const events: BirthdayEvent[] = [];
  for (const employee of employees) {
    const dob = parseIsoDate(employee.dob);
    if (!dob) continue;
    let next = safeAnniversaryDate(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (next < today) {
      next = safeAnniversaryDate(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
    }
    const daysUntil = daysBetween(today, next);
    if (daysUntil <= horizonDays && daysUntil >= 0) {
      events.push({
        employeeKey: employee.employeeKey,
        employeeName: employee.fullName,
        department: employee.department,
        date: next.toISOString().slice(0, 10),
        dateObj: next,
        daysUntil,
        age: next.getFullYear() - dob.getFullYear(),
        employee,
      });
    }
  }
  return events.sort((a, b) => a.daysUntil - b.daysUntil || a.employeeName.localeCompare(b.employeeName));
}

export function calculateMilestones(
  employees: EmployeeSummary[],
  horizonDays: number = 30
): ReviewEvent[] {
  const today = startOfDay(new Date());
  const events: ReviewEvent[] = [];
  for (const employee of employees) {
    const doj = parseIsoDate(employee.doj);
    if (!doj || doj > today) continue;
    const review = getNextEmployeeReview(doj, today);
    const daysUntil = daysBetween(today, review.date);
    if (horizonDays === Infinity || (daysUntil <= horizonDays && daysUntil >= 0)) {
      events.push({
        employeeKey: employee.employeeKey,
        employeeName: employee.fullName,
        department: employee.department,
        date: review.date.toISOString().slice(0, 10),
        dateObj: review.date,
        daysUntil,
        label: review.label,
        shortLabel: review.shortLabel,
        meetingType: review.meetingType,
        reviewStage: review.reviewStage,
        totalMonths: review.totalMonths,
        employee,
      });
    }
  }
  return events.sort((a, b) => a.daysUntil - b.daysUntil || a.employeeName.localeCompare(b.employeeName));
}

export function formatTenure(value: string | undefined | null): string {
  const doj = parseIsoDate(value);
  if (!doj) return "DOJ missing";
  const days = Math.max(0, daysBetween(doj, new Date()));
  const years = Math.floor(days / 365.2425);
  const months = Math.floor((days - years * 365.2425) / 30.44);
  if (years) return `${years}y ${Math.max(0, months)}m`;
  if (months) return `${months} months`;
  return `${Math.round(days)} days`;
}

export function formatExactTenure(value: string | undefined | null): string {
  const doj = parseIsoDate(value);
  const today = startOfDay(new Date());
  if (!doj) return "DOJ missing";
  if (doj > today) return "Not started";

  let completedMonths =
    (today.getFullYear() - doj.getFullYear()) * 12 + today.getMonth() - doj.getMonth();
  if (today.getDate() < doj.getDate()) completedMonths -= 1;
  completedMonths = Math.max(0, completedMonths);

  const years = Math.floor(completedMonths / 12);
  const months = completedMonths % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  if (parts.length) return parts.join(" ");

  const days = Math.max(0, daysBetween(doj, today));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatAverageTenure(days: number): string {
  if (!days) return "0 months";
  const years = Math.floor(days / 365.2425);
  const months = Math.round((days - years * 365.2425) / 30.44);
  if (years && months) return `${years}y ${months}m`;
  if (years) return `${years} years`;
  return `${Math.max(1, months)} months`;
}

export function formatDisplayDate(value: string | undefined | null): string {
  const date = parseIsoDate(value);
  return date
    ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Not available";
}

export function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return "just now";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "just now";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function humanCountdown(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function birthdayAgeText(age: number): string {
  return age > 0 ? `Turning ${age}` : "";
}

export function initials(name: string | undefined | null): string {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (
    parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")
  ).toUpperCase();
}

export function lastTwelveMonths(): { key: string; label: string }[] {
  const today = new Date();
  const result: { key: string; label: string }[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    result.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return result;
}
