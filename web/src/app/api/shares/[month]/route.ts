import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { getActiveShare } from "@/lib/data/shares";
import { ApiError, parseBody, route, rpcErrorCode } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { encryptShareToken, generateShareToken, hashShareToken } from "@/lib/tokens";
import { parseMonthParam } from "@/lib/validation";

async function monthFrom(ctx: RouteContext<"/api/shares/[month]">) {
  const monthKey = parseMonthParam((await ctx.params).month);
  if (!monthKey) throw new ApiError(404, "Month not found.");
  return monthKey;
}

const createSchema = z.object({
  allowDownloads: z.boolean().default(false),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).nullable().default(null),
});

/**
 * Creates the month's share link — or regenerates it, which immediately
 * invalidates the previous link.
 */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/shares/[month]">) => {
  const monthKey = await monthFrom(ctx);
  const session = await requireApiSession();
  await enforceRateLimit(`share:${session.userId}`, 30, 3600);
  const body = await parseBody(request, createSchema);

  const { count } = await session.supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", session.coupleId)
    .eq("month_key", monthKey);
  if (!count) throw new ApiError(400, "Add some memories to this month before sharing it.");

  const token = generateShareToken();
  const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null;

  const { error } = await session.supabase.rpc("create_share_link", {
    p_couple_id: session.coupleId,
    p_month_key: monthKey,
    p_token_hash: hashShareToken(token),
    p_token_encrypted: encryptShareToken(token),
    p_allow_downloads: body.allowDownloads,
    p_expires_at: expiresAt,
  });
  if (error) {
    if (rpcErrorCode(error) === "not_authorized") throw new ApiError(403, "You can't share this month.");
    throw error;
  }

  const share = await getActiveShare(session.supabase, session.coupleId, monthKey);
  return NextResponse.json(share, { status: 201 });
});

/** Revokes the month's share link. Takes effect immediately. */
export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/shares/[month]">) => {
  const monthKey = await monthFrom(ctx);
  const session = await requireApiSession();
  const { error } = await session.supabase.rpc("revoke_share_link", {
    p_couple_id: session.coupleId,
    p_month_key: monthKey,
  });
  if (error) throw error;
  return new NextResponse(null, { status: 204 });
});
