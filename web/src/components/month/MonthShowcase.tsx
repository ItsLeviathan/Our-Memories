import Link from "next/link";
import type { GalleryItem } from "@/lib/types";

/** Seconds each photo spends crossing the strip; keeps the pace steady whatever the count. */
const SECONDS_PER_PHOTO = 6;
/** Repeat short months so the strip is always wider than the screen. */
const MIN_PER_LOOP = 10;

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * This month's photos as an endless film strip drifting right to left. Each photo
 * is shown whole (no cropping) at its own aspect ratio. The track holds the photos
 * twice and slides by half its width, so the loop is seamless. Hovering pauses it;
 * with reduced motion it becomes a strip you scroll by hand.
 */
export function MonthShowcase({ items, href }: { items: GalleryItem[]; href: string }) {
  const loop = Array.from({ length: Math.ceil(MIN_PER_LOOP / items.length) }, () => items).flat();
  // An even count keeps the alternating tilt identical in both halves, so the wrap is invisible.
  if (loop.length % 2) loop.push(...items);
  const duration = loop.length * SECONDS_PER_PHOTO;

  return (
    <Link href={href} aria-label="View this month" className="marquee block">
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {[0, 1].map((half) =>
          loop.map((item, i) => (
            <figure key={`${half}-${i}`} aria-hidden={half === 1 || i >= items.length} className="marquee-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
              <img
                src={item.thumbUrl}
                srcSet={`${item.thumbUrl} 800w, ${item.displayUrl} 1600w`}
                sizes="(min-width: 640px) 480px, 320px"
                alt={half === 0 && i < items.length ? (item.caption ?? "") : ""}
                width={item.width}
                height={item.height}
                loading={i < MIN_PER_LOOP ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                style={{ aspectRatio: `${item.width} / ${item.height}` }}
              />
              <figcaption className="truncate px-1 pt-2 text-center font-serif text-xl leading-none">
                {item.caption || dayFormat.format(new Date(`${item.day}T00:00:00Z`))}
              </figcaption>
            </figure>
          )),
        )}
      </div>
    </Link>
  );
}
