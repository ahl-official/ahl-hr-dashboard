// Settings for WhatsApp reminders and Drive uploads. NOTHING sensitive is written here: the WAHA address,
// session name, keys, and the uploader address all come from environment variables
// (Vercel -> Settings -> Environment Variables; locally .env.local). This file only reads them.

export const CONFIG = {
  /** WhatsApp (WAHA) server, and the session that sends the messages. */
  wahaBaseUrl: process.env.WAHA_BASE_URL || "",
  wahaSession: process.env.WAHA_SESSION || "",

  /** Apps Script that saves files into the HR Drive folder (it also requires DRIVE_UPLOADER_SECRET). */
  driveUploaderUrl: process.env.DRIVE_UPLOADER_URL || "",

  /** Scheduled reminders are on unless REMINDERS_ENABLED=false. */
  remindersEnabled: process.env.REMINDERS_ENABLED !== "false",
};
