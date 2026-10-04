/**
 * Renders a recap from synthetic photos, without Supabase or R2 — a quick way
 * to check ffmpeg, fonts and the look of the video.
 *
 *   npm run render:sample            # 14 photos
 *   npm run render:sample -- 120     # a big month (exercises chunked assembly)
 *
 * Uses FFMPEG_PATH, or the ffmpeg-static binary from devDependencies.
 */
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { renderConfigFromEnv } from "../src/config.js";
import { renderRecap } from "../src/render/render.js";

const count = Number(process.argv[2] ?? 14);
const outDir = path.resolve("out");
const workDir = path.join(outDir, "work");
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

if (!process.env.FFMPEG_PATH) {
  const ffmpegStatic = (await import("ffmpeg-static")).default as unknown as string | null;
  if (ffmpegStatic) process.env.FFMPEG_PATH = ffmpegStatic;
}

const sizes = [
  [2560, 1920],
  [1920, 2560],
  [2560, 1440],
  [2048, 2048],
  [2560, 1707],
];
const palettes = [
  ["#d9a77c", "#3b2a24"],
  ["#8fb1c9", "#1f2a36"],
  ["#c9b48f", "#2f2a1f"],
  ["#b98fa6", "#2d1f2a"],
  ["#9fc4a3", "#1f2d22"],
];

const photos = await Promise.all(
  Array.from({ length: count }, async (_, i) => {
    const [w, h] = sizes[i % sizes.length];
    const [a, b] = palettes[i % palettes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w * 0.62}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.22}" fill="#fff" fill-opacity="0.18"/>
      <text x="50%" y="56%" text-anchor="middle" font-family="Inter, Arial" font-size="${Math.min(w, h) * 0.12}" fill="#fff" fill-opacity="0.85">#${i + 1}</text>
    </svg>`;
    const file = path.join(workDir, `source-${i}.jpg`);
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(file);
    const day = String(1 + Math.floor((i * 28) / count)).padStart(2, "0");
    return { id: String(i), day: `2026-10-${day}`, capturedAt: `2026-10-${day}T12:00:00Z`, isFavorite: i % 7 === 0, file };
  }),
);

const started = Date.now();
const result = await renderRecap({
  monthKey: "2026-10",
  photos,
  config: renderConfigFromEnv(),
  workDir,
  signal: new AbortController().signal,
  log: (m) => console.log(`[render] ${m}`),
  fetchPhoto: (photo, destination) => copyFile(photo.file, destination),
});

await copyFile(result.videoPath, path.join(outDir, "sample-recap.mp4"));
await copyFile(result.posterPath, path.join(outDir, "sample-poster.jpg"));
await copyFile(path.join(workDir, "title.jpg"), path.join(outDir, "sample-title.jpg"));
await copyFile(path.join(workDir, "end.jpg"), path.join(outDir, "sample-end.jpg"));
await rm(workDir, { recursive: true, force: true });
console.log(
  `Done in ${((Date.now() - started) / 1000).toFixed(1)}s → out/sample-recap.mp4 (${result.photoCount} photos, ${result.durationSeconds}s, ${(result.videoSize / 1e6).toFixed(1)} MB)`,
);
