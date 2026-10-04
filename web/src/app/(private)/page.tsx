import Link from "next/link";
import { MonthCard } from "@/components/month/MonthCard";
import { RecapButton } from "@/components/recap/RecapPanel";
import { ButtonLink } from "@/components/ui/Button";
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
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted">{monthLabel(currentKey)}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">No memories yet.</h1>
          <p className="mt-4 font-serif text-2xl italic text-muted">Every little moment starts somewhere.</p>
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
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted">This month</p>
          <h1 id="current-month" className="mt-3 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl xl:text-7xl">
            {monthLabel(currentKey)}
          </h1>
          {current ? (
            <p className="mt-4 text-lg text-fg-soft">
              {pluralize(current.memoryCount, "memory", "memories")} · {pluralize(current.dayCount, "day")} captured
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-lg text-fg-soft">Nothing here yet.</p>
              <p className="mt-1 font-serif text-xl italic text-muted">Maybe this month is just getting started.</p>
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
          <div className="mb-8 flex items-baseline justify-between border-b border-line pb-4">
            <h2 id="previous-months" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {current ? "Previous months" : "Your months"}
            </h2>
            <span className="text-sm text-muted">{pluralize(previous.length, "month")}</span>
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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

function Mosaic({ items, href }: { items: GalleryItem[]; href: string }) {
  const [hero, ...rest] = items;
  return (
    <Link href={href} className="group grid grid-cols-6 grid-rows-[repeat(2,minmax(0,1fr))] gap-2 sm:gap-3" aria-label="View this month">
      <MosaicImage item={hero} className={rest.length ? "col-span-6 row-span-2 aspect-[4/3] sm:col-span-4" : "col-span-6 row-span-2 aspect-[16/10]"} eager />
      {rest.slice(0, 2).map((item) => (
        <MosaicImage key={item.id} item={item} className="col-span-3 hidden sm:col-span-2 sm:block" />
      ))}
      {rest.length > 2 ? (
        <div className="col-span-6 grid grid-cols-2 gap-2 sm:hidden">
          {rest.slice(0, 2).map((item) => (
            <MosaicImage key={item.id} item={item} className="aspect-square" />
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function MosaicImage({ item, className, eager }: { item: GalleryItem; className: string; eager?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-surface-2 sm:rounded-2xl ${className}`}>
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
