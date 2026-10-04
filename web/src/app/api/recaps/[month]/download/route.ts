import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { getRecapRow } from "@/lib/data/recaps";
import { ApiError, route } from "@/lib/http";
import { signedDownloadUrl } from "@/lib/r2";
import { parseMonthParam } from "@/lib/validation";

/** Redirects to a short-lived MP4 download URL. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/recaps/[month]/download">) => {
  const monthKey = parseMonthParam((await ctx.params).month);
  if (!monthKey) throw new ApiError(404, "Month not found.");
  const session = await requireApiSession();
  const recap = await getRecapRow(session.supabase, session.coupleId, monthKey);
  if (!recap?.video_storage_key) throw new ApiError(404, "This recap isn't ready yet.");
  const url = await signedDownloadUrl(recap.video_storage_key, `our-memories-${monthKey}.mp4`);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
});
