import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);
const SESSION_COOKIE = "alimea_session";
const LOCALE = /^\/(pt-PT|en)(?=\/|$)/;
// Reachable without a session. /confirm is where emailed links land.
const PUBLIC = /^\/(pt-PT|en)\/(login|forgot-password|confirm)(\/|$)/;
const SIGN_IN = /^\/(pt-PT|en)\/(login|forgot-password)(\/|$)/;
const MFA = /^\/(pt-PT|en)\/mfa(\/|$)/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_ON = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Verify the in-memory backend's signed session cookie (HMAC-SHA256, base64url). */
async function validLocalSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const secret = process.env.SESSION_SECRET || "alimea-dev-session-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token.slice(0, dot))));
  const expected = btoa(String.fromCharCode(...mac)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return expected === token.slice(dot + 1);
}

export default async function proxy(req: NextRequest) {
  // Locale negotiation / rewrites first.
  const res = handleI18n(req);
  const { pathname } = req.nextUrl;
  const locale = pathname.match(LOCALE)?.[1];
  if (!locale) return res; // next-intl is redirecting to a localized URL

  let hasSession: boolean;
  let mfaPending = false;
  if (SUPABASE_ON) {
    // Bind Supabase to the request/response so the auth token is refreshed and
    // the new cookies are persisted on the way out.
    const supabase = createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
    if (user) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      mfaPending = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    }
  } else {
    hasSession = await validLocalSession(req.cookies.get(SESSION_COOKIE)?.value);
  }

  const isPublic = PUBLIC.test(pathname);
  if (!isPublic && !hasSession) {
    const url = new URL(`/${locale}/login`, req.url);
    const redirect = NextResponse.redirect(url);
    if (!SUPABASE_ON && req.cookies.has(SESSION_COOKIE)) redirect.cookies.delete(SESSION_COOKIE);
    return redirect;
  }
  // Password accepted but the 2FA code is still owed: nothing else is reachable.
  const onMfa = MFA.test(pathname);
  if (mfaPending && !onMfa && !isPublic) {
    const url = new URL(`/${locale}/mfa`, req.url);
    if (pathname === `/${locale}/update-password`) url.searchParams.set("next", "/update-password");
    return NextResponse.redirect(url);
  }
  if (onMfa && hasSession && !mfaPending) {
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }
  // (In-memory mode a signed cookie can outlive its account after a restart, so
  // only Supabase sessions — verified server-side — bounce away from /login.)
  if (SIGN_IN.test(pathname) && hasSession && !mfaPending && SUPABASE_ON) {
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }
  return res;
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
