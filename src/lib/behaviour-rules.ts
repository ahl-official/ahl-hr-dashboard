import type {
  BehaviourEvaluationInput,
  BehaviourSignal,
  EmployeeBranch,
  BranchColor,
  BranchStatus,
} from "../types/behaviour-tracker.ts";

export const LATE_MARKS_THRESHOLD = 6; // Per Hazri Box policy

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Resolves an employee's scheduled week-off day (0=Sun, 1=Mon, ..., 6=Sat).
 * In AHL/ALC, the company operates 6 days a week, and each department/employee
 * has a designated single day off.
 *
 * Priority order:
 * 1. Specified per employee (`scheduledWeekOff`)
 * 2. Specified per department (e.g. Monday for Salon/Styling/Clinic, Sunday for Back Office/Admin/HR)
 * 3. Backup: Hazri Box `working_days` array (missing 7th day is week-off)
 * 4. Fallback default: Sunday (0)
 */
export function resolveScheduledWeekOff(
  scheduledWeekOff?: number | string,
  workingDays?: string[],
  department?: string
): number {
  // 1. Specified per employee directly
  if (typeof scheduledWeekOff === "number" && scheduledWeekOff >= 0 && scheduledWeekOff <= 6) {
    return scheduledWeekOff;
  }
  if (typeof scheduledWeekOff === "string") {
    const lower = scheduledWeekOff.trim().toLowerCase();
    const idx = DAY_NAMES.findIndex((d) => d.toLowerCase().startsWith(lower.slice(0, 3)));
    if (idx !== -1) return idx;
  }

  // 2. Specified per department (Primary Policy)
  if (department) {
    const dept = department.toLowerCase();
    if (/salon|styling|hair|technician|clinic|service|front desk/i.test(dept)) {
      return 1; // Monday for Salon / Styling / Technicians
    }
    if (/back office|general|admin|hr|human resources|management|accounts|finance|marketing/i.test(dept)) {
      return 0; // Sunday for Back Office / Corporate
    }
  }

  // 3. Backup: Hazri Box working_days array (missing day = week-off)
  if (Array.isArray(workingDays) && workingDays.length === 6) {
    const presentDays = workingDays.map((d) => d.trim().slice(0, 3).toLowerCase());
    const missingIdx = DAY_ABBR.findIndex((d) => !presentDays.includes(d.toLowerCase()));
    if (missingIdx !== -1) return missingIdx;
  }

  // 4. Default fallback: Sunday (0)
  return 0;
}

/**
 * Check if a leave date falls on the day directly before or directly after the employee's scheduled week-off.
 */
export function isAdjacentToWeekOff(dateStr: string, weekOffDay: number): {
  isAdjacent: boolean;
  relation?: "before" | "after";
  leaveDayName: string;
  weekOffDayName: string;
} {
  const day = getDayOfWeek(dateStr);
  const dayBeforeWeekOff = (weekOffDay - 1 + 7) % 7;
  const dayAfterWeekOff = (weekOffDay + 1) % 7;

  if (day === dayBeforeWeekOff) {
    return {
      isAdjacent: true,
      relation: "before",
      leaveDayName: DAY_NAMES[day],
      weekOffDayName: DAY_NAMES[weekOffDay],
    };
  }
  if (day === dayAfterWeekOff) {
    return {
      isAdjacent: true,
      relation: "after",
      leaveDayName: DAY_NAMES[day],
      weekOffDayName: DAY_NAMES[weekOffDay],
    };
  }
  return {
    isAdjacent: false,
    leaveDayName: DAY_NAMES[day],
    weekOffDayName: DAY_NAMES[weekOffDay],
  };
}

/**
 * Format a date string YYYY-MM-DD to Day of Week (0=Sun, 1=Mon, ..., 6=Sat)
 */
export function getDayOfWeek(dateStr: string): number {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return d.getUTCDay();
}

/**
 * Check if a date is adjacent (+1 or -1 day) to any holiday
 */
export function isAdjacentToHoliday(dateStr: string, holidayDates: string[]): { isBridge: boolean; holidayDate?: string } {
  const target = new Date(dateStr).getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  for (const hStr of holidayDates) {
    const hTime = new Date(hStr).getTime();
    if (Math.abs(target - hTime) === ONE_DAY) {
      return { isBridge: true, holidayDate: hStr };
    }
  }
  return { isBridge: false };
}

/**
 * Detect all behavioral signals for an employee in a given month.
 */
