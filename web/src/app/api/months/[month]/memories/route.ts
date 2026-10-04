import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { listMonthMemories } from "@/lib/data/memories";
import { ApiError, route } from "@/lib/http";
import { parseMonthParam } from "@/lib/validation";

/** Next page of a month's gallery (progressive loading). */
export const GET = route(async (request: NextRequest, ctx: RouteContext<"/api/months/[month]/memories">) => {
  const monthKey = parseMonthParam((await ctx.params).month);
  if (!monthKey) throw new ApiError(404, "Month not found.");
  const session = await requireApiSession();
  const page = await listMonthMemories(session.supabase, {
    coupleId: session.coupleId,
    monthKey,
    cursor: request.nextUrl.searchParams.get("cursor"),
  });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
});
