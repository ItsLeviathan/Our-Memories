/**
 * Browser side of the upload pipeline:
 *   hash → request presigned URL → PUT original to R2 (with progress) →
 *   ask the server to process it into optimized variants.
 */
import { api, ClientApiError } from "@/lib/client-api";
import type { GalleryItem } from "@/lib/types";
import type { AcceptedImageType } from "@/lib/uploads";

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads the capture date/time from EXIF as wall-clock values ("2026-10-04", "18:32:11"). */
export async function readCaptureTime(file: File): Promise<{ day: string; time: string } | null> {
  try {
    const exifr = (await import("exifr")).default;
    const data = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    const date: unknown = data?.DateTimeOriginal ?? data?.CreateDate;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    // exifr builds the Date from the camera's wall clock in local time;
    // reading local fields returns exactly what the camera recorded.
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    };
  } catch {
    return null;
  }
}

function putWithProgress(url: string, file: File, contentType: string, onProgress: (f: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ClientApiError("The upload was interrupted. Please try again.", xhr.status));
    xhr.onerror = () => reject(new ClientApiError("The upload was interrupted. Please check your connection.", 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export interface UploadDetails {
  day: string;
  time: string | null;
  caption: string;
  location: string;
  tags: string[];
  isFavorite: boolean;
}

export type UploadPhase = "hashing" | "uploading" | "processing";

export async function uploadPhoto(
  file: File,
  contentType: AcceptedImageType,
  details: UploadDetails,
  hooks: { onPhase: (p: UploadPhase) => void; onProgress: (fraction: number) => void; signal: AbortSignal },
): Promise<{ item: GalleryItem; monthKey: string }> {
  hooks.onPhase("hashing");
  const contentHash = await sha256Hex(file);
  if (hooks.signal.aborted) throw new DOMException("Aborted", "AbortError");

  const { uploadUrl, uploadKey } = await api<{ uploadUrl: string; uploadKey: string }>("/api/uploads", {
    method: "POST",
    json: { contentType, size: file.size, contentHash },
    signal: hooks.signal,
  });

  hooks.onPhase("uploading");
  await putWithProgress(uploadUrl, file, contentType, hooks.onProgress, hooks.signal);

  hooks.onPhase("processing");
  return api("/api/memories", {
    method: "POST",
    json: { uploadKey, contentHash, ...details },
    signal: hooks.signal,
  });
}
