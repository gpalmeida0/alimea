import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);
const LEGACY_COOKIE = "alimea_session";
const PUBLIC = /^\/(pt-PT|en)\/(login|signup)(\/|$)/;
const LOCALIZED = /^\/(pt-PT|en)(\/|$)/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_ON = Boolean(SUPABASE_URL && SUPABASE_KEY);

export default async function middleware(req: NextRequest) {
  // Let next-intl handle locale negotiation / rewrites first.
  const res = handleI18n(req);
  const { pathname } = req.nextUrl;

  let hasSession: boolean;
  if (SUPABASE_ON) {
    // Bind a Supabase client to the request/response so the auth token is
    // refreshed and the new cookies are persisted on the way out.
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
  } else {
    hasSession = Boolean(req.cookies.get(LEGACY_COOKIE)?.value);
  }

  // Gate localized app routes: unauthenticated users go to /login.
  if (LOCALIZED.test(pathname) && !PUBLIC.test(pathname) && !hasSession) {
    const locale = pathname.match(/^\/(pt-PT|en)/)?.[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  }

  // Authenticated users shouldn't sit on auth pages.
  if (PUBLIC.test(pathname) && hasSession) {
    const locale = pathname.match(/^\/(pt-PT|en)/)?.[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/", "/(pt-PT|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
