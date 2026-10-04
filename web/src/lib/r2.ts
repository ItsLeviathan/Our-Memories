import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * Cloudflare R2 (S3-compatible). The bucket is private: the browser only ever
 * receives short-lived presigned URLs, never credentials.
 */

let client: S3Client | undefined;

function r2() {
  if (client) return client;
  const e = env();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
    // R2 rejects the SDK's default flexible-checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

const bucket = () => env().R2_BUCKET_NAME;

const VIEW_URL_TTL_SECONDS = 6 * 60 * 60;
const SIGNING_WINDOW_MS = 60 * 60 * 1000;

/**
 * Presigned GET for viewing. The signing time is rounded down to the hour, so
 * the same object yields the same URL for an hour — letting browsers and the
 * CDN cache images instead of re-downloading them on every page view.
 * Every URL stays valid for at least 5 hours.
 */
export async function signedViewUrl(key: string): Promise<string> {
  const signingDate = new Date(Math.floor(Date.now() / SIGNING_WINDOW_MS) * SIGNING_WINDOW_MS);
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseCacheControl: "private, max-age=3600, immutable",
    }),
    { expiresIn: VIEW_URL_TTL_SECONDS, signingDate },
  );
}

/** Short-lived presigned GET that forces a file download with a friendly name. */
export async function signedDownloadUrl(key: string, filename: string): Promise<string> {
  const safe = filename.replace(/[^\w.\- ]+/g, "").trim() || "memory";
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safe}"`,
    }),
    { expiresIn: 5 * 60 },
  );
}

/**
 * Presigned PUT for a direct browser → R2 upload. Content type and exact
 * length are part of the signature, so the client cannot upload anything else.
 */
export async function signedUploadUrl(key: string, contentType: string, contentLength: number) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 15 * 60 },
  );
}

export async function getObjectBuffer(key: string, maxBytes: number): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error("Object has no body");
  if (res.ContentLength && res.ContentLength > maxBytes) throw new FileTooLargeError();
  const bytes = await res.Body.transformToByteArray();
  if (bytes.byteLength > maxBytes) throw new FileTooLargeError();
  return Buffer.from(bytes);
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObjects(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 1000) {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super("File too large");
  }
}

/** Storage layout. Every key is namespaced by couple so ownership is checkable. */
export const storageKeys = {
  uploadPrefix: (coupleId: string) => `tmp/${coupleId}/`,
  upload: (coupleId: string, id: string) => `tmp/${coupleId}/${id}`,
  asset: (coupleId: string, memoryId: string, variant: string, ext: string) =>
    `media/${coupleId}/${memoryId}/${variant}.${ext}`,
};