export function detectBehaviourSignals(input: BehaviourEvaluationInput): BehaviourSignal[] {
  const signals: BehaviourSignal[] = [];

  // 1. Repeated Late Marks (Threshold >= 6)
  if (input.lateDaysCount >= LATE_MARKS_THRESHOLD) {
    signals.push({
      type: "late_marks",
      title: "Excessive Late Marks",
      description: `Logged ${input.lateDaysCount} late arrivals this month (Hazri Box allowance threshold is 5).`,
      severity: input.lateDaysCount >= 10 ? "high" : "medium",
      occurrences: input.lateDaysCount,
      dates: input.lateDays,
    });
  }

  // 2. Week-Off Extension Leaves (Pre / Post Scheduled Off Day in a 6-day working company)
  const scheduledWeekOff = resolveScheduledWeekOff(
    input.scheduledWeekOff,
    input.workingDays,
    input.department
  );
  const weekOffDayName = DAY_NAMES[scheduledWeekOff];
  const weekOffExtensionDates: string[] = [];
  const monFriLeaveDates: string[] = [];
  const holidayBridgeDates: string[] = [];

  input.leaveRecords.forEach((lr) => {
    // Generate dates between from and till
    const start = new Date(lr.from);
    const end = new Date(lr.till);
    const cur = new Date(start);

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const day = cur.getUTCDay();

      // Check Week-Off Bridge (day before or day after scheduled day off)
      const adjOff = isAdjacentToWeekOff(dStr, scheduledWeekOff);
      if (adjOff.isAdjacent) {
        weekOffExtensionDates.push(
          `${dStr} (${adjOff.leaveDayName}, day ${adjOff.relation} ${adjOff.weekOffDayName} off)`
        );
      }

      // Monday (1) or Friday (5) for traditional 5-day / Sunday-off tracking
      if (day === 1 || day === 5) {
        monFriLeaveDates.push(`${dStr} (${day === 1 ? "Monday" : "Friday"})`);
      }

      // Check Holiday Bridge
      const bridge = isAdjacentToHoliday(dStr, input.holidayDates);
      if (bridge.isBridge) {
        holidayBridgeDates.push(`${dStr} (Adjacent to holiday ${bridge.holidayDate})`);
      }

      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  });

  if (weekOffExtensionDates.length >= 2) {
    signals.push({
      type: "week_off_extension_leave",
      title: `Week-Off Extension Leaves (${weekOffDayName} Off)`,
      description: `Took ${weekOffExtensionDates.length} leaves directly adjacent to scheduled ${weekOffDayName} week-off in a 6-day work week.`,
      severity: weekOffExtensionDates.length >= 3 ? "high" : "medium",
      occurrences: weekOffExtensionDates.length,
      dates: weekOffExtensionDates,
    });
  } else if (monFriLeaveDates.length >= 2) {
    signals.push({
      type: "mon_fri_leave",
      title: "Weekend Extension Leaves (Mon/Fri)",
      description: `Took ${monFriLeaveDates.length} leaves falling on Mondays or Fridays.`,
      severity: monFriLeaveDates.length >= 3 ? "high" : "medium",
      occurrences: monFriLeaveDates.length,
      dates: monFriLeaveDates,
    });
  }

  if (holidayBridgeDates.length > 0) {
    signals.push({
      type: "holiday_bridge_leave",
      title: "Leaves Adjacent to Holidays",
      description: `Took leave adjacent to public/festive holidays to create long breaks.`,
      severity: "medium",
      occurrences: holidayBridgeDates.length,
      dates: holidayBridgeDates,
    });
  }

  // 3. Frequent Leaves (Overall volume)
  const totalLeaveDays = input.leaveRecords.reduce((acc, r) => acc + (r.days || 1), 0);
  if (input.leaveRecords.length >= 3 || totalLeaveDays >= 4) {
    signals.push({
      type: "frequent_leaves",
      title: "High Leave Frequency",
      description: `Requested ${input.leaveRecords.length} separate leave requests totaling ${totalLeaveDays} days.`,
      severity: totalLeaveDays >= 6 ? "high" : "medium",
      occurrences: totalLeaveDays,
      dates: input.leaveRecords.map((r) => `${r.from} to ${r.till} (${r.type})`),
    });
  }

  // 4. Repeated HR Mistakes or Conduct Issues
  if (input.hrWarnings.length > 0) {
    signals.push({
      type: "hr_conduct_issue",
      title: "HR Disciplinary Warnings",
      description: `${input.hrWarnings.length} warning note(s) logged by HR for performance or conduct.`,
      severity: "high",
      occurrences: input.hrWarnings.length,
      dates: input.hrWarnings.map((w) => `${w.date}: ${w.notes}`),
    });
  }

  return signals;
}

