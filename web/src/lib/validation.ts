import { z } from "zod";
import { isIsoDay, isMonthKey, isWallTime } from "@/lib/months";
import { MAX_CAPTION_LENGTH, MAX_LOCATION_LENGTH, MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/uploads";

const trimmedOrNull = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

export const daySchema = z.string().refine(isIsoDay, "Invalid date");
export const timeSchema = z.string().refine(isWallTime, "Invalid time");
export const monthKeySchema = z.string().refine(isMonthKey, "Invalid month");

export const tagsSchema = z
  .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
  .max(MAX_TAGS)
  .default([])
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]);

/** Editable memory details, shared by upload and edit. */
export const memoryDetailsSchema = z.object({
  caption: trimmedOrNull(MAX_CAPTION_LENGTH),
  location: trimmedOrNull(MAX_LOCATION_LENGTH),
  tags: tagsSchema,
  isFavorite: z.boolean().default(false),
});

export function parseMonthParam(value: string): string | null {
  return isMonthKey(value) ? value : null;
}
