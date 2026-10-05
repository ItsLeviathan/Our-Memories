import { NextResponse, type NextRequest } from "next/server";
import { requireApiViewer } from "@/lib/auth";
import { listMonthMemories } from "@/lib/data/memories";
import { ApiError, route } from "@/lib/http";
import { parseMonthParam } from "@/lib/validation";

/** Next page of a month's gallery (progressive loading). Members and guests. */
export const GET = route(async (request: NextRequest, ctx: RouteContext<"/api/months/[month]/memories">) => {
  const monthKey = parseMonthParam((await ctx.params).month);
  if (!monthKey) throw new ApiError(404, "Month not found.");
  const viewer = await requireApiViewer(request.headers);
  const page = await listMonthMemories(viewer.client, {
    coupleId: viewer.coupleId,
    monthKey,
    cursor: request.nextUrl.searchParams.get("cursor"),
  });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
});
