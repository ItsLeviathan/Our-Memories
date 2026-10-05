"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { PhotoViewer } from "@/components/gallery/PhotoViewer";
import type { GalleryItem } from "@/lib/types";

/** Seconds each print spends crossing a row; keeps the pace steady whatever the count. */
const SECONDS_PER_PHOTO = 7;
/** Always a few rows so the month reads as a cute wall of prints, more for big months. */
const MIN_ROWS = 3;
const MAX_ROWS = 5;
const PHOTOS_PER_ROW = 8;
/** Up to this many photos, every row shows every photo (in a different order). */
const ALL_IN_EACH_ROW = 15;
/** Repeat short rows so each one is always wider than the screen. */
const MIN_PER_LOOP = 8;
/** Each row drifts at a slightly different pace so they never line up. */
const ROW_PACE = [1, 1.22, 0.88, 1.12, 0.95];

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Film = "mini" | "square" | "wide";

/** Instax film for the photo's shape: mini (portrait), square, or wide (landscape). */
function filmFor(item: GalleryItem): Film {
  const ratio = item.width / item.height;
  if (ratio < 0.9) return "mini";
  if (ratio <= 1.15) return "square";
  return "wide";
}

/** Small stable number from a photo's id, so its tilt and stickers never change. */
function seed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function looksFor(item: GalleryItem) {
  const s = seed(item.id);
  const tilt = ((s % 9) - 4) * 0.6; // -2.4deg … 2.4deg
  const lift = ((s >> 4) % 5) - 2; // -2 … 2 (× a few % of the print height)
  const deco = ["tape", "none", "heart", "tape", "none", "star"][(s >> 8) % 6];
  return { tilt, lift, deco };
}

/**
 * Splits the month into rows. Small months: every row holds every photo, each
 * starting from a different one so the same photo never stacks up in a column.
 * Big months: photos are dealt round-robin so each row spans the whole month.
 */
function toRows(items: GalleryItem[]) {
  const n = items.length;
  const count = Math.min(n, Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.ceil(n / PHOTOS_PER_ROW))));
  if (n <= ALL_IN_EACH_ROW) {
    return Array.from({ length: count }, (_, r) => {
      const start = Math.round((r * n) / count);
      return [...items.slice(start), ...items.slice(0, start)];
    });
  }
  const rows: GalleryItem[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => rows[i % count].push(item));
  return rows;
}

/**
 * The whole month as rows of Instax prints drifting right to left. Each row's
 * track holds its prints twice and slides by half its width, so the loop is
 * seamless. Hovering pauses everything; with reduced motion the rows become
 * strips you scroll by hand. Clicking a print opens it in the photo viewer.
 */
export function MonthShowcase({ items, canDownload }: { items: GalleryItem[]; canDownload: boolean }) {
  const rows = toRows(items);
  // When every row repeats the whole month, only the first row is announced to screen readers.
  const repeatsAll = items.length <= ALL_IN_EACH_ROW;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const open = (item: GalleryItem) => setViewerIndex(items.findIndex((i) => i.id === item.id));

  return (
    <>
      <div className="marquee" data-paused={viewerIndex !== null || undefined}>
        {rows.map((row, r) => {
          const loop = Array.from({ length: Math.ceil(MIN_PER_LOOP / row.length) }, () => row).flat();
          const duration = loop.length * SECONDS_PER_PHOTO * ROW_PACE[r % ROW_PACE.length];
          return (
            <div
              key={r}
              className="marquee-track"
              // Start each row at a different point in its loop so the rows look staggered.
              style={{ animationDuration: `${duration}s`, animationDelay: `-${(duration * r) / (rows.length + 1)}s` }}
            >
              {[0, 1].map((half) =>
                loop.map((item, i) => {
                  const original = (r === 0 || !repeatsAll) && half === 0 && i < row.length;
                  const film = filmFor(item);
                  const { tilt, lift, deco } = looksFor(item);
                  return (
                    <button
                      key={`${half}-${i}`}
                      type="button"
                      aria-hidden={!original}
                      tabIndex={original ? undefined : -1}
                      aria-label={original ? `View photo${item.caption ? `: ${item.caption}` : ""}` : undefined}
                      onClick={() => open(item)}
                      className="instax"
                      data-film={film}
                      data-deco={deco}
                      style={{ "--tilt": `${tilt}deg`, "--lift": lift } as React.CSSProperties}
                    >
                      {deco === "heart" || deco === "star" ? <Sticker kind={deco} /> : null}
                      <span className="instax-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
                        <img
                          src={item.thumbUrl}
                          alt={original ? (item.caption ?? "") : ""}
                          loading={i < MIN_PER_LOOP ? "eager" : "lazy"}
                          decoding="async"
                          draggable={false}
                        />
                      </span>
                      <Caption item={item} film={film} />
                    </button>
                  );
                }),
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && items[viewerIndex] ? (
          <PhotoViewer
            items={items}
            index={viewerIndex}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerIndex(null)}
            downloadUrl={(item) => (canDownload ? `/api/memories/${item.id}/download` : null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** A little puffy sticker stuck on the corner of a print. */
function Sticker({ kind }: { kind: "heart" | "star" }) {
  return (
    <span className="instax-sticker" data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">
        {kind === "heart" ? (
          <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
        ) : (
          <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" />
        )}
      </svg>
    </span>
  );
}

/** Roughly how much long-caption text fits in 7 lines on each film width. */
const CAPTION_FITS: Record<Film, number> = { mini: 110, square: 160, wide: 270 };

/**
 * The note written under the photo: its caption, or the date when there is none.
 * A caption too long for the print gets a "read more" hint; clicking the print
 * opens the viewer, which shows it in full.
 */
function Caption({ item, film }: { item: GalleryItem; film: Film }) {
  const text = item.caption?.trim() || dayFormat.format(new Date(`${item.day}T00:00:00Z`));
  const length = text.length <= 24 ? "short" : text.length <= 70 ? "medium" : "long";
  return (
    <span className="instax-caption" data-length={length}>
      <span>{text}</span>
      {text.length > CAPTION_FITS[film] ? <span className="instax-more">Tap to read more ♡</span> : null}
    </span>
  );
}
