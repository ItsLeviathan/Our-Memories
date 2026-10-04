import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { getRecap, toRecapInfo, type RecapRow } from "@/lib/data/recaps";
import { ApiError, parseBody, route, rpcErrorCode } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseMonthParam } from "@/lib/validation";
import { triggerRecapWorker } from "@/lib/worker-trigger";

async function monthFrom(ctx: RouteContext<"/api/recaps/[month]">) {
  const monthKey = parseMonthParam((await ctx.params).month);
  if (!monthKey) throw new ApiError(404, "Month not found.");
  return monthKey;
}

/** Current recap state (polled by the dashboard while generating). */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/recaps/[month]">) => {
  const monthKey = await monthFrom(ctx);
  const session = await requireApiSession();
  const recap = await getRecap(session.supabase, session.coupleId, monthKey);
  return NextResponse.json(recap, { headers: { "Cache-Control": "private, no-store" } });
});

const ENQUEUE_ERRORS: Record<string, [number, string]> = {
  no_memories: [400, "Add some memories to this month first."],
  too_many_jobs: [429, "A few recaps are already being made. Try again once they finish."],
  not_authorized: [403, "You can't generate this recap."],
  invalid_month: [400, "Month not found."],
};

/**
 * Requests (re)generation. The database function is idempotent: a recap that
 * is already queued or processing is returned as-is, never duplicated.
 */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/recaps/[month]">) => {
  const monthKey = await monthFrom(ctx);
  const session = await requireApiSession();
  const { force } = await parseBody(request, z.object({ force: z.boolean().default(false) }));
  await enforceRateLimit(`recap:${session.coupleId}`, 12, 3600);

  const { data, error } = await session.supabase
    .rpc("enqueue_recap", { p_couple_id: session.coupleId, p_month_key: monthKey, p_trigger: "manual", p_force: force })
    .single();
  if (error) {
    const code = rpcErrorCode(error);
    if (code && ENQUEUE_ERRORS[code]) throw new ApiError(...ENQUEUE_ERRORS[code], code);
    throw error;
  }
  const recap = data as RecapRow;
  // Wake the worker without delaying the response.
  if (recap.status === "queued") after(triggerRecapWorker);
  return NextResponse.json(await toRecapInfo(recap), { status: 202 });
});
