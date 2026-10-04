/**
 * Decides what goes into a recap and how long everything lasts. Pure and
 * deterministic, so it can be unit-tested without ffmpeg.
 */

export interface PlanPhoto {
  id: string;
  day: string;
  capturedAt: string;
  isFavorite: boolean;
}

export type Motion = "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "drift-up";

export interface PlannedSlide<T extends PlanPhoto> {
  photo: T;
  duration: number;
  motion: Motion;
  /** Show the date overlay (only on the first photo of each day). */
  dateLabel: string | null;
}

export interface RecapPlan<T extends PlanPhoto> {
  slides: PlannedSlide<T>[];
  titleDuration: number;
  endDuration: number;
  transition: number;
  totalDuration: number;
  stats: { memories: number; days: number };
}

/**
 * Chooses at most `max` photos while keeping the month's story: every day is
 * represented when possible, favorites are preferred, the rest are spread
 * evenly across the timeline. Result is chronological.
 */
export function selectPhotos<T extends PlanPhoto>(photos: T[], max: number): T[] {
  if (photos.length <= max) return photos;
  const chosen = new Set<number>();

  // 1. One photo per day (favorite if there is one), spreading days evenly if
  //    there are more days than slots.
  const byDay = new Map<string, number[]>();
  photos.forEach((p, i) => byDay.set(p.day, [...(byDay.get(p.day) ?? []), i]));
  const days = [...byDay.values()];
  const dayPicks = days.length <= max ? days : evenly(days, max);
  for (const indices of dayPicks) {
    chosen.add(indices.find((i) => photos[i].isFavorite) ?? indices[Math.floor(indices.length / 2)]);
  }

  // 2. Remaining favorites.
  for (let i = 0; i < photos.length && chosen.size < max; i++) {
    if (photos[i].isFavorite) chosen.add(i);
  }

  // 3. Fill evenly across the whole month.
  const rest = photos.map((_, i) => i).filter((i) => !chosen.has(i));
  for (const i of evenly(rest, max - chosen.size)) chosen.add(i);

  return [...chosen].sort((a, b) => a - b).map((i) => photos[i]);
}

function evenly<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= items.length) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, k) => items[Math.floor(k * step + step / 2)]);
}

/** Fewer photos linger longer; big months move a little faster. */
export function photoDuration(count: number): number {
  if (count <= 8) return 4.2;
  if (count <= 20) return 3.6;
  if (count <= 45) return 3.1;
  return 2.7;
}

const MOTIONS: Motion[] = ["zoom-in", "pan-right", "zoom-out", "pan-left", "zoom-in", "drift-up"];

export function planRecap<T extends PlanPhoto>(
  photos: T[],
  opts: { maxPhotos: number; showDates: boolean; formatDay: (day: string) => string },
): RecapPlan<T> {
  if (photos.length === 0) throw new Error("No photos to plan");
  const selected = selectPhotos(photos, opts.maxPhotos);
  const duration = photoDuration(selected.length);
  const transition = 0.9;
  const titleDuration = 4.2;
  const endDuration = 5.5;

  let previousDay: string | null = null;
  const slides = selected.map((photo, i) => {
    const dateLabel = opts.showDates && photo.day !== previousDay ? opts.formatDay(photo.day) : null;
    previousDay = photo.day;
    return { photo, duration, motion: MOTIONS[i % MOTIONS.length], dateLabel };
  });

  const clipCount = slides.length + 2;
  const totalDuration = titleDuration + endDuration + slides.length * duration - (clipCount - 1) * transition;

  return {
    slides,
    titleDuration,
    endDuration,
    transition,
    totalDuration: Math.round(totalDuration * 100) / 100,
    stats: { memories: photos.length, days: new Set(photos.map((p) => p.day)).size },
  };
}

/** "Sunday, October 4" for an ISO date, with no timezone drift. */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}
