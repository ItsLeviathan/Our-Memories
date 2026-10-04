"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { Icon, Spinner, type IconName } from "@/components/ui/Icon";
import { formatDay } from "@/lib/months";
import type { GalleryItem } from "@/lib/types";

/**
 * Fullscreen photo viewer: keyboard (← → Esc), swipe left/right to navigate,
 * swipe down to close, tap to hide the controls. Photos stay the focus.
 */
export function PhotoViewer({
  items,
  index,
  onIndexChange,
  onClose,
  downloadUrl,
  onToggleFavorite,
  onEdit,
}: {
  items: GalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  downloadUrl: (item: GalleryItem) => string | null;
  onToggleFavorite?: (item: GalleryItem) => void;
  onEdit?: (item: GalleryItem) => void;
}) {
  const item = items[index];
  const [direction, setDirection] = useState(0);
  const [chrome, setChrome] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    setDirection(delta);
    onIndexChange(next);
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return; // an edit dialog is on top
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Lock page scroll and restore focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  // Preload neighbours so navigation feels instant.
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]]) {
      if (n) new Image().src = n.displayUrl;
    }
  }, [index, items]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { x, y } = info.offset;
    if (Math.abs(x) > Math.abs(y)) {
      if (x < -70 || info.velocity.x < -500) go(1);
      else if (x > 70 || info.velocity.x > 500) go(-1);
    } else if (y > 110 || info.velocity.y > 700) {
      onClose();
    }
  };

  if (!item) return null;
  const download = downloadUrl(item);
  const srcSet = item.hdUrl ? `${item.displayUrl} 1600w, ${item.hdUrl} 2560w` : undefined;

  return (
    <motion.div
      data-theme="dark"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex select-none flex-col bg-[var(--overlay)] text-fg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Top bar */}
      <motion.div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/50 to-transparent px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
        animate={{ opacity: chrome ? 1 : 0 }}
        style={{ pointerEvents: chrome ? "auto" : "none" }}
      >
        <span className="pl-2 text-sm tabular-nums text-white/70">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-1">
          {onToggleFavorite ? (
            <ViewerButton
              icon="heart"
              filled={item.isFavorite}
              label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => onToggleFavorite(item)}
              className={item.isFavorite ? "text-accent" : ""}
            />
          ) : null}
          {download ? (
            <a
              href={download}
              className="grid h-11 w-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Download HD photo"
              title="Download HD"
            >
              <Icon name="download" />
            </a>
          ) : null}
          {onEdit ? <ViewerButton icon="edit" label="Edit memory" onClick={() => onEdit(item)} /> : null}
          <ViewerButton ref={closeRef} icon="close" label="Close" onClick={onClose} />
        </div>
      </motion.div>

      {/* Photo */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={item.id}
            custom={direction}
            className="absolute inset-0 flex items-center justify-center px-0 py-16 sm:px-20 sm:py-20"
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            drag
            dragSnapToOrigin
            dragElastic={0.5}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            onTap={() => setChrome((c) => !c)}
          >
            <ViewerImage item={item} srcSet={srcSet} />
          </motion.div>
        </AnimatePresence>

        {index > 0 ? (
          <NavButton side="left" onClick={() => go(-1)} visible={chrome} />
        ) : null}
        {index < items.length - 1 ? (
          <NavButton side="right" onClick={() => go(1)} visible={chrome} />
        ) : null}
      </div>

      {/* Details */}
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12 sm:px-8"
        animate={{ opacity: chrome ? 1 : 0 }}
        style={{ pointerEvents: "none" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[0.8rem] font-medium uppercase tracking-[0.14em] text-white/60">
            {formatDay(item.day, { withYear: true })}
            {item.location ? <span> · {item.location}</span> : null}
          </p>
          {item.caption ? (
            <p className="mt-1.5 font-serif text-xl leading-snug text-white sm:text-2xl">{item.caption}</p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ViewerImage({ item, srcSet }: { item: GalleryItem; srcSet?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded ? (
        <span className="absolute text-white/50">
          <Spinner size={26} />
        </span>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URLs */}
      <img
        src={item.displayUrl}
        srcSet={srcSet}
        sizes="100vw"
        width={item.width}
        height={item.height}
        alt={item.caption ?? ""}
        draggable={false}
        onLoad={() => setLoaded(true)}
        ref={(img) => {
          if (img?.complete && img.naturalWidth) setLoaded(true);
        }}
        data-loaded={loaded}
        className="photo-fade pointer-events-none max-h-full max-w-full object-contain sm:rounded-sm"
        style={{ aspectRatio: `${item.width} / ${item.height}` }}
      />
    </>
  );
}

function ViewerButton({
  icon,
  label,
  onClick,
  filled,
  className = "",
  ref,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  filled?: boolean;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white ${className}`}
    >
      <Icon name={icon} filled={filled} />
    </button>
  );
}

function NavButton({ side, onClick, visible }: { side: "left" | "right"; onClick: () => void; visible: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white/80 backdrop-blur-sm transition-all hover:bg-black/40 hover:text-white pointer-fine:grid ${
        side === "left" ? "left-4" : "right-4"
      } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Icon name={side === "left" ? "chevronLeft" : "chevronRight"} size={22} />
    </button>
  );
}
