import { NextResponse } from "next/server";
import { getRecapRow } from "@/lib/data/recaps";
import { ApiError, route } from "@/lib/http";
import { requireShare } from "@/lib/public-share";
import { signedDownloadUrl } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

/** Recap MP4 download from a shared month — only if the link allows downloads. */
export const GET = route(async (request: Request, ctx: RouteContext<"/api/public/[token]/recap/download">) => {
  const share = await requireShare((await ctx.params).token, request.headers);
  if (!share.allowDownloads) throw new ApiError(403, "Downloads aren't enabled for this album.");
  const recap = await getRecapRow(createAdminClient(), share.coupleId, share.monthKey);
  if (!recap?.video_storage_key) throw new ApiError(404, "This recap isn't available.");
  const url = await signedDownloadUrl(recap.video_storage_key, `memories-${share.monthKey}.mp4`);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
});
