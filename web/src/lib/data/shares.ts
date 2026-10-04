import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptShareToken, hashShareToken, isPlausibleShareToken, shareUrl } from "@/lib/tokens";
import type { ShareInfo } from "@/lib/types";

export async function getActiveShare(
  client: SupabaseClient,
  coupleId: string,
  monthKey: string,
): Promise<ShareInfo | null> {
  const { data, error } = await client
    .from("share_links")
    .select("token_encrypted, allow_downloads, expires_at, created_at")
    .eq("couple_id", coupleId)
    .eq("month_key", monthKey)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  const token = decryptShareToken(data.token_encrypted);
  if (!token) return null;
  return {
    url: shareUrl(token),
    allowDownloads: data.allow_downloads,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export interface ResolvedShare {
  coupleId: string;
  monthKey: string;
  allowDownloads: boolean;
}

/**
 * Validates a public share token. The token is hashed and looked up with the
 * service role; revoked or expired links stop working immediately.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShare | null> {
  if (!isPlausibleShareToken(token)) return null;
  const { data, error } = await createAdminClient()
    .from("share_links")
    .select("couple_id, month_key, allow_downloads, active, expires_at, revoked_at")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (error) {
    console.error("[share] lookup failed", error.message);
    return null;
  }
  if (!data || !data.active || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  return { coupleId: data.couple_id, monthKey: data.month_key, allowDownloads: data.allow_downloads };
}
