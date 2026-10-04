import { spawn } from "node:child_process";
import type { Motion } from "./plan.js";
import { OUT_H, OUT_W } from "./slides.js";

export const FPS = 30;

export class FfmpegError extends Error {}

/** Runs ffmpeg; killed immediately if the signal aborts. Keeps the stderr tail for diagnostics. */
export function runFfmpeg(ffmpegPath: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const child = spawn(ffmpegPath, ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    const onAbort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(new FfmpegError(`ffmpeg could not start (${err.message}). Is FFMPEG_PATH correct?`));
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) reject(signal.reason ?? new Error("aborted"));
      else if (code === 0) resolve(stderr);
      else reject(new FfmpegError(`ffmpeg exited with ${code}: ${stderr.trim().split("\n").slice(-6).join(" | ")}`));
    });
  });
}

/** Zoom/pan expressions for ffmpeg's zoompan filter (restrained: ≤ 8% zoom). */
function motionExpr(motion: Motion, frames: number) {
  const t = `(on/${Math.max(frames - 1, 1)})`;
  const cx = "(iw-iw/zoom)/2";
  const cy = "(ih-ih/zoom)/2";
  switch (motion) {
    case "zoom-in":
      return { z: `1+0.08*${t}`, x: cx, y: cy };
    case "zoom-out":
      return { z: `1.08-0.08*${t}`, x: cx, y: cy };
    case "pan-right":
      return { z: "1.07", x: `(iw-iw/zoom)*(0.2+0.6*${t})`, y: cy };
    case "pan-left":
      return { z: "1.07", x: `(iw-iw/zoom)*(0.8-0.6*${t})`, y: cy };
    case "drift-up":
      return { z: "1.06", x: cx, y: `(ih-ih/zoom)*(0.75-0.5*${t})` };
  }
}

const INTERMEDIATE = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS)];
const FINAL = [
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-r", String(FPS), "-movflags", "+faststart",
];

/** One still frame → a moving clip, optionally with a static overlay on top. */
export function clipArgs(opts: { frame: string; overlay?: string | null; motion: Motion; duration: number; output: string }) {
  const frames = Math.round(opts.duration * FPS);
  const { z, x, y } = motionExpr(opts.motion, frames);
  const zoom = `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${OUT_W}x${OUT_H}:fps=${FPS},setsar=1`;
  const filter = opts.overlay
    ? `[0:v]${zoom}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`
    : `[0:v]${zoom},format=yuv420p[v]`;
  return [
    "-y", "-loglevel", "error",
    "-i", opts.frame,
    ...(opts.overlay ? ["-loop", "1", "-i", opts.overlay] : []),
    "-filter_complex", filter,
    "-map", "[v]", "-frames:v", String(frames),
    ...INTERMEDIATE,
    opts.output,
  ];
}

export interface Clip {
  path: string;
  duration: number;
}

/** Chains clips with crossfades. `final` adds fade from/to black and final encoding settings. */
export function crossfadeArgs(clips: Clip[], transition: number, output: string, final: boolean) {
  const inputs = clips.flatMap((c) => ["-i", c.path]);
  const parts: string[] = [];
  let label = "[0:v]";
  let elapsed = clips[0].duration;
  for (let i = 1; i < clips.length; i++) {
    const out = `[x${i}]`;
    const offset = (elapsed - transition).toFixed(3);
    parts.push(`${label}[${i}:v]xfade=transition=fade:duration=${transition}:offset=${offset}${out}`);
    label = out;
    elapsed += clips[i].duration - transition;
  }
  const total = elapsed;
  const tail = final ? `fade=t=in:st=0:d=1,fade=t=out:st=${(total - 1.4).toFixed(3)}:d=1.4,format=yuv420p` : "format=yuv420p";
  parts.push(`${label}${tail}[out]`);

  return {
    duration: total,
    args: ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", ...(final ? FINAL : INTERMEDIATE), output],
  };
}

/** Reads a media file's duration (seconds) from ffmpeg's banner. */
export async function probeDuration(ffmpegPath: string, path: string): Promise<number | null> {
  const stderr: string = await new Promise((resolve) => {
    const child = spawn(ffmpegPath, ["-hide_banner", "-i", path], { stdio: ["ignore", "ignore", "pipe"] });
    let out = "";
    child.stderr.on("data", (c: Buffer) => (out += c.toString()));
    child.on("close", () => resolve(out));
    child.on("error", () => resolve(""));
  });
  const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
