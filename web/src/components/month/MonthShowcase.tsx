import Link from "next/link";
import type { GalleryItem } from "@/lib/types";

/** Seconds each photo spends crossing a row; keeps the pace steady whatever the count. */
const SECONDS_PER_PHOTO = 7;
/** Roughly how many photos share a row before another row is added. */
const PHOTOS_PER_ROW = 8;
const MAX_ROWS = 5;
/** Repeat short rows so each one is always wider than the screen. */
const MIN_PER_LOOP = 8;
/** Each row drifts at a slightly different pace so they never line up. */
const ROW_PACE = [1, 1.18, 0.9, 1.1, 0.96];

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Instax film for the photo's shape: mini (portrait), square, or wide (landscape). */
function filmFor(item: GalleryItem) {
  const ratio = item.width / item.height;
  if (ratio < 0.9) return "mini";
  if (ratio <= 1.15) return "square";
  return "wide";
}

/** Deals the photos round-robin into rows, so every row spans the whole month. */
function toRows(items: GalleryItem[]) {
  const count = Math.min(MAX_ROWS, Math.max(1, Math.ceil(items.length / PHOTOS_PER_ROW)));
  const rows: GalleryItem[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => rows[i % count].push(item));
  return rows;
}

/**
 * The whole month as rows of Instax prints drifting right to left. More photos
 * means more rows. Each row's track holds its prints twice and slides by half its
 * width, so the loop is seamless. Hovering pauses everything; with reduced motion
 * the rows become strips you scroll by hand.
 */
export function MonthShowcase({ items, href }: { items: GalleryItem[]; href: string }) {
  const rows = toRows(items);

  return (
    <Link href={href} aria-label="View this month" className="marquee block">
      {rows.map((row, r) => {
        const loop = Array.from({ length: Math.ceil(MIN_PER_LOOP / row.length) }, () => row).flat();
        // An even count keeps the alternating tilt identical in both halves, so the wrap is invisible.
        if (loop.length % 2) loop.push(...row);
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
                const original = half === 0 && i < row.length;
                return (
                  <figure key={`${half}-${i}`} aria-hidden={!original} className="instax" data-film={filmFor(item)}>
                    <div className="instax-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
                      <img
                        src={item.thumbUrl}
                        alt={original ? (item.caption ?? "") : ""}
                        loading={r < 2 && i < MIN_PER_LOOP ? "eager" : "lazy"}
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                    <figcaption>{item.caption || dayFormat.format(new Date(`${item.day}T00:00:00Z`))}</figcaption>
                  </figure>
                );
              }),
            )}
          </div>
        );
      })}
    </Link>
  );
}
