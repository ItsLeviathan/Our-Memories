import { NextResponse } from "next/server";
import { z } from "zod";
import { assetKeys, getMemoryWithAssets } from "@/lib/data/memories";
import { ApiError, route } from "@/lib/http";
import { requireShare } from "@/lib/public-share";
import { signedDownloadUrl } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

/** HD photo download from a shared month — only if the link allows downloads. */
export const GET = route(
  async (request: Request, ctx: RouteContext<"/api/public/[token]/memories/[id]/download">) => {
    const { token, id } = await ctx.params;
    const share = await requireShare(token, request.headers);
    if (!share.allowDownloads) throw new ApiError(403, "Downloads aren't enabled for this album.");
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "Photo not found.");

    const memory = await getMemoryWithAssets(createAdminClient(), share.coupleId, id);
    // The photo must belong to the shared month — no reaching into other months.
    if (!memory || memory.captured_day.slice(0, 7) !== share.monthKey) throw new ApiError(404, "Photo not found.");
    const key = assetKeys(memory).hd ?? assetKeys(memory).display;
    if (!key) throw new ApiError(404, "Photo not found.");

    const url = await signedDownloadUrl(key, `memory-${memory.captured_day}-${memory.id.slice(0, 8)}.${key.split(".").pop()}`);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  },
);
