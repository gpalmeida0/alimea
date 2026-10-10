import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Local session for the in-memory backend (Supabase mode uses Supabase Auth).
// The cookie holds "<nutritionistId>.<hmac>" so it cannot be forged by simply
// writing another tenant's id into it.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "alimea_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[alimea] SESSION_SECRET is not set — using an insecure development secret.");
  }
  return "alimea-dev-session-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = token.slice(0, dot);
  const mac = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(value));
  return mac.length === expected.length && timingSafeEqual(mac, expected) ? value : null;
}

export async function getSessionNid(): Promise<string | null> {
  const store = await cookies();
  return verify(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(nid: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, `${nid}.${sign(nid)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// --- Password hashing (memory backend accounts) ------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
