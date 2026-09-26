/**
 * WhatsApp Deep-Link Utility for AHL HR Command Center
 * Generates zero-cost, instant wa.me/ links for milestone reviews, action reminders, and celebrations.
 */

export function cleanPhoneNumber(mobile?: string): string {
  if (!mobile) return "";
  const digits = mobile.replace(/\D/g, "");
  if (!digits) return "";
  // If 10-digit Indian mobile number, prefix with country code 91
  if (digits.length === 10) return `91${digits}`;
  // If 11 digits starting with 0, replace 0 with 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Generate 1-click WhatsApp message URL for Onboarding/Tenure Milestones (7D, 15D, 1M, 3M, etc.)
 */
export function getMilestoneWhatsAppUrl(
  mobile: string,
  employeeName: string,
  milestoneLabel: string,
  scheduledDate: string
): string {
  const phone = cleanPhoneNumber(mobile);
  const firstName = employeeName.trim().split(" ")[0];
  const message = `Hello ${firstName}! 🎉 Congratulations on your *${milestoneLabel}* milestone with American Hairline!

HR would like to schedule a brief check-in review discussion with you on *${scheduledDate}*.

Please reply to confirm if this date and time works for you, or let us know an alternative convenient slot. Have a great day!`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Generate 1-click WhatsApp message URL for Action Items & Target Due Dates (Overdue or Due Today)
 */
export function getActionFollowUpWhatsAppUrl(
  mobile: string,
  employeeName: string,
  actionText: string,
  dueDate: string,
  isOverdue = false
): string {
  const phone = cleanPhoneNumber(mobile);
  const firstName = employeeName.trim().split(" ")[0];
  const urgencyPrefix = isOverdue ? "⚠️ *Action Overdue Reminder*" : "📌 *HR Action Reminder*";

  const message = `${urgencyPrefix}
Hello ${firstName}, this is a gentle follow-up from AHL HR regarding the scheduled action item:

*"${actionText}"*
Target Due Date: *${dueDate}*

Kindly update HR on the current progress or status at your earliest convenience. Thank you!`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Generate 1-click WhatsApp message URL for Birthday Celebrations
 */
export function getBirthdayWhatsAppUrl(mobile: string, employeeName: string): string {
  const phone = cleanPhoneNumber(mobile);
  const firstName = employeeName.trim().split(" ")[0];
  const message = `Dear ${firstName}, 🎂✨
Happy Birthday from all of us at American Hairline!

Wishing you good health, joy, and great milestones ahead. Have a wonderful celebration! 🎉`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Generic HR Discussion / Check-in WhatsApp URL
 */
export function getCheckInWhatsAppUrl(mobile: string, employeeName: string, topic?: string): string {
  const phone = cleanPhoneNumber(mobile);
  const firstName = employeeName.trim().split(" ")[0];
  const message = `Hello ${firstName},
AHL HR would like to coordinate a brief 1-on-1 check-in discussion${topic ? ` regarding *${topic}*` : ""}.

Please let us know your availability today. Thank you!`;

  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
