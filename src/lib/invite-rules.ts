// Pure rules for onboarding invitations (token handling and validity). Unit-tested.
import crypto from "node:crypto";

export const LINK_VALID_DAYS = 7; // "send link" mode
export const DEVICE_VALID_HOURS = 24; // "hand over a company device" mode

export type InviteMode = "link" | "device";
export type InviteStatus = "Invited" | "Opened" | "Processing" | "Submitted" | "Cancelled";

export const newToken = () => crypto.randomBytes(24).toString("base64url");
/** Only the hash is stored, so a leaked sheet cannot be used to open anyone's form. */
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const isTokenShape = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);

export function expiryFor(mode: InviteMode, from: Date): Date {
  const ms = mode === "device" ? DEVICE_VALID_HOURS * 3600_000 : LINK_VALID_DAYS * 86_400_000;
  return new Date(from.getTime() + ms);
}

export type InviteState = "ok" | "expired" | "used" | "cancelled" | "busy";

export function inviteState(invite: { status: string; expiresAt: string }, now: Date): InviteState {
  if (invite.status === "Cancelled") return "cancelled";
  if (invite.status === "Submitted") return "used";
  if (invite.status === "Processing") return "busy";
  const exp = Date.parse(invite.expiresAt);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return "expired";
  return "ok";
}
