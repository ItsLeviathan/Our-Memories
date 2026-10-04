import Link from "next/link";
import { MonthCard } from "@/components/month/MonthCard";
import { RecapButton } from "@/components/recap/RecapPanel";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requirePageSession } from "@/lib/auth";
import { listMonthMemories } from "@/lib/data/memories";
import { getMonthSummaries } from "@/lib/data/months";
import { getRecap } from "@/lib/data/recaps";
import { env } from "@/lib/env";
import { currentMonthKeyIn, monthLabel, pluralize } from "@/lib/months";
import type { GalleryItem } from "@/lib/types";

export default async function DashboardPage() {
  const session = await requirePageSession();
  const currentKey = currentMonthKeyIn(env().APP_TIMEZONE);
  const months = await getMonthSummaries(session.supabase);

  if (months.length === 0) {
    return (
      <section className="grid min-h-[65dvh] place-items-center text-center">
        <div className="max-w-md">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-sm font-bold text-accent">
            <Icon name="heart" size={14} filled /> {monthLabel(currentKey)}
          </p>
          <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">No memories yet</h1>
          <p className="mt-4 font-serif text-3xl">Every little moment starts somewhere ♡</p>
          <ButtonLink href="/add" size="lg" icon="plus" className="mt-10">
            Add your first memory
          </ButtonLink>
        </div>
      </section>
    );
  }

  const current = months.find((m) => m.monthKey === currentKey);
  const previous = months.filter((m) => m.monthKey !== currentKey);
  const [preview, recap] = current
    ? await Promise.all([
        listMonthMemories(session.supabase, { coupleId: session.coupleId, monthKey: currentKey, limit: 60, includeHd: false }),
        getRecap(session.supabase, session.coupleId, currentKey),
      ])
    : [null, null];

  return (
    <div className="space-y-20 sm:space-y-28">
      <section aria-labelledby="current-month" className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-sm font-bold text-accent">
            <Icon name="heart" size={14} filled className="animate-heartbeat" /> This month
          </p>
          <h1 id="current-month" className="text-gradient mt-4 pb-1 text-5xl font-semibold leading-[1.05] sm:text-6xl xl:text-7xl">
            {monthLabel(currentKey)}
          </h1>
          {current ? (
            <p className="mt-4 text-lg text-fg-soft">
              {pluralize(current.memoryCount, "memory", "memories")} · {pluralize(current.dayCount, "day")} captured
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-lg text-fg-soft">Nothing here yet.</p>
              <p className="mt-1 font-serif text-2xl">Maybe this month is just getting started ♡</p>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-start gap-2.5">
            <ButtonLink href="/add" icon="plus">
              Add memories
            </ButtonLink>
            {current ? (
              <>
                <ButtonLink href={`/months/${currentKey}`} variant="secondary">
                  View month
                </ButtonLink>
                {recap ? <RecapButton monthKey={currentKey} initial={recap} /> : null}
              </>
            ) : null}
          </div>
        </div>

        {preview && preview.items.length ? <Mosaic items={pickMosaic(preview.items)} href={`/months/${currentKey}`} /> : null}
      </section>

      {previous.length ? (
        <section aria-labelledby="previous-months">
          <div className="mb-10 flex items-baseline justify-between border-b-2 border-dashed border-line pb-4">
            <h2 id="previous-months" className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <Icon name="heart" filled size={22} className="text-accent" />
              {current ? "Previous months" : "Your months"}
            </h2>
            <span className="rounded-full bg-accent-soft px-3 py-0.5 text-sm font-bold text-accent">{pluralize(previous.length, "month")}</span>
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {previous.map((m) => (
              <MonthCard key={m.monthKey} month={m} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Favorites first, then the most recent — up to five photos. */
function pickMosaic(items: GalleryItem[]) {
  const sorted = [...items].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.capturedAt.localeCompare(a.capturedAt));
  return sorted.slice(0, 5);
}

/**
 * Collage of the month's highlights. Phones: hero on top, up to two squares below.
 * Tablet/desktop: a fixed 16:10 frame — hero fills two thirds, the rest stack on
 * the right — so the photos always fill the frame with no gaps.
 */
function Mosaic({ items, href }: { items: GalleryItem[]; href: string }) {
  const [hero, ...rest] = items;
  const side = rest.slice(0, 2);
  return (
    <Link
      href={href}
      className="group block rounded-[2rem] border-2 border-line bg-surface p-2.5 shadow-soft transition-transform duration-500 ease-out-soft hover:-translate-y-1 sm:p-3"
      aria-label="View this month"
    >
      {/* Phones */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        <MosaicImage item={hero} className="aspect-[4/3]" eager />
        {side.length ? (
          <div className={`grid gap-2.5 ${side.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {side.map((item) => (
              <MosaicImage key={item.id} item={item} className={side.length === 2 ? "aspect-square" : "aspect-[16/9]"} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Tablet and desktop */}
      <div
        className={`hidden aspect-[16/10] gap-3 sm:grid ${side.length ? "grid-cols-3" : "grid-cols-1"} ${side.length === 2 ? "grid-rows-2" : "grid-rows-1"}`}
      >
        <MosaicImage item={hero} className={`h-full ${side.length ? "col-span-2" : ""} ${side.length === 2 ? "row-span-2" : ""}`} eager />
        {side.map((item) => (
          <MosaicImage key={item.id} item={item} className="h-full" />
        ))}
      </div>
    </Link>
  );
}

function MosaicImage({ item, className, eager }: { item: GalleryItem; className: string; eager?: boolean }) {
  return (
    <div className={`min-h-0 overflow-hidden rounded-2xl bg-surface-2 sm:rounded-3xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
      <img
        src={item.thumbUrl}
        srcSet={`${item.thumbUrl} 800w, ${item.displayUrl} 1600w`}
        sizes="(min-width: 1024px) 40vw, 100vw"
        alt={item.caption ?? ""}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.02]"
      />
    </div>
  );
}
