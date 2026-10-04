"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Cinematic video presentation: poster with a single play affordance, then
 * native controls (best accessibility and mobile fullscreen support).
 */
export function RecapPlayer({ src, poster, title }: { src: string; poster: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-soft sm:rounded-3xl">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        controls={started}
        playsInline
        preload="metadata"
        className="aspect-video max-h-[80dvh] w-full bg-black object-contain"
        aria-label={title}
        onPlay={() => setStarted(true)}
      />
      {!started ? (
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            ref.current?.play().catch(() => {});
          }}
          className="group absolute inset-0 grid place-items-center bg-black/15 transition-colors hover:bg-black/25"
          aria-label={`Play ${title}`}
        >
          <span className="grid h-18 w-18 place-items-center rounded-full bg-white/90 text-[#d63a72] shadow-lg transition-transform duration-300 ease-out-soft group-hover:scale-105 sm:h-20 sm:w-20">
            <Icon name="play" filled size={28} className="translate-x-[2px]" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
