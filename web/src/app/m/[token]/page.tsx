import type { Metadata } from "next";
import { headers } from "next/headers";
import { Gallery } from "@/components/gallery/Gallery";
import { RecapPlayer } from "@/components/recap/RecapPlayer";
import { DarkDocument } from "@/components/ui/DarkDocument";
import { Icon } from "@/components/ui/Icon";
import { listMonthMemories, getMonthStats } from "@/lib/data/memories";
import { getRecap } from "@/lib/data/recaps";
import { resolveShareToken } from "@/lib/data/shares";
import { monthLabel, monthName, pluralize } from "@/lib/months";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A shared album",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Public, read-only album for one shared month. The token is validated on the
 * server; nothing here exposes account data, internal storage keys, or any
 * other month.
 */
export default async function SharedAlbumPage({ params }: PageProps<"/m/[token]">) {
  const { token } = await params;
  const allowed = await rateLimit(`public:${clientIp(await headers())}`, 600, 600);
  const share = allowed ? await resolveShareToken(token) : null;
  if (!share) return <Unavailable rateLimited={!allowed} />;

  const admin = createAdminClient();
  const [stats, page, recap] = await Promise.all([
    getMonthStats(admin, share.coupleId, share.monthKey),
    listMonthMemories(admin, { coupleId: share.coupleId, monthKey: share.monthKey }),
    getRecap(admin, share.coupleId, share.monthKey),
  ]);
  const name = monthName(share.monthKey);

  return (
    <div data-theme="dark" className="min-h-dvh bg-bg text-fg">
      <DarkDocument />
      <header className="relative flex min-h-[78dvh] flex-col items-center justify-center px-6 text-center sm:min-h-[86dvh]">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted">A shared album</p>
        <h1 className="mt-5 text-[3.4rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-8xl lg:text-[8.5rem]">
          {monthLabel(share.monthKey)}
        </h1>
        <p className="mt-6 font-serif text-2xl italic text-fg-soft sm:text-3xl">A month of us.</p>
        {stats.memoryCount ? (
          <p className="mt-8 text-[0.95rem] text-muted">
            {pluralize(stats.memoryCount, "memory", "memories")} · {pluralize(stats.dayCount, "day")}
          </p>
        ) : null}
        <a
          href="#album"
          className="absolute bottom-8 grid h-12 w-12 place-items-center rounded-full text-muted transition-colors hover:text-fg"
          aria-label="Scroll to photos"
        >
          <Icon name="arrowDown" size={22} />
        </a>
      </header>

      <main id="album" className="mx-auto max-w-[1600px] scroll-mt-4 px-1 pb-24 sm:px-6 lg:px-10">
        {page.items.length ? (
          <Gallery initial={page} mode={{ kind: "public", token, allowDownloads: share.allowDownloads }} />
        ) : (
          <p className="py-24 text-center font-serif text-2xl italic text-muted">Nothing here yet.</p>
        )}

        {recap.videoUrl ? (
          <section aria-labelledby="recap-title" className="mx-auto mt-28 max-w-5xl px-3 sm:mt-40 sm:px-0">
            <div className="mb-8 text-center">
              <h2 id="recap-title" className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
                {name} Recap
              </h2>
              <p className="mt-3 font-serif text-xl italic text-muted">The month, in a few minutes.</p>
            </div>
            <RecapPlayer src={recap.videoUrl} poster={recap.posterUrl} title={`${name} recap`} />
            {share.allowDownloads ? (
              <div className="mt-5 text-center">
                <a href={`/api/public/${token}/recap/download`} className="inline-flex items-center gap-2 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
                  <Icon name="download" size={16} /> Download recap
                </a>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="pb-12 text-center text-sm tracking-tight text-muted/70">Our Memories</footer>
    </div>
  );
}

function Unavailable({ rateLimited }: { rateLimited: boolean }) {
  return (
    <main data-theme="dark" className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
      <DarkDocument />
      <div className="max-w-md">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {rateLimited ? "Please wait a moment." : "This album isn't available."}
        </h1>
        <p className="mt-4 font-serif text-xl italic text-muted">
          {rateLimited ? "Too many requests — try again in a few minutes." : "The link may have expired or been turned off."}
        </p>
      </div>
    </main>
  );
}
