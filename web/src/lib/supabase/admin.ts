import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use only in trusted server code paths
 * that perform their own authorization (public share pages, cron, rate limits).
 */
export function createAdminClient() {
  const e = env();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
