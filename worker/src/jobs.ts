import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.js";

export interface RecapJob {
  id: string;
  couple_id: string;
  month_key: string;
  attempts: number;
  max_attempts: number;
  video_storage_key: string | null;
  poster_storage_key: string | null;
}

export interface MonthPhoto {
  id: string;
  day: string;
  capturedAt: string;
  isFavorite: boolean;
  storageKey: string;
}

/** All database access of the worker. Uses the service role (trusted process). */
export class JobStore {
  private db: SupabaseClient;

  constructor(private config: Config) {
    this.db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Atomically claims the next queued job (also recovers stalled ones). */
  async claim(): Promise<RecapJob | null> {
    const { data, error } = await this.db.rpc("claim_recap_job", {
      p_worker_id: this.config.workerId,
      p_stale_seconds: this.config.staleAfterSeconds,
    });
    if (error) throw new Error(`claim failed: ${error.message}`);
    return ((data as RecapJob[] | null) ?? [])[0] ?? null;
  }

  async heartbeat(jobId: string) {
    await this.db
      .from("monthly_recaps")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("locked_by", this.config.workerId);
  }

  /** Every ready photo of the month, chronologically, with its best asset. */
  async monthPhotos(coupleId: string, monthKey: string): Promise<MonthPhoto[]> {
    const photos: MonthPhoto[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.db
        .from("memories")
        .select("id, captured_day, captured_at, is_favorite, memory_assets(variant, storage_key)")
        .eq("couple_id", coupleId)
        .eq("month_key", monthKey)
        .eq("status", "ready")
        .order("captured_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`memories query failed: ${error.message}`);
      for (const row of data ?? []) {
        const assets = row.memory_assets as { variant: string; storage_key: string }[];
        const asset = assets.find((a) => a.variant === "hd") ?? assets.find((a) => a.variant === "display");
        if (asset) {
          photos.push({
            id: row.id,
            day: row.captured_day,
            capturedAt: row.captured_at,
            isFavorite: row.is_favorite,
            storageKey: asset.storage_key,
          });
        }
      }
      if (!data || data.length < pageSize) break;
    }
    return photos;
  }

  /** Marks the job ready — only if this worker still owns it. Returns false if it lost ownership. */
  async complete(
    jobId: string,
    result: { videoKey: string; posterKey: string; durationSeconds: number; photoCount: number; videoSize: number },
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from("monthly_recaps")
      .update({
        status: "ready",
        video_storage_key: result.videoKey,
        poster_storage_key: result.posterKey,
        duration_seconds: result.durationSeconds,
        photo_count: result.photoCount,
        video_size: result.videoSize,
        generated_at: new Date().toISOString(),
        error_message: null,
        locked_by: null,
        next_attempt_at: null,
      })
      .eq("id", jobId)
      .eq("locked_by", this.config.workerId)
      .eq("status", "processing")
      .select("id");
    if (error) throw new Error(`complete failed: ${error.message}`);
    return (data ?? []).length > 0;
  }

  /**
   * Records a failure. Retries with backoff until max_attempts, then marks the
   * recap failed with a user-safe message.
   */
  async fail(job: RecapJob, userMessage: string, retryable: boolean) {
    const exhausted = !retryable || job.attempts >= job.max_attempts;
    const backoffMs = Math.min(2 ** job.attempts * 60_000, 30 * 60_000);
    await this.db
      .from("monthly_recaps")
      .update(
        exhausted
          ? { status: "failed", error_message: userMessage, locked_by: null, next_attempt_at: null }
          : { status: "queued", locked_by: null, next_attempt_at: new Date(Date.now() + backoffMs).toISOString() },
      )
      .eq("id", job.id)
      .eq("locked_by", this.config.workerId);
  }

  /** Hands a job back untouched (used on shutdown) without consuming an attempt. */
  async release(job: RecapJob) {
    await this.db
      .from("monthly_recaps")
      .update({ status: "queued", locked_by: null, attempts: Math.max(0, job.attempts - 1) })
      .eq("id", job.id)
      .eq("locked_by", this.config.workerId);
  }
}
