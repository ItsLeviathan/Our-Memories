import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** First names of the two people in a space, in the order they joined. */
export async function getCoupleNames(client: SupabaseClient, coupleId: string): Promise<string[]> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => (p.display_name as string).trim().split(/\s+/)[0]).filter(Boolean);
}
