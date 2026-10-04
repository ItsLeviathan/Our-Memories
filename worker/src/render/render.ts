import { stat } from "node:fs/promises";
import path from "node:path";
import type { RenderConfig } from "../config.js";
import { clipArgs, crossfadeArgs, probeDuration, runFfmpeg, type Clip } from "./ffmpeg.js";
import { formatDayLabel, formatMonthLabel, planRecap, type PlanPhoto } from "./plan.js";
import { composePhotoFrame, dateOverlay, endFrame, posterFrom, titleFrame } from "./slides.js";

export class NoPhotosError extends Error {
  constructor() {
    super("No photos in this month");
  }
}

export interface RenderResult {
  videoPath: string;
  posterPath: string;
  durationSeconds: number;
  photoCount: number;
  videoSize: number;
}

/** Max clips per crossfade pass; bigger recaps are assembled in chunks to bound memory. */
const CHUNK = 12;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}.`;

/**
 * Renders a month's recap:
 *   title card → photos (Ken Burns + crossfades, date on each new day) → closing card.
 * `fetchPhoto` downloads one photo to a local path.
 */
export async function renderRecap<T extends PlanPhoto>(opts: {
  monthKey: string;
  photos: T[];
  config: RenderConfig;
  workDir: string;
  fetchPhoto: (photo: T, destination: string) => Promise<void>;
  signal: AbortSignal;
  log: (message: string) => void;
}): Promise<RenderResult> {
  const { config, workDir, signal, log } = opts;
  if (opts.photos.length === 0) throw new NoPhotosError();

  const plan = planRecap(opts.photos, { maxPhotos: config.maxPhotos, showDates: config.showDates, formatDay: formatDayLabel });
  const month = formatMonthLabel(opts.monthKey);
  const file = (name: string) => path.join(workDir, name);
  const ffmpeg = (args: string[]) => runFfmpeg(config.ffmpegPath, args, signal);
  log(`planned ${plan.slides.length}/${opts.photos.length} photos, ~${plan.totalDuration}s`);

  // 1. Frames.
  await titleFrame(month, config.tagline, file("title.jpg"));
  await endFrame(
    month,
    [plural(plan.stats.memories, "memory", "memories"), plural(plan.stats.days, "day", "days")],
    config.closingLine,
    file("end.jpg"),
  );
  await mapLimit(plan.slides, config.concurrency, async (slide, i) => {
    signal.throwIfAborted();
    const source = file(`src-${i}`);
    await opts.fetchPhoto(slide.photo, source);
    await composePhotoFrame(source, file(`frame-${i}.jpg`));
    if (slide.dateLabel) await dateOverlay(slide.dateLabel, file(`overlay-${i}.png`));
  });
  log("frames ready");

  // 2. Clips.
  const clips: Clip[] = [
    { path: file("clip-title.mp4"), duration: plan.titleDuration },
    ...plan.slides.map((s, i) => ({ path: file(`clip-${i}.mp4`), duration: s.duration })),
    { path: file("clip-end.mp4"), duration: plan.endDuration },
  ];
  await ffmpeg(clipArgs({ frame: file("title.jpg"), motion: "zoom-in", duration: plan.titleDuration, output: clips[0].path }));
  await mapLimit(plan.slides, config.concurrency, async (slide, i) => {
    await ffmpeg(
      clipArgs({
        frame: file(`frame-${i}.jpg`),
        overlay: slide.dateLabel ? file(`overlay-${i}.png`) : null,
        motion: slide.motion,
        duration: slide.duration,
        output: clips[i + 1].path,
      }),
    );
  });
  await ffmpeg(clipArgs({ frame: file("end.jpg"), motion: "zoom-out", duration: plan.endDuration, output: clips.at(-1)!.path }));
  log(`${clips.length} clips encoded`);

  // 3. Crossfade everything together (hierarchically for long recaps).
  let level = clips;
  let pass = 0;
  while (level.length > CHUNK) {
    const chunks: Clip[][] = [];
    for (let i = 0; i < level.length; i += CHUNK) chunks.push(level.slice(i, i + CHUNK));
    level = await mapLimit(chunks, config.concurrency, async (chunk, c) => {
      if (chunk.length === 1) return chunk[0];
      const output = file(`chunk-${pass}-${c}.mp4`);
      const { args, duration } = crossfadeArgs(chunk, plan.transition, output, false);
      await ffmpeg(args);
      return { path: output, duration };
    });
    pass++;
  }
  const videoPath = file("recap.mp4");
  const final = crossfadeArgs(level, plan.transition, videoPath, true);
  await ffmpeg(final.args);

  const posterPath = file("poster.jpg");
  await posterFrom(file("frame-0.jpg"), posterPath);

  const measured = await probeDuration(config.ffmpegPath, videoPath);
  const { size } = await stat(videoPath);
  log(`rendered ${(size / 1e6).toFixed(1)} MB, ${measured ?? final.duration}s`);

  return {
    videoPath,
    posterPath,
    durationSeconds: Math.round((measured ?? final.duration) * 100) / 100,
    photoCount: plan.slides.length,
    videoSize: size,
  };
}
