import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { ApiError, parseBody, route } from "@/lib/http";
import { signedUploadUrl, storageKeys } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/uploads";

const bodySchema = z.object({
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
  size: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Step 1 of an upload: validates the file's declared type and size, rejects
 * duplicates early, and returns a presigned URL so the browser can send the
 * original straight to a temporary R2 location (bypassing serverless body limits).
 */
export const POST = route(async (request: Request) => {
  const session = await requireApiSession();
  await enforceRateLimit(`upload-presign:${session.userId}`, 600, 3600);

  const body = await parseBody(request, bodySchema);
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (body.size > maxBytes) {
    throw new ApiError(413, `Photos can be up to ${env().UPLOAD_MAX_MB} MB.`, "too_large");
  }

  const { data: existing, error } = await session.supabase
    .from("memories")
    .select("id")
    .eq("couple_id", session.coupleId)
    .eq("content_hash", body.contentHash)
    .maybeSingle();
  if (error) throw error;
  if (existing) throw new ApiError(409, "This photo is already in your memories.", "duplicate");

  const uploadKey = storageKeys.upload(session.coupleId, randomUUID());
  const uploadUrl = await signedUploadUrl(uploadKey, body.contentType, body.size);
  return NextResponse.json({ uploadUrl, uploadKey });
});
