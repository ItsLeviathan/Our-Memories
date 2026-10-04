import { NextResponse, type NextRequest } from "next/server";
import { listMonthMemories } from "@/lib/data/memories";
import { route } from "@/lib/http";
import { requireShare } from "@/lib/public-share";
import { createAdminClient } from "@/lib/supabase/admin";

/** Next page of a shared month's photos. Read-only; scoped to the shared month. */
export const GET = route(async (request: NextRequest, ctx: RouteContext<"/api/public/[token]/memories">) => {
  const share = await requireShare((await ctx.params).token, request.headers);
  const page = await listMonthMemories(createAdminClient(), {
    coupleId: share.coupleId,
    monthKey: share.monthKey,
    cursor: request.nextUrl.searchParams.get("cursor"),
  });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
});
