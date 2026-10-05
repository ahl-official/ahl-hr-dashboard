import "server-only";

/** Who receives the reminders and notifications: the HR numbers in REMINDERS_HR_NUMBERS (comma-separated). */
export function reminderConfig() {
  const recipients = (process.env.REMINDERS_HR_NUMBERS || "").split(",").map((s) => s.replace(/\D/g, "")).filter(Boolean);
  return { enabled: process.env.REMINDERS_ENABLED === "true", recipients };
}

export async function sendWhatsApp(number: string, text: string) {
  const base = process.env.WAHA_BASE_URL?.replace(/\/+$/, "");
  const session = process.env.WAHA_SESSION;
  if (!base || !session) throw new Error("WAHA_BASE_URL / WAHA_SESSION are not configured.");
  const res = await fetch(`${base}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}) },
    body: JSON.stringify({ session, chatId: `${number.replace(/\D/g, "")}@c.us`, text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`WAHA responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({}));
}

/** Tell HR something happened. Goes to the configured recipients (the developer number in dev mode). Never throws. */
export async function notifyHr(text: string) {
  try {
    const { recipients } = reminderConfig();
    await Promise.allSettled(recipients.map((n) => sendWhatsApp(n, text)));
  } catch {}
}
