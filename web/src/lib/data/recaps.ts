import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedViewUrl } from "@/lib/r2";
import type { RecapInfo } from "@/lib/types";

export interface RecapRow {
  status: RecapInfo["status"];
  video_storage_key: string | null;
  poster_storage_key: string | null;
  duration_seconds: number | string | null;
  photo_count: number | null;
  generated_at: string | null;
  error_message: string | null;
}

export const RECAP_COLUMNS =
  "status, video_storage_key, poster_storage_key, duration_seconds, photo_count, generated_at, error_message";

export async function getRecapRow(client: SupabaseClient, coupleId: string, monthKey: string) {
  const { data, error } = await client
    .from("monthly_recaps")
    .select(RECAP_COLUMNS)
    .eq("couple_id", coupleId)
    .eq("month_key", monthKey)
    .maybeSingle();
  if (error) throw error;
  return data as RecapRow | null;
}

export async function toRecapInfo(row: RecapRow | null): Promise<RecapInfo> {
  if (!row) {
    return {
      status: "not_generated",
      videoUrl: null,
      posterUrl: null,
      durationSeconds: null,
      photoCount: null,
      generatedAt: null,
      error: null,
    };
  }
  const [videoUrl, posterUrl] = await Promise.all([
    row.video_storage_key ? signedViewUrl(row.video_storage_key) : null,
    row.poster_storage_key ? signedViewUrl(row.poster_storage_key) : null,
  ]);
  return {
    status: row.status,
    videoUrl,
    posterUrl,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    photoCount: row.photo_count,
    generatedAt: row.generated_at,
    error: row.status === "failed" ? (row.error_message ?? "Something went wrong while generating.") : null,
  };
}

export async function getRecap(client: SupabaseClient, coupleId: string, monthKey: string) {
  return toRecapInfo(await getRecapRow(client, coupleId, monthKey));
}
