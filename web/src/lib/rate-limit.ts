import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http";

/**
 * Fixed-window rate limit backed by Postgres (works across serverless
 * instances, unlike in-memory counters). Fails open on infrastructure errors so
 * a database hiccup never locks the two of you out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return true;
  }
  return data === true;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!(await rateLimit(key, limit, windowSeconds))) {
    throw new ApiError(429, "You're going a little fast. Please wait a moment and try again.", "rate_limited");
  }
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
