import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery/Gallery";
import { RecapPanel } from "@/components/recap/RecapPanel";
import { ShareButton } from "@/components/share/ShareButton";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requirePageSession } from "@/lib/auth";
import { getMonthStats, listMonthMemories } from "@/lib/data/memories";
import { getRecap } from "@/lib/data/recaps";
import { getActiveShare } from "@/lib/data/shares";
import { formatShortDay, monthLabel, pluralize } from "@/lib/months";
import { parseMonthParam } from "@/lib/validation";

export async function generateMetadata({ params }: PageProps<"/months/[month]">): Promise<Metadata> {
  const monthKey = parseMonthParam((await params).month);
  return { title: monthKey ? monthLabel(monthKey) : "Month" };
}

export default async function MonthPage({ params }: PageProps<"/months/[month]">) {
  const monthKey = parseMonthParam((await params).month);
  if (!monthKey) notFound();
  const session = await requirePageSession();
  const { supabase, coupleId } = session;

  const [stats, page, recap, share] = await Promise.all([
    getMonthStats(supabase, coupleId, monthKey),
    listMonthMemories(supabase, { coupleId, monthKey }),
    getRecap(supabase, coupleId, monthKey),
    getActiveShare(supabase, coupleId, monthKey),
  ]);
  const empty = stats.memoryCount === 0;

  return (
    <div>
      <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface/70 px-4 py-1.5 text-sm font-bold sm:min-h-0 text-muted transition-colors hover:bg-accent-soft hover:text-accent">
        <Icon name="arrowLeft" size={16} /> All months
      </Link>

      <header className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-gradient pb-1 text-5xl font-semibold leading-[1.05] sm:text-6xl xl:text-7xl">{monthLabel(monthKey)}</h1>
          {empty ? (
            <p className="mt-4 text-lg text-fg-soft">Nothing here yet.</p>
          ) : (
            <p className="mt-4 text-lg text-fg-soft">
              {pluralize(stats.memoryCount, "memory", "memories")} · {pluralize(stats.dayCount, "day")}
              {stats.firstDay && stats.lastDay && stats.firstDay !== stats.lastDay ? (
                <span className="text-muted">
                  {" "}
                  · {formatShortDay(stats.firstDay)} – {formatShortDay(stats.lastDay)}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={`/add?month=${monthKey}`} icon="plus">
            Add memories
          </ButtonLink>
          {!empty ? (
            <a href="#recap" className={buttonClasses({ variant: "secondary" })}>
              <Icon name={recap.status === "ready" ? "play" : "film"} filled={recap.status === "ready"} />
              {recap.status === "ready" ? "Watch recap" : recap.status === "queued" || recap.status === "processing" ? "Generating…" : "Recap"}
            </a>
          ) : null}
          <ShareButton monthKey={monthKey} initial={share} disabled={empty && !share} />
        </div>
      </header>

      {empty ? (
        <section className="grid min-h-[40dvh] place-items-center text-center">
          <div>
            <p className="font-serif text-3xl">Maybe this month is just getting started ♡</p>
            <ButtonLink href={`/add?month=${monthKey}`} variant="secondary" icon="plus" className="mt-8">
              Add a memory
            </ButtonLink>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-12 sm:mt-16">
            <Gallery key={monthKey} initial={page} mode={{ kind: "private", monthKey }} />
          </div>
          <div className="mt-20 border-t-2 border-dashed border-line pt-12 sm:mt-28 sm:pt-16">
            <RecapPanel monthKey={monthKey} initial={recap} memoryCount={stats.memoryCount} />
          </div>
        </>
      )}
    </div>
  );
}
