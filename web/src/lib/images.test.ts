import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage, UnsupportedImageError } from "./images";

async function photo(width: number, height: number, opts: { orientation?: number; format?: "jpeg" | "png" } = {}) {
  const img = sharp({ create: { width, height, channels: 3, background: { r: 180, g: 120, b: 90 } } });
  if (opts.format === "png") return img.png().toBuffer();
  return img
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: opts.orientation, exif: { IFD0: { Make: "TestPhone", Copyright: "secret" } } })
    .toBuffer();
}

describe("processImage", () => {
  it("produces thumb, display and HD variants with bounded sizes", async () => {
    const variants = await processImage(await photo(4032, 3024));
    const byName = Object.fromEntries(variants.map((v) => [v.variant, v]));
    expect(byName.thumb).toMatchObject({ width: 800, height: 600, mimeType: "image/webp" });
    expect(byName.display).toMatchObject({ width: 1600, height: 1200, mimeType: "image/webp" });
    expect(byName.hd).toMatchObject({ width: 2560, height: 1920, mimeType: "image/jpeg", ext: "jpg" });
    expect((await sharp(byName.hd.buffer).metadata()).format).toBe("jpeg");
  });

  it("applies EXIF rotation so portrait photos stay portrait", async () => {
    // Stored landscape, orientation 6 = rotate 90° clockwise on display.
    const variants = await processImage(await photo(4000, 3000, { orientation: 6 }));
    const hd = variants.find((v) => v.variant === "hd")!;
    expect(hd.width).toBe(1920);
    expect(hd.height).toBe(2560);
  });

  it("strips metadata (EXIF, GPS) from stored files", async () => {
    const variants = await processImage(await photo(1200, 800));
    for (const v of variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });

  it("never upscales small photos", async () => {
    const variants = await processImage(await photo(640, 480, { format: "png" }));
    for (const v of variants) expect([v.width, v.height]).toEqual([640, 480]);
  });

  it("rejects files that are not images", async () => {
    await expect(processImage(Buffer.from("definitely not a photo"))).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
