import "server-only";

import { CONFIG } from "./config";
import { getHrWhatsAppNumbers } from "./hr-users";

/** Who receives the reminders and notifications: every active person in the HR_Users sheet tab. */
export async function reminderConfig() {
  return { enabled: CONFIG.remindersEnabled, recipients: await getHrWhatsAppNumbers() };
}

/** Sends to any chat (a person "91...@c.us" or a group "...@g.us"), optionally tagging people (mention ids like "91...@c.us"). */
export async function sendWahaText(opts: { chatId: string; text: string; mentions?: string[] }) {
  const base = CONFIG.wahaBaseUrl.replace(/\/+$/, "");
  const session = CONFIG.wahaSession;
  if (!base || !session) throw new Error("WhatsApp is not configured (WAHA_BASE_URL / WAHA_SESSION).");
  const res = await fetch(`${base}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}) },
    body: JSON.stringify({ session, chatId: opts.chatId, text: opts.text, ...(opts.mentions?.length ? { mentions: opts.mentions } : {}) }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`WAHA send failed. HTTP ${res.status} | ${body.slice(0, 200)}`);
  return body;
}

export async function sendWhatsApp(number: string, text: string) {
  const base = CONFIG.wahaBaseUrl.replace(/\/+$/, "");
  const session = CONFIG.wahaSession;
  if (!base || !session) throw new Error("WhatsApp is not configured (WAHA_BASE_URL / WAHA_SESSION).");
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
    const { recipients } = await reminderConfig();
    await Promise.allSettled(recipients.map((n) => sendWhatsApp(n, text)));
  } catch {}
}
