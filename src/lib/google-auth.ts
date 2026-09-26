import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

let cachedCredentials: ServiceAccountCredentials | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
let googleClockOffsetMs = 0;

function readCredentials(): ServiceAccountCredentials {
  if (cachedCredentials) return cachedCredentials;

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const parsed = inline
    ? JSON.parse(inline)
    : JSON.parse(fs.readFileSync(path.join(process.cwd(), "service account.json"), "utf8"));

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Google service-account credentials are incomplete.");
  }
  cachedCredentials = parsed;
  return cachedCredentials!;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function googleServerTimeSeconds() {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "HEAD",
      cache: "no-store",
    });
    const header = response.headers.get("date");
    if (header) {
      googleClockOffsetMs = Date.parse(header) - Date.now();
      return Math.floor(Date.parse(header) / 1000);
    }
  } catch {
    // Normal deployment environments have synchronized clocks; use local time as fallback.
  }
  return Math.floor(Date.now() / 1000);
}

export function trustedNowMs() {
  return Date.now() + googleClockOffsetMs;
}

export async function getGoogleAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const credentials = readCredentials();
  const now = await googleServerTimeSeconds();
  const header = encode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({
    iss: credentials.client_email,
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now - 30,
    exp: now + 3300,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key)
    .toString("base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Google authentication failed: ${body.error_description || body.error || response.status}`);
  }

  cachedToken = { value: body.access_token, expiresAt: Date.now() + 50 * 60_000 };
  return cachedToken.value;
}

export async function googleRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getGoogleAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || body.error_description || `Google API request failed (${response.status}).`);
  }
  return body as T;
}