/**
 * Determine the branch state when evaluating an employee for the current month.
 */
export function evaluateBranchState(
  input: BehaviourEvaluationInput,
  previousBranch?: EmployeeBranch | null
): {
  color: BranchColor;
  status: BranchStatus;
  signals: BehaviourSignal[];
  actionRequired: boolean;
} {
  const currentSignals = detectBehaviourSignals(input);
  const hasViolations = currentSignals.length > 0;

  // Case 1: No previous active branch
  if (!previousBranch || previousBranch.status === "improved") {
    if (hasViolations) {
      return {
        color: "grey",
        status: "watching",
        signals: currentSignals,
        actionRequired: true,
      };
    }
    // No pattern and no prior watch -> No branch needed
    return {
      color: "green",
      status: "improved",
      signals: [],
      actionRequired: false,
    };
  }

  // Case 2: Previous branch was "watching" (Grey) or "repeat" (Red)
  if (hasViolations) {
    // Employee DID NOT improve -> Escalates to RED
    return {
      color: "red",
      status: "repeat",
      signals: currentSignals,
      actionRequired: true,
    };
  } else {
    // Employee IMPROVED -> Turns GREEN and closes
    return {
      color: "green",
      status: "improved",
      signals: [],
      actionRequired: false,
    };
  }
}

/**
 * Formats the monthly WhatsApp message to be dispatched to the employee.
 * Strictly 1 message sent per month.
 */
export function buildEmployeeWhatsAppMessage(
  branch: EmployeeBranch,
  monthName: string
): string {
  if (branch.status === "improved" || branch.color === "green") {
    return [
      `🌟 *Attendance & Conduct Update — ${monthName}*`,
      ``,
      `Hello ${branch.employeeName},`,
      ``,
      `Great news! Your attendance and punctuality for ${monthName} showed commendable improvement. Your observation branch is now officially *resolved and closed*.`,
      ``,
      `Thank you for your dedication to American Hairline standards! Keep up the great work. 🙌`,
      ``,
      `— *AHL HR Operations*`,
    ].join("\n");
  }

  const issueBulletPoints = branch.signals
    .map((s) => `• *${s.title}*: ${s.description}`)
    .join("\n");

  const urgencyNote =
    branch.color === "red"
      ? `⚠️ *Important*: This is a recurring notice following our previous review. Please meet with your HR manager this week.`
      : `ℹ️ *Action*: HR will conduct a brief 1-on-1 check-in to discuss and support your improvement.`;

  return [
    `📋 *Monthly Attendance & Behaviour Report — ${monthName}*`,
    ``,
    `Hello ${branch.employeeName},`,
    ``,
    `Here is your monthly attendance and workplace review summary for *${monthName}*:`,
    ``,
    issueBulletPoints,
    ``,
    urgencyNote,
    ``,
    `Maintaining punctuality and planning leaves in advance helps our salons and team deliver the best client care.`,
    ``,
    `— *AHL HR Team*`,
  ].join("\n");
}

/**
 * Formats the HR dossier summary for HR discussion.
 */
export function buildHrTalkDossier(branch: EmployeeBranch): string {
  const signalDetails = branch.signals
    .map(
      (s, i) =>
        `${i + 1}. [${s.severity.toUpperCase()}] ${s.title}: ${s.description}\n   Dates: ${s.dates.slice(0, 5).join(", ")}${s.dates.length > 5 ? ` (+${s.dates.length - 5} more)` : ""}`
    )
    .join("\n\n");

  return [
    `EMPLOYEE BEHAVIOUR DOSSIER — ${branch.employeeName} (${branch.employeeId})`,
    `Department: ${branch.department} | Company: ${branch.company} | Month: ${branch.month}`,
    `Branch Status: ${branch.color.toUpperCase()} (${branch.status.toUpperCase()})`,
    `-------------------------------------------------------------------`,
    `IDENTIFIED PATTERNS:`,
    signalDetails || "No active negative patterns logged.",
    `-------------------------------------------------------------------`,
    `RECOMMENDED HR TALK POINTS:`,
    `- Clarify root cause behind late arrivals / Monday-Friday leaves.`,
    `- Confirm awareness of salon shift schedules and 6-late marks policy.`,
    `- Agree on target: 0 unapproved leaves and <= 2 lates for next month.`,
  ].join("\n");
}
