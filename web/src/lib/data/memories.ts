import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedViewUrl } from "@/lib/r2";
import type { GalleryItem, GalleryPage, MonthStats } from "@/lib/types";

export const GALLERY_PAGE_SIZE = 48;

interface AssetRow {
  variant: "thumb" | "display" | "hd";
  storage_key: string;
}

export interface MemoryRow {
  id: string;
  captured_day: string;
  captured_at: string;
  caption: string | null;
  location: string | null;
  tags: string[];
  is_favorite: boolean;
  width: number;
  height: number;
  memory_assets: AssetRow[];
}

const MEMORY_COLUMNS =
  "id, captured_day, captured_at, caption, location, tags, is_favorite, width, height, memory_assets(variant, storage_key)";

/** Opaque keyset cursor: (captured_at, id). */
function encodeCursor(row: MemoryRow) {
  return Buffer.from(JSON.stringify([row.captured_at, row.id])).toString("base64url");
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "string" &&
      !Number.isNaN(Date.parse(value[0])) &&
      typeof value[1] === "string" &&
      /^[0-9a-f-]{36}$/i.test(value[1])
    ) {
      return [new Date(value[0]).toISOString(), value[1]];
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function assetKeys(row: Pick<MemoryRow, "memory_assets">) {
  return Object.fromEntries(row.memory_assets.map((a) => [a.variant, a.storage_key])) as Partial<
    Record<AssetRow["variant"], string>
  >;
}

export async function toGalleryItem(row: MemoryRow, includeHd: boolean): Promise<GalleryItem | null> {
  const keys = assetKeys(row);
  if (!keys.thumb || !keys.display) return null;
  const [thumbUrl, displayUrl, hdUrl] = await Promise.all([
    signedViewUrl(keys.thumb),
    signedViewUrl(keys.display),
    includeHd && keys.hd ? signedViewUrl(keys.hd) : Promise.resolve(null),
  ]);
  return {
    id: row.id,
    day: row.captured_day,
    capturedAt: row.captured_at,
    caption: row.caption,
    location: row.location,
    tags: row.tags,
    isFavorite: row.is_favorite,
    width: row.width,
    height: row.height,
    thumbUrl,
    displayUrl,
    hdUrl,
  };
}

/**
 * One page of a month's memories in chronological order. Works with both the
 * user client (RLS) and the admin client (public pages) — the couple filter is
 * always explicit.
 */
export async function listMonthMemories(
  client: SupabaseClient,
  opts: { coupleId: string; monthKey: string; cursor?: string | null; limit?: number; includeHd?: boolean },
): Promise<GalleryPage> {
  const limit = Math.min(opts.limit ?? GALLERY_PAGE_SIZE, 100);
  let query = client
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("couple_id", opts.coupleId)
    .eq("month_key", opts.monthKey)
    .eq("status", "ready")
    .order("captured_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    const [at, id] = cursor;
    query = query.or(`captured_at.gt.${at},and(captured_at.eq.${at},id.gt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as MemoryRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = (await Promise.all(pageRows.map((r) => toGalleryItem(r, opts.includeHd ?? true)))).filter(
    (i): i is GalleryItem => i !== null,
  );
  return { items, nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null };
}

export async function getMemoryWithAssets(client: SupabaseClient, coupleId: string, id: string) {
  const { data, error } = await client
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("couple_id", coupleId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as MemoryRow | null;
}

export async function getMonthStats(client: SupabaseClient, coupleId: string, monthKey: string): Promise<MonthStats> {
  const { data, error } = await client
    .from("memories")
    .select("captured_day")
    .eq("couple_id", coupleId)
    .eq("month_key", monthKey)
    .eq("status", "ready")
    .order("captured_day", { ascending: true });
  if (error) throw error;
  const days = (data ?? []).map((r) => r.captured_day as string);
  return {
    memoryCount: days.length,
    dayCount: new Set(days).size,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
  };
}

/** Every ready photo of a month, page by page (for the home page's moving prints). */
export async function listAllMonthMemories(
  client: SupabaseClient,
  opts: { coupleId: string; monthKey: string; includeHd?: boolean },
): Promise<GalleryItem[]> {
  const items: GalleryItem[] = [];
  let cursor: string | null = null;
  do {
    const page: GalleryPage = await listMonthMemories(client, { ...opts, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
