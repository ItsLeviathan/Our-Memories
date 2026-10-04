"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { EditMemoryDialog } from "@/components/gallery/EditMemoryDialog";
import { PhotoViewer } from "@/components/gallery/PhotoViewer";
import { Icon, Spinner } from "@/components/ui/Icon";
import { api } from "@/lib/client-api";
import { computeJustifiedLayout, gapFor, targetRowHeightFor } from "@/lib/gallery-layout";
import { formatShortDay } from "@/lib/months";
import type { GalleryItem, GalleryPage } from "@/lib/types";

export type GalleryMode = { kind: "private"; monthKey: string } | { kind: "public"; token: string; allowDownloads: boolean };

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Gallery({ initial, mode }: { initial: GalleryPage; mode: GalleryMode }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [containerRef, width] = useContainerWidth();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isPrivate = mode.kind === "private";
  const moreUrl =
    mode.kind === "private" ? `/api/months/${mode.monthKey}/memories` : `/api/public/${mode.token}/memories`;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await api<GalleryPage>(`${moreUrl}?cursor=${encodeURIComponent(cursor)}`);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, moreUrl]);

  // Progressive loading: fetch the next page well before the end is visible.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      rootMargin: "1200px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const rows = useMemo(() => {
    if (!width) return [];
    return computeJustifiedLayout(
      items.map((i) => ({ aspect: i.width / i.height, featured: i.isFavorite })),
      { containerWidth: width, targetRowHeight: targetRowHeightFor(width), gap: gapFor(width) },
    );
  }, [items, width]);

  const downloadUrl = (item: GalleryItem) => {
    if (mode.kind === "private") return `/api/memories/${item.id}/download`;
    return mode.allowDownloads ? `/api/public/${mode.token}/memories/${item.id}/download` : null;
  };

  const replaceItem = (updated: GalleryItem) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const removeItem = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    setViewerIndex((v) => (v === null || next.length === 0 ? null : Math.min(v > index ? v - 1 : v, next.length - 1)));
  };

  const toggleFavorite = async (item: GalleryItem) => {
    replaceItem({ ...item, isFavorite: !item.isFavorite });
    try {
      await api(`/api/memories/${item.id}`, { method: "PATCH", json: { isFavorite: !item.isFavorite } });
      router.refresh();
    } catch {
      replaceItem(item);
    }
  };

  const gap = gapFor(width || 1024);

  return (
    <div ref={containerRef} className="w-full" style={width ? undefined : { minHeight: items.length ? "60vh" : undefined }}>
      <div className="flex flex-col" style={{ gap }}>
        {rows.map((row, r) => (
          <div key={r} className={`flex ${row.featured ? "justify-center" : ""}`} style={{ gap, height: row.height }}>
            {row.boxes.map((box) => {
              const item = items[box.index];
              return (
                <Tile
                  key={item.id}
                  item={item}
                  width={box.width}
                  height={box.height}
                  eager={box.index < 8}
                  showFavorite={isPrivate}
                  onOpen={() => setViewerIndex(box.index)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" />
      {loadingMore ? (
        <div className="flex justify-center py-10 text-muted">
          <Spinner size={22} />
        </div>
      ) : null}
      {loadError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-muted">
          <p>{loadError}</p>
          <button type="button" onClick={loadMore} className="text-fg underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {viewerIndex !== null && items[viewerIndex] ? (
          <PhotoViewer
            items={items}
            index={viewerIndex}
            onIndexChange={(i) => {
              setViewerIndex(i);
              if (i >= items.length - 4) loadMore();
            }}
            onClose={() => setViewerIndex(null)}
            downloadUrl={downloadUrl}
            onToggleFavorite={isPrivate ? toggleFavorite : undefined}
            onEdit={isPrivate ? setEditing : undefined}
          />
        ) : null}
      </AnimatePresence>

      {isPrivate ? (
        <EditMemoryDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated, monthKey) => {
            if (mode.kind === "private" && monthKey !== mode.monthKey) removeItem(updated.id);
            else replaceItem(updated);
            setEditing(null);
            router.refresh();
          }}
          onDeleted={(id) => {
            removeItem(id);
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Tile({
  item,
  width,
  height,
  eager,
  showFavorite,
  onOpen,
}: {
  item: GalleryItem;
  width: number;
  height: number;
  eager: boolean;
  showFavorite: boolean;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const label = [formatShortDay(item.day), item.caption].filter(Boolean).join(" — ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative shrink-0 overflow-hidden rounded-[3px] bg-surface-2 sm:rounded-md"
      style={{ width, height }}
      aria-label={`Open photo: ${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URLs, sized via srcset */}
      <img
        src={item.thumbUrl}
        srcSet={`${item.thumbUrl} 800w, ${item.displayUrl} 1600w`}
        sizes={`${width}px`}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        alt={item.caption ?? ""}
        draggable={false}
        onLoad={() => setLoaded(true)}
        ref={(img) => {
          if (img?.complete && img.naturalWidth) setLoaded(true);
        }}
        data-loaded={loaded}
        className="photo-fade h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.025]"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/45 to-transparent p-3 text-left text-[0.8rem] font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="line-clamp-1">{label}</span>
      </span>
      {showFavorite && item.isFavorite ? (
        <span className="pointer-events-none absolute right-2 top-2 text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]">
          <Icon name="heart" filled size={16} />
          <span className="sr-only">Favorite</span>
        </span>
      ) : null}
    </button>
  );
}
