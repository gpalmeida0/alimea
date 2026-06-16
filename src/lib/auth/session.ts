import { cookies } from "next/headers";

// Lightweight local session: the cookie holds the nutritionist (tenant) id.
// This is a free, dependency-free auth suitable for local/demo use. For
// production, swap for Supabase Auth (the data model is already multi-tenant).
export const SESSION_COOKIE = "alimea_session";

export async function getSessionNid(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSession(nid: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, nid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
