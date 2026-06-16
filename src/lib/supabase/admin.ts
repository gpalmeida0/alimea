import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so it is ONLY used for trusted
 * cross-tenant server jobs that have no user session — namely the daily
 * reminder cron, which must read appointments across every nutritionist.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not set, so the rest of the
 * app keeps working (the cron simply finds nothing to do).
 */
let cached: SupabaseClient | null | undefined;

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return cached;
}
