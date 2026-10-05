import { MonthCard } from "@/components/month/MonthCard";
import { MonthShowcase } from "@/components/month/MonthShowcase";
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
      <section aria-labelledby="current-month">
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

        {preview && preview.items.length ? (
          <div className="mt-12 sm:mt-14">
            <MonthShowcase items={pickShowcase(preview.items)} href={`/months/${currentKey}`} />
          </div>
        ) : null}
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

/** The month in the order it happened, for the film strip. */
function pickShowcase(items: GalleryItem[]) {
  return [...items].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}
