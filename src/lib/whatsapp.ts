/**
 * WhatsApp Deep-Link Utility for AHL HR Command Center
 * Generates zero-cost, instant wa.me/ links for milestone reviews, action reminders, and celebrations.
 */

export function cleanPhoneNumber(mobile?: string): string {
  if (!mobile) return "";
  // Sheets often hold two numbers ("98765 43210 / 91234 56789"); use the first
  const first = mobile.split(/[\/,;|]|\s+or\s+/i)[0];
  let digits = first.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) return `91${digits}`;
  // 11 digits starting with 0 (trunk prefix): replace the 0 with 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  // Anything else must look like a full international number, otherwise don't guess
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
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
