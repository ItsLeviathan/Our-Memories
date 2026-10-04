import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { assetKeys, getMemoryWithAssets } from "@/lib/data/memories";
import { ApiError, route } from "@/lib/http";
import { signedDownloadUrl } from "@/lib/r2";

/** Redirects to a short-lived download URL for the HD photo. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/memories/[id]/download">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Memory not found.");
  const session = await requireApiSession();
  const memory = await getMemoryWithAssets(session.supabase, session.coupleId, id);
  const key = memory && (assetKeys(memory).hd ?? assetKeys(memory).display);
  if (!memory || !key) throw new ApiError(404, "Memory not found.");

  const ext = key.split(".").pop();
  const url = await signedDownloadUrl(key, `memory-${memory.captured_day}-${memory.id.slice(0, 8)}.${ext}`);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
});
