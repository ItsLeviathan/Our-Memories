import os from "node:os";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`);
  return n;
}

export function loadConfig() {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    r2: {
      accountId: required("R2_ACCOUNT_ID"),
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      bucket: required("R2_BUCKET_NAME"),
    },
    workerId: process.env.WORKER_ID ?? `${os.hostname()}-${process.pid}`,
    pollIntervalMs: number("POLL_INTERVAL_MS", 10_000),
    /** A job with no heartbeat for this long is considered stalled and is retried. */
    staleAfterSeconds: number("STALE_AFTER_SECONDS", 900),
    /** Hard cap on a single render; ffmpeg is killed beyond this. */
    jobTimeoutMs: number("JOB_TIMEOUT_MS", 30 * 60_000),
    port: number("PORT", 8080),
    /** Process queued jobs until none are left, then exit (for GitHub Actions / cron-style hosting). */
    runOnce: process.env.RUN_ONCE === "true",
    render: renderConfigFromEnv(),
  };
}

export function renderConfigFromEnv() {
  return {
    ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
    maxPhotos: number("RECAP_MAX_PHOTOS", 80),
    concurrency: number("RENDER_CONCURRENCY", 2),
    showDates: (process.env.RECAP_SHOW_DATES ?? "true") !== "false",
    tagline: process.env.RECAP_TAGLINE ?? "A month of us.",
    closingLine: process.env.RECAP_CLOSING_LINE ?? "A month worth remembering.",
  };
}

export type Config = ReturnType<typeof loadConfig>;
export type RenderConfig = Config["render"];
