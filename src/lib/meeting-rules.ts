// How the simplified "Record meeting" form maps onto the sheet columns. Pure and unit-tested.

export type MeetingFormInput = {
  /** The single date on the form. */
  date: string;
  /** Only set when "Add a follow-up" is switched on. */
  followUpDate?: string;
  /** Today as YYYY-MM-DD (passed in so the rule is testable). */
  today: string;
  meetingType: string;
  warningChecked: boolean;
};

export type MeetingColumns = {
  scheduledDate: string;
  meetingDate: string;
  recordStatus: "Open" | "Completed";
  warningGiven: "Yes" | "No";
};

/**
 * - A future date is a scheduled meeting: it stays Open until it happens.
 * - Today or earlier means it was held. It is Completed, unless a follow-up is still pending.
 * - Type "Warning" always counts as a formal warning.
 */
export function deriveMeetingColumns(i: MeetingFormInput): MeetingColumns {
  const future = i.date > i.today;
  const pendingFollowUp = Boolean(i.followUpDate);
  return {
    scheduledDate: future ? i.date : "",
    meetingDate: future ? "" : i.date,
    recordStatus: future || pendingFollowUp ? "Open" : "Completed",
    warningGiven: i.meetingType === "Warning" || i.warningChecked ? "Yes" : "No",
  };
}

/** First problem with the form, or null. */
export function validateMeetingForm(i: { employeeKey: string; notes: string; date: string; followUpOn: boolean; followUpDate: string }): string | null {
  if (!i.employeeKey) return "Please choose an employee.";
  if (!i.date) return "Please pick a date.";
  if (!i.notes.trim()) return "Please add a short note about the meeting.";
  if (i.followUpOn && !i.followUpDate) return "Please set a due date for the follow-up, or switch the follow-up off.";
  if (i.followUpOn && i.followUpDate < i.date) return "The follow-up date cannot be before the meeting date.";
  return null;
}
