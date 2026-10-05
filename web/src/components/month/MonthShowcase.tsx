"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { GalleryItem } from "@/lib/types";

const SLIDE_MS = 5000;

/** Slow Ken Burns drifts; each photo gets one based on its position in the list. */
const drifts = [
  { from: { scale: 1.16, x: "-3%", y: "-2%" }, to: { scale: 1.02, x: "0%", y: "0%" } },
  { from: { scale: 1.02, x: "2%", y: "0%" }, to: { scale: 1.14, x: "-2%", y: "-2%" } },
  { from: { scale: 1.14, x: "3%", y: "2%" }, to: { scale: 1.03, x: "0%", y: "0%" } },
  { from: { scale: 1.04, x: "0%", y: "2%" }, to: { scale: 1.15, x: "1%", y: "-3%" } },
];

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * This month's highlights as a living collage: the hero crossfades through the
 * photos with a slow Ken Burns drift, the side tiles follow a beat behind, and a
 * shimmering violet frame floats gently. Pauses on hover/focus; static when the
 * viewer prefers reduced motion.
 */
export function MonthShowcase({ items, href }: { items: GalleryItem[]; href: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  const animated = n > 1 && !reduceMotion;

  const at = (offset: number) => ({ item: items[(index + offset) % n], order: (index + offset) % n });
  const hero = at(0);
  const sideCount = Math.min(2, n - 1);
  const side = Array.from({ length: sideCount }, (_, k) => at(k + 1));

  // Warm the cache for the photo that's about to slide in.
  useEffect(() => {
    if (!animated) return;
    const next = items[(index + sideCount + 1) % n];
    const img = new Image();
    img.src = next.thumbUrl;
  }, [animated, index, items, n, sideCount]);

  const advance = () => setIndex((i) => (i + 1) % n);
  const label = hero.item.caption || dayFormat.format(new Date(`${hero.item.day}T00:00:00Z`));

  return (
    <div className="showcase-float relative">
      <div aria-hidden="true" className="showcase-glow pointer-events-none absolute -inset-6 rounded-[3rem] blur-3xl sm:-inset-10" />

      <Link
        href={href}
        aria-label="View this month"
        className="group relative block rounded-[2.2rem] transition-transform duration-500 ease-out-soft hover:-translate-y-1"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="showcase-ring rounded-[2.2rem] p-[3px] shadow-soft">
          <div className="rounded-[2.05rem] bg-surface p-2.5 sm:p-3">
            <div
              className={`grid gap-2.5 sm:aspect-[16/10] sm:gap-3 ${sideCount ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"} ${sideCount === 2 ? "sm:grid-rows-2" : ""}`}
            >
              {/* Hero */}
              <div
                className={`relative aspect-[4/3] min-h-0 overflow-hidden rounded-2xl bg-surface-2 sm:aspect-auto sm:rounded-3xl ${sideCount ? "col-span-2" : ""} ${sideCount === 2 ? "sm:row-span-2" : ""}`}
              >
                <AnimatePresence initial={false}>
                  <Slide key={hero.item.id} item={hero.item} drift={drifts[hero.order % drifts.length]} animated={animated} eager sizes="(min-width: 1024px) 40vw, 100vw" />
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#2a1d45]/70 via-[#2a1d45]/20 to-transparent" />

                {animated ? (
                  <div className="absolute inset-x-3 top-3 flex gap-1 sm:inset-x-4 sm:top-4">
                    {items.map((item, i) => (
                      <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/40 backdrop-blur-sm">
                        {i === index ? (
                          <span
                            key={index}
                            className="showcase-progress block h-full rounded-full bg-white"
                            style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                            onAnimationEnd={advance}
                          />
                        ) : (
                          <span className={`block h-full rounded-full bg-white ${i < index ? "w-full" : "w-0"}`} />
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 sm:inset-x-4 sm:bottom-4">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={hero.item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.45 }}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-sm font-bold text-[#6d28d9] shadow-sm backdrop-blur-md"
                    >
                      {hero.item.isFavorite ? <Icon name="heart" size={13} filled className="shrink-0" /> : null}
                      <span className="truncate">{label}</span>
                    </motion.p>
                  </AnimatePresence>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-sm font-bold text-[#6d28d9] opacity-0 shadow-sm backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 sm:inline-flex">
                    Open <Icon name="chevronRight" size={14} />
                  </span>
                </div>
              </div>

              {/* Side tiles follow the hero a beat later. */}
              {side.map(({ item, order }, k) => (
                <div
                  key={k}
                  className={`relative min-h-0 ${sideCount === 1 ? "col-span-2 aspect-[16/9] sm:col-span-1" : "aspect-square"} overflow-hidden rounded-2xl bg-surface-2 sm:aspect-auto sm:rounded-3xl`}
                >
                  <AnimatePresence initial={false}>
                    <Slide
                      key={item.id}
                      item={item}
                      drift={drifts[(order + 2) % drifts.length]}
                      animated={animated}
                      delay={0.25 * (k + 1)}
                      sizes="(min-width: 1024px) 20vw, 50vw"
                    />
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>

        <span aria-hidden="true" className="showcase-bob absolute -right-3 -top-4 grid h-11 w-11 place-items-center rounded-full bg-surface text-accent shadow-soft sm:-right-4 sm:-top-5 sm:h-12 sm:w-12">
          <Icon name="heart" size={22} filled className="animate-heartbeat" />
        </span>
        <span
          aria-hidden="true"
          className="showcase-bob absolute -bottom-4 -left-3 grid h-9 w-9 place-items-center rounded-full bg-surface text-lavender shadow-soft [animation-delay:-2.5s] sm:-left-4"
        >
          <Icon name="heart" size={16} filled />
        </span>
      </Link>
    </div>
  );
}

function Slide({
  item,
  drift,
  animated,
  eager,
  delay = 0,
  sizes,
}: {
  item: GalleryItem;
  drift: (typeof drifts)[number];
  animated: boolean;
  eager?: boolean;
  delay?: number;
  sizes: string;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.1, delay, ease: "easeInOut" }}
    >
      <motion.img
        src={item.thumbUrl}
        srcSet={`${item.thumbUrl} 800w, ${item.displayUrl} 1600w`}
        sizes={sizes}
        alt={item.caption ?? ""}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover"
        initial={animated ? drift.from : false}
        animate={animated ? drift.to : { scale: 1 }}
        transition={{ duration: (SLIDE_MS / 1000) * 1.8, delay, ease: "linear" }}
      />
    </motion.div>
  );
}
