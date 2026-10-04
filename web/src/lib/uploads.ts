/** Upload rules shared by the client (early feedback) and the server (enforcement). */

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

const EXTENSION_TYPES: Record<string, AcceptedImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
};

/** Some platforms report an empty MIME type for HEIC — fall back to the extension. */
export function resolveImageType(file: { type: string; name: string }): AcceptedImageType | null {
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return file.type as AcceptedImageType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

export const DEFAULT_UPLOAD_MAX_MB = 40;
export const MAX_CAPTION_LENGTH = 2000;
export const MAX_LOCATION_LENGTH = 200;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
