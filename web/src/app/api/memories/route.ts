import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { toGalleryItem } from "@/lib/data/memories";
import { env } from "@/lib/env";
import { ApiError, parseBody, route } from "@/lib/http";
import { processImage, UnsupportedImageError } from "@/lib/images";
import { todayIn, zonedTimeToUtc } from "@/lib/months";
import { deleteObjects, FileTooLargeError, getObjectBuffer, putObject, storageKeys } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/rate-limit";
import { daySchema, memoryDetailsSchema, timeSchema } from "@/lib/validation";

// Image processing of a large phone photo takes a few seconds.
export const maxDuration = 60;

const bodySchema = memoryDetailsSchema.extend({
  uploadKey: z.string().max(200),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  day: daySchema,
  time: timeSchema.nullish(),
});

const HEIC_MESSAGE =
  "This HEIC photo couldn't be read. On iPhone, set Settings → Camera → Formats → Most Compatible, or share the photo as JPEG.";

/**
 * Step 2 of an upload: fetches the temporary original from R2, verifies it,
 * produces the optimized variants, stores them, records the memory, and
 * removes the original.
 */
export const POST = route(async (request: Request) => {
  const session = await requireApiSession();
  await enforceRateLimit(`upload-process:${session.userId}`, 600, 3600);
  const body = await parseBody(request, bodySchema);
  const { APP_TIMEZONE, UPLOAD_MAX_MB } = env();

  // The temporary key must belong to this couple's upload area.
  const prefix = storageKeys.uploadPrefix(session.coupleId);
  const uploadId = body.uploadKey.slice(prefix.length);
  if (!body.uploadKey.startsWith(prefix) || !/^[0-9a-f-]{36}$/.test(uploadId)) {
    throw new ApiError(400, "Invalid upload.");
  }

  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
  if (body.day > todayIn(APP_TIMEZONE, tomorrow) || body.day < "1900-01-01") {
    throw new ApiError(400, "That date doesn't look right.");
  }

  const memoryId = randomUUID();
  const storedKeys: string[] = [];

  try {
    let original: Buffer;
    try {
      original = await getObjectBuffer(body.uploadKey, UPLOAD_MAX_MB * 1024 * 1024);
    } catch (err) {
      if (err instanceof FileTooLargeError) throw new ApiError(413, `Photos can be up to ${UPLOAD_MAX_MB} MB.`);
      throw new ApiError(400, "The upload didn't finish. Please try again.", "upload_missing");
    }

    if (createHash("sha256").update(original).digest("hex") !== body.contentHash) {
      throw new ApiError(400, "The upload was corrupted. Please try again.");
    }

    let variants;
    try {
      variants = await processImage(original);
    } catch (err) {
      if (err instanceof UnsupportedImageError) {
        throw new ApiError(
          415,
          err.reason === "heic" ? HEIC_MESSAGE : "This file isn't a supported photo (JPEG, PNG, WebP, AVIF or HEIC).",
          "unsupported",
        );
      }
      throw err;
    }

    await Promise.all(
      variants.map(async (v) => {
        const key = storageKeys.asset(session.coupleId, memoryId, v.variant, v.ext);
        await putObject(key, v.buffer, v.mimeType);
        storedKeys.push(key);
      }),
    );

    const display = variants.find((v) => v.variant === "display")!;
    const capturedAt = zonedTimeToUtc(body.day, body.time ?? "12:00:00", APP_TIMEZONE);

    const { error: memoryError } = await session.supabase.from("memories").insert({
      id: memoryId,
      couple_id: session.coupleId,
      uploaded_by: session.userId,
      captured_day: body.day,
      captured_at: capturedAt.toISOString(),
      caption: body.caption,
      location: body.location,
      tags: body.tags,
      is_favorite: body.isFavorite,
      content_hash: body.contentHash,
      width: display.width,
      height: display.height,
      status: "ready",
    });
    if (memoryError) {
      if (memoryError.code === "23505") {
        throw new ApiError(409, "This photo is already in your memories.", "duplicate");
      }
      throw memoryError;
    }

    const assets = variants.map((v) => ({
      memory_id: memoryId,
      couple_id: session.coupleId,
      variant: v.variant,
      storage_key: storageKeys.asset(session.coupleId, memoryId, v.variant, v.ext),
      width: v.width,
      height: v.height,
      file_size: v.buffer.byteLength,
      mime_type: v.mimeType,
    }));
    const { error: assetError } = await session.supabase.from("memory_assets").insert(assets);
    if (assetError) {
      await session.supabase.from("memories").delete().eq("id", memoryId);
      throw assetError;
    }

    const item = await toGalleryItem(
      {
        id: memoryId,
        captured_day: body.day,
        captured_at: capturedAt.toISOString(),
        caption: body.caption,
        location: body.location,
        tags: body.tags,
        is_favorite: body.isFavorite,
        width: display.width,
        height: display.height,
        memory_assets: assets.map((a) => ({ variant: a.variant, storage_key: a.storage_key })),
      },
      true,
    );
    storedKeys.length = 0; // Success — keep the stored variants.
    return NextResponse.json({ item, monthKey: body.day.slice(0, 7) }, { status: 201 });
  } finally {
    // Always remove the temporary original, and any variants from a failed attempt.
    await deleteObjects([body.uploadKey, ...storedKeys]).catch((err) =>
      console.error("[upload] cleanup failed", err),
    );
  }
});
