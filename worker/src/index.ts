import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { loadConfig } from "./config.js";
import { JobStore, type RecapJob } from "./jobs.js";
import { NoPhotosError, renderRecap } from "./render/render.js";
import { FfmpegError } from "./render/ffmpeg.js";
import { Storage } from "./storage.js";

/**
 * Recap worker — a long-running process, deployed separately from the web app
 * (video encoding doesn't fit in short-lived serverless functions).
 *
 * Loop: claim a queued job (atomic, SKIP LOCKED) → render → upload → mark ready.
 * Processes one job at a time; heartbeats so stalled jobs are recovered;
 * enforces a hard timeout; retries with backoff up to the job's attempt limit.
 */

const config = loadConfig();
const jobs = new JobStore(config);
const storage = new Storage(config.r2);

let stopping = false;
let current: { job: RecapJob; controller: AbortController } | null = null;
let lastPollAt = Date.now();

const log = (message: string, extra?: unknown) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), worker: config.workerId, message, ...(extra ? { extra } : {}) }));

class ShutdownError extends Error {}
class TimeoutError extends Error {}

function userMessage(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof NoPhotosError) return { message: "There are no photos in this month yet.", retryable: false };
  if (err instanceof TimeoutError) return { message: "Making the video took too long. Please try again.", retryable: true };
  if (err instanceof FfmpegError) return { message: "We couldn't create the video this time. Please try again.", retryable: true };
  return { message: "Something went wrong while making your recap. Please try again.", retryable: true };
}

async function processJob(job: RecapJob) {
  const controller = new AbortController();
  current = { job, controller };
  const timeout = setTimeout(() => controller.abort(new TimeoutError("job timeout")), config.jobTimeoutMs);
  const heartbeat = setInterval(() => jobs.heartbeat(job.id).catch(() => {}), 30_000);
  const workDir = await mkdtemp(path.join(os.tmpdir(), `recap-${job.month_key}-`));
  const jobLog = (message: string) => log(message, { job: job.id, month: job.month_key, attempt: job.attempts });
  let uploadedKeys: string[] = [];

  try {
    jobLog("started");
    const photos = await jobs.monthPhotos(job.couple_id, job.month_key);
    const result = await renderRecap({
      monthKey: job.month_key,
      photos,
      config: config.render,
      workDir,
      signal: controller.signal,
      log: jobLog,
      fetchPhoto: (photo, destination) => storage.download(photo.storageKey, destination, controller.signal),
    });

    // New objects get unique keys so the previous recap stays watchable until this one is live.
    const base = `recaps/${job.couple_id}/${job.month_key}/${randomUUID()}`;
    const videoKey = `${base}.mp4`;
    const posterKey = `${base}.jpg`;
    await storage.uploadFile(videoKey, result.videoPath, "video/mp4");
    await storage.uploadFile(posterKey, result.posterPath, "image/jpeg");
    uploadedKeys = [videoKey, posterKey];

    const owned = await jobs.complete(job.id, {
      videoKey,
      posterKey,
      durationSeconds: result.durationSeconds,
      photoCount: result.photoCount,
      videoSize: result.videoSize,
    });
    if (!owned) {
      jobLog("lost ownership of job; discarding output");
      await storage.delete(uploadedKeys);
      return;
    }
    uploadedKeys = [];
    // Replace: remove the previous recap's files.
    await storage.delete([job.video_storage_key, job.poster_storage_key].filter((k) => k && k !== videoKey));
    jobLog("ready");
  } catch (err) {
    if (uploadedKeys.length) await storage.delete(uploadedKeys).catch(() => {});
    if (controller.signal.reason instanceof ShutdownError) {
      jobLog("released on shutdown");
      await jobs.release(job).catch(() => {});
      return;
    }
    const failure = userMessage(controller.signal.reason instanceof TimeoutError ? controller.signal.reason : err);
    log("job failed", { job: job.id, error: err instanceof Error ? err.message : String(err), retryable: failure.retryable });
    await jobs.fail(job, failure.message, failure.retryable).catch((e) => log("could not record failure", { error: String(e) }));
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    current = null;
  }
}

async function loop() {
  log(config.runOnce ? "worker started (run-once mode)" : "worker started");
  while (!stopping) {
    lastPollAt = Date.now();
    let job: RecapJob | null = null;
    try {
      job = await jobs.claim();
    } catch (err) {
      log("claim error", { error: String(err) });
      if (config.runOnce) process.exitCode = 1;
    }
    if (job) await processJob(job);
    else if (config.runOnce) break; // queue drained — exit (e.g. GitHub Actions)
    else await sleep(config.pollIntervalMs);
  }
  log("worker stopped");
}

// Health endpoint for always-on hosting platforms (not needed in run-once mode).
const server = config.runOnce
  ? null
  : http.createServer((req, res) => {
      const healthy = Date.now() - lastPollAt < Math.max(config.pollIntervalMs * 6, config.jobTimeoutMs + 60_000);
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: healthy, busy: Boolean(current), month: current?.job.month_key ?? null }));
    });
server?.listen(config.port);

function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log(`received ${signal}, shutting down`);
  current?.controller.abort(new ShutdownError("shutdown"));
  server?.close();
  setTimeout(() => process.exit(0), 15_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

loop().then(() => process.exit());
