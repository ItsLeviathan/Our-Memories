"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { PhotoViewer } from "@/components/gallery/PhotoViewer";
import type { GalleryItem } from "@/lib/types";

/** Drift speed: seconds to travel one print height. Width-based, so pace is steady. */
const SECONDS_PER_HEIGHT = 6;
const MAX_ROWS = 5;
/** Rows are added as the month fills up, about one per this many photos. */
const PHOTOS_PER_ROW = 3;
/** Rows shorter than this get two fillers per photo so the photos repeat less. */
const SHORT_ROW = 5;
/**
 * A row's loop must be at least this wide (in print heights) to cover a wide
 * screen; short rows repeat only as often as needed to reach it.
 */
const MIN_LOOP_WIDTH = 15;
/** Each row drifts at a slightly different pace so they never line up. */
const ROW_PACE = [1, 1.22, 0.88, 1.12, 0.95];

/** Sweet words on the little sticky notes tucked between prints. */
const NOTES = ["us ♡", "my fave", "hehe", "forever", "more of this", "my person", "love u", "always", "ours", "best day"];

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Film = "mini" | "square" | "wide";

/** Instax film for the photo's shape: mini (portrait), square, or wide (landscape). */
function filmFor(item: GalleryItem): Film {
  const ratio = item.width / item.height;
  if (ratio < 0.9) return "mini";
  if (ratio <= 1.15) return "square";
  return "wide";
}

/** Small stable number from an id, so a print's tilt and stickers never change. */
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
 * Rows grow with the month (1 row for a couple of photos, 2 from 3 photos, 3 from
 * 9, up to 5), so each row has enough different photos not to look repetitive.
 */
function rowCount(n: number) {
  if (n <= 2) return 1;
  return Math.min(MAX_ROWS, Math.max(2, Math.floor(n / PHOTOS_PER_ROW)));
}

/** Deals the photos round-robin into rows: every photo appears in exactly one row. */
function toRows(items: GalleryItem[]) {
  const rows: GalleryItem[][] = Array.from({ length: rowCount(items.length) }, () => []);
  items.forEach((item, i) => rows[i % rows.length].push(item));
  return rows;
}

/** Approximate on-screen widths, in print heights (window + borders + gap). */
const FILM_WIDTH: Record<Film, number> = { mini: 0.742, square: 1, wide: 1.597 };
const PRINT_EXTRA = 0.34;
const NOTE_WIDTH = 0.95;
const DOODLE_WIDTH = 0.7;

type Slot =
  | { kind: "photo"; item: GalleryItem }
  | { kind: "note"; text: string; key: string }
  | { kind: "doodle"; shape: "heart" | "sparkle"; key: string };

/**
 * A row's photos, each followed by a little note and/or doodle so the photos
 * need fewer repeats to fill the screen. Returns how often the row must repeat.
 */
function rowSlots(row: GalleryItem[]) {
  const slots: Slot[] = [];
  let width = 0;
  const both = row.length < SHORT_ROW;
  for (const item of row) {
    slots.push({ kind: "photo", item });
    width += FILM_WIDTH[filmFor(item)] + PRINT_EXTRA;
    const s = seed(item.id);
    const doodle = s % 3 === 0;
    if (both || !doodle) {
      slots.push({ kind: "note", text: NOTES[(s >> 3) % NOTES.length], key: `n-${item.id}` });
      width += NOTE_WIDTH;
    }
    if (both || doodle) {
      slots.push({ kind: "doodle", shape: s % 2 ? "heart" : "sparkle", key: `d-${item.id}` });
      width += DOODLE_WIDTH;
    }
  }
  const repeats = Math.max(1, Math.ceil(MIN_LOOP_WIDTH / width));
  return { slots, repeats, loopWidth: width * repeats };
}

/**
 * The whole month as rows of Instax prints drifting right to left, with little
 * notes and doodles between them. Each photo lives in one row. Each row's track
 * holds its loop twice and slides by half its width, so the wrap is seamless.
 * Hovering pauses everything; with reduced motion the rows become strips you
 * scroll by hand. Clicking a print opens it in the photo viewer.
 */
export function MonthShowcase({ items, canDownload }: { items: GalleryItem[]; canDownload: boolean }) {
  const rows = toRows(items);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const open = (item: GalleryItem) => setViewerIndex(items.findIndex((i) => i.id === item.id));

  return (
    <>
      <div className="marquee" data-paused={viewerIndex !== null || undefined}>
        {rows.map((row, r) => {
          const { slots, repeats, loopWidth } = rowSlots(row);
          const duration = loopWidth * SECONDS_PER_HEIGHT * ROW_PACE[r % ROW_PACE.length];
          return (
            <div
              key={r}
              className="marquee-track"
              // Start each row at a different point in its loop so the rows look staggered.
              style={{ animationDuration: `${duration}s`, animationDelay: `-${(duration * r) / (rows.length + 1)}s` }}
            >
              {Array.from({ length: repeats * 2 }, (_, copy) =>
                slots.map((slot) => {
                  if (slot.kind === "note") {
                    return (
                      <span
                        key={`${copy}-${slot.key}`}
                        className="marquee-note"
                        aria-hidden="true"
                        style={{ "--tilt": `${(seed(slot.key) % 7) - 3}deg` } as React.CSSProperties}
                      >
                        {slot.text}
                      </span>
                    );
                  }
                  if (slot.kind === "doodle") return <Doodle key={`${copy}-${slot.key}`} shape={slot.shape} />;

                  const { item } = slot;
                  const original = copy === 0;
                  const film = filmFor(item);
                  const { tilt, lift, deco } = looksFor(item);
                  return (
                    <button
                      key={`${copy}-${item.id}`}
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
                          loading={copy < 2 ? "eager" : "lazy"}
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

/** A hand-drawn doodle floating between prints. */
function Doodle({ shape }: { shape: "heart" | "sparkle" }) {
  return (
    <span className="marquee-doodle" data-shape={shape} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {shape === "heart" ? (
          <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
        ) : (
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5" />
        )}
      </svg>
    </span>
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
