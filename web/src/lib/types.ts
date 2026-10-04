/** Shapes passed from the server to client components. No storage keys or secrets. */

export interface GalleryItem {
  id: string;
  day: string; // ISO date in app timezone
  capturedAt: string; // ISO instant
  caption: string | null;
  location: string | null;
  tags: string[];
  isFavorite: boolean;
  width: number;
  height: number;
  thumbUrl: string;
  displayUrl: string;
  hdUrl: string | null;
}

export interface GalleryPage {
  items: GalleryItem[];
  nextCursor: string | null;
}

export type RecapStatus = "not_generated" | "queued" | "processing" | "ready" | "failed";

export interface RecapInfo {
  status: RecapStatus;
  /** A previous video stays watchable while a regeneration runs. */
  videoUrl: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  photoCount: number | null;
  generatedAt: string | null;
  error: string | null;
}

export interface ShareInfo {
  url: string;
  allowDownloads: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface MonthStats {
  memoryCount: number;
  dayCount: number;
  firstDay: string | null;
  lastDay: string | null;
}

export interface MonthSummary extends MonthStats {
  monthKey: string;
  favoriteCount: number;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  recapStatus: RecapStatus;
  shareActive: boolean;
}
