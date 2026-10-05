import { MonthCard } from "@/components/month/MonthCard";
import { MonthShowcase } from "@/components/month/MonthShowcase";
import { RecapButton } from "@/components/recap/RecapPanel";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requirePageViewer } from "@/lib/auth";
import { getCoupleNames } from "@/lib/data/couple";
import { listAllMonthMemories } from "@/lib/data/memories";
import { getCoupleMonthSummaries, getMonthSummaries } from "@/lib/data/months";
import { getRecap } from "@/lib/data/recaps";
import { env } from "@/lib/env";
import { currentMonthKeyIn, monthLabel, pluralize } from "@/lib/months";
import type { GalleryItem } from "@/lib/types";

export default async function DashboardPage() {
  const viewer = await requirePageViewer();
  const isMember = viewer.kind === "member";
  const currentKey = currentMonthKeyIn(env().APP_TIMEZONE);
  const [months, names] = await Promise.all([
    isMember ? getMonthSummaries(viewer.client) : getCoupleMonthSummaries(viewer.client, viewer.coupleId),
    getCoupleNames(viewer.client, viewer.coupleId),
  ]);

  if (months.length === 0) {
    return (
      <section className="grid min-h-[65dvh] place-items-center text-center">
        <div className="max-w-md">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-sm font-bold text-accent">
            <Icon name="heart" size={14} filled /> {monthLabel(currentKey)}
          </p>
          <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">No memories yet</h1>
          <p className="mt-4 font-serif text-3xl">Every little moment starts somewhere ♡</p>
          {isMember ? (
            <ButtonLink href="/add" size="lg" icon="plus" className="mt-10">
              Add your first memory
            </ButtonLink>
          ) : null}
        </div>
      </section>
    );
  }

  const current = months.find((m) => m.monthKey === currentKey);
  const [preview, recap] = current
    ? await Promise.all([
        listAllMonthMemories(viewer.client, { coupleId: viewer.coupleId, monthKey: currentKey, includeHd: false }),
        getRecap(viewer.client, viewer.coupleId, currentKey),
      ])
    : [null, null];

  return (
    <div className="space-y-20 sm:space-y-28">
      <section aria-labelledby="current-month">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-sm font-bold text-accent">
              <Icon name="heart" size={14} filled className="animate-heartbeat" /> This month
            </p>
            <h1 id="current-month" className="text-gradient mt-4 pb-1 text-5xl font-semibold leading-[1.05] sm:text-6xl xl:text-7xl">
              {monthLabel(currentKey)}
            </h1>
            <p className="mt-3 font-serif text-2xl sm:text-3xl">Every little moment with you, kept right here ♡</p>
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
              {isMember ? (
                <ButtonLink href="/add" icon="plus">
                  Add memories
                </ButtonLink>
              ) : null}
              {current ? (
                <>
                  <ButtonLink href={`/months/${currentKey}`} variant={isMember ? "secondary" : "primary"}>
                    View month
                  </ButtonLink>
                  {!recap ? null : isMember ? (
                    <RecapButton monthKey={currentKey} initial={recap} />
                  ) : recap.status === "ready" ? (
                    <a href={`/months/${currentKey}#recap`} className={buttonClasses({ variant: "secondary" })}>
                      <Icon name="play" /> Watch recap
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <LoveNote names={names} />
        </div>

        {preview && preview.length ? (
          <div className="mt-14 sm:mt-16">
            <p className="flex items-center justify-center gap-2 text-center text-[0.95rem] font-bold text-muted">
              <Icon name="heart" size={14} filled className="text-lavender" />
              Our month in little prints — tap one to look closer
              <Icon name="heart" size={14} filled className="text-lavender" />
            </p>
            <MonthShowcase items={pickShowcase(preview)} canDownload={isMember} />
          </div>
        ) : null}
      </section>

      {/* Every month gets a card, this month included (always first: newest first). */}
      <section aria-labelledby="our-months">
        <div className="mb-10 flex items-baseline justify-between border-b-2 border-dashed border-line pb-4">
          <h2 id="our-months" className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
            <Icon name="heart" filled size={22} className="text-accent" />
            Our months
          </h2>
          <span className="rounded-full bg-accent-soft px-3 py-0.5 text-sm font-bold text-accent">{pluralize(months.length, "month")}</span>
        </div>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((m) => (
            <MonthCard key={m.monthKey} month={m} isCurrent={m.monthKey === currentKey} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** The month in the order it happened, for the film strip. */
function pickShowcase(items: GalleryItem[]) {
  return [...items].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

/** A little handwritten note pinned beside the month, signed by the two of us. */
function LoveNote({ names }: { names: string[] }) {
  return (
    <figure className="relative mx-auto w-full max-w-md rotate-[1.5deg] rounded-[1.75rem] border border-line bg-surface p-7 shadow-soft sm:p-8 lg:mx-0 lg:justify-self-end">
      <span className="tape" aria-hidden="true" />
      <blockquote className="font-serif text-[1.6rem] leading-snug text-fg-soft sm:text-3xl">
        <p>To us —</p>
        <p className="mt-2">
          for the sleepy texts, the silly selfies, the random dates on whatever day we can steal for each other, and every quiet moment in between. This is where we keep them all.
        </p>
      </blockquote>
      <figcaption className="mt-5 flex items-center justify-end gap-1.5 font-serif text-2xl text-accent">
        <Icon name="heart" size={16} filled className="animate-heartbeat" />
        {names.length === 2 ? `${names[0]} & ${names[1]}` : "the two of us"}
      </figcaption>
    </figure>
  );
}
