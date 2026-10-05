import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedViewUrl } from "@/lib/r2";
import type { MonthSummary, RecapStatus } from "@/lib/types";

interface SummaryRow {
  month_key: string;
  memory_count: number;
  day_count: number;
  favorite_count: number;
  first_day: string | null;
  last_day: string | null;
  cover_thumb_key: string | null;
  cover_width: number | null;
  cover_height: number | null;
  recap_status: RecapStatus;
  share_active?: boolean;
}

/** All months that contain memories, newest first (RLS-scoped to the user). */
export async function getMonthSummaries(client: SupabaseClient): Promise<MonthSummary[]> {
  const { data, error } = await client.rpc("get_month_summaries");
  if (error) throw error;
  return toSummaries(data);
}

/** One space's months, for guests (admin client; share state is never exposed). */
export async function getCoupleMonthSummaries(admin: SupabaseClient, coupleId: string): Promise<MonthSummary[]> {
  const { data, error } = await admin.rpc("get_couple_month_summaries", { p_couple_id: coupleId });
  if (error) throw error;
  return toSummaries(data);
}

function toSummaries(data: unknown): Promise<MonthSummary[]> {
  return Promise.all(
    ((data ?? []) as SummaryRow[]).map(async (r) => ({
      monthKey: r.month_key,
      memoryCount: Number(r.memory_count),
      dayCount: Number(r.day_count),
      favoriteCount: Number(r.favorite_count),
      firstDay: r.first_day,
      lastDay: r.last_day,
      coverUrl: r.cover_thumb_key ? await signedViewUrl(r.cover_thumb_key) : null,
      coverWidth: r.cover_width,
      coverHeight: r.cover_height,
      recapStatus: r.recap_status,
      shareActive: r.share_active ?? false,
    })),
  );
}
