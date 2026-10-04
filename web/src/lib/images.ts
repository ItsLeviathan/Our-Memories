import "server-only";
import sharp, { type Metadata, type Sharp } from "sharp";

/**
 * Turns an uploaded photo into the three stored variants. The original is not
 * kept: the HD variant (2560px, high-quality JPEG) is visually indistinguishable
 * for viewing and downloading, at a fraction of the size.
 *
 * All variants are auto-rotated from EXIF and stripped of metadata — which also
 * removes GPS coordinates embedded by phones.
 */

export type Variant = "thumb" | "display" | "hd";

export interface ProcessedVariant {
  variant: Variant;
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
  ext: string;
}

const SPECS: Record<Variant, { size: number; encode: (s: Sharp) => Sharp; mime: string; ext: string }> = {
  // Gallery tiles — sized for a 2x display tile.
  thumb: { size: 800, encode: (s) => s.webp({ quality: 80, smartSubsample: true }), mime: "image/webp", ext: "webp" },
  // Fullscreen viewing on phones / laptops.
  display: { size: 1600, encode: (s) => s.webp({ quality: 86, smartSubsample: true }), mime: "image/webp", ext: "webp" },
  // Large screens and downloads. JPEG for universal compatibility when saved.
  hd: {
    size: 2560,
    encode: (s) => s.jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }),
    mime: "image/jpeg",
    ext: "jpg",
  },
};

/** Formats sharp can decode in the standard build. */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]);

export class UnsupportedImageError extends Error {
  constructor(public readonly reason: "format" | "corrupt" | "heic") {
    super(`Unsupported image: ${reason}`);
  }
}

export async function processImage(input: Buffer): Promise<ProcessedVariant[]> {
  const base = sharp(input, { failOn: "error", limitInputPixels: 120_000_000, animated: false });

  let meta: Metadata;
  try {
    meta = await base.metadata();
  } catch {
    throw new UnsupportedImageError("corrupt");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UnsupportedImageError("format");
  }

  const oriented = base.clone().rotate().toColourspace("srgb");

  try {
    return await Promise.all(
      (Object.keys(SPECS) as Variant[]).map(async (variant) => {
        const spec = SPECS[variant];
        const pipeline = spec.encode(
          oriented.clone().resize({
            width: spec.size,
            height: spec.size,
            fit: "inside",
            withoutEnlargement: true,
            kernel: "lanczos3",
          }),
        );
        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
        return { variant, buffer: data, width: info.width, height: info.height, mimeType: spec.mime, ext: spec.ext };
      }),
    );
  } catch (err) {
    // HEVC-encoded HEIC (iPhone default) cannot be decoded by the prebuilt libvips.
    if (meta.format === "heif") throw new UnsupportedImageError("heic");
    throw err;
  }
}
