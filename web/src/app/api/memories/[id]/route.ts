import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { assetKeys, getMemoryWithAssets, toGalleryItem } from "@/lib/data/memories";
import { env } from "@/lib/env";
import { ApiError, parseBody, route } from "@/lib/http";
import { todayIn, zonedTimeToUtc } from "@/lib/months";
import { deleteObjects } from "@/lib/r2";
import { daySchema, memoryDetailsSchema } from "@/lib/validation";

const idSchema = z.uuid();

const patchSchema = memoryDetailsSchema.partial().extend({ day: daySchema.optional() });

async function loadMemory(ctx: RouteContext<"/api/memories/[id]">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) throw new ApiError(404, "Memory not found.");
  const session = await requireApiSession();
  const memory = await getMemoryWithAssets(session.supabase, session.coupleId, id);
  if (!memory) throw new ApiError(404, "Memory not found.");
  return { session, memory };
}

/** Edit caption, date, location, tags or favorite status. */
export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/memories/[id]">) => {
  const { session, memory } = await loadMemory(ctx);
  const body = await parseBody(request, patchSchema);

  const update: Record<string, unknown> = {};
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.location !== undefined) update.location = body.location;
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.isFavorite !== undefined) update.is_favorite = body.isFavorite;
  if (body.day !== undefined && body.day !== memory.captured_day) {
    const { APP_TIMEZONE } = env();
    if (body.day > todayIn(APP_TIMEZONE, new Date(Date.now() + 36 * 3600 * 1000)) || body.day < "1900-01-01") {
      throw new ApiError(400, "That date doesn't look right.");
    }
    // Keep the original time of day; move it to the new date.
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIMEZONE,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(memory.captured_at));
    update.captured_day = body.day;
    update.captured_at = zonedTimeToUtc(body.day, time, APP_TIMEZONE).toISOString();
  }
  if (Object.keys(update).length === 0) throw new ApiError(400, "Nothing to update.");

  const { data, error } = await session.supabase
    .from("memories")
    .update(update)
    .eq("id", memory.id)
    .eq("couple_id", session.coupleId)
    .select("id, captured_day, captured_at, caption, location, tags, is_favorite, width, height, month_key")
    .single();
  if (error) throw error;

  const item = await toGalleryItem({ ...data, memory_assets: memory.memory_assets }, true);
  return NextResponse.json({ item, monthKey: data.month_key });
});

/** Permanently deletes a memory and its stored photo files. */
export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/memories/[id]">) => {
  const { session, memory } = await loadMemory(ctx);

  // Database first: RLS authorizes the delete; then remove the files.
  const { error, count } = await session.supabase
    .from("memories")
    .delete({ count: "exact" })
    .eq("id", memory.id)
    .eq("couple_id", session.coupleId);
  if (error) throw error;
  if (!count) throw new ApiError(404, "Memory not found.");

  await deleteObjects(Object.values(assetKeys(memory)).filter((k): k is string => Boolean(k))).catch((err) =>
    console.error("[memories] failed to delete files for", memory.id, err),
  );
  return new NextResponse(null, { status: 204 });
});
