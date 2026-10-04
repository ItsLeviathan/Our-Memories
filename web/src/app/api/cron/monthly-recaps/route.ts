import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rpcErrorCode } from "@/lib/http";
import { currentMonthKeyIn, previousMonthKey } from "@/lib/months";
import { createAdminClient } from "@/lib/supabase/admin";
import { triggerRecapWorker } from "@/lib/worker-trigger";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env().CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled by Vercel Cron (see vercel.json). Queues the recap of the most
 * recently completed month — determined in APP_TIMEZONE, not the server's
 * timezone. Safe to run any number of times: enqueue_recap never duplicates a
 * job and leaves ready or failed recaps untouched for scheduled runs. The
 * worker service picks queued jobs up.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monthKey = previousMonthKey(currentMonthKeyIn(env().APP_TIMEZONE));
  const admin = createAdminClient();
  const { data: couples, error } = await admin.from("couples").select("id");
  if (error) {
    console.error("[cron] could not list spaces", error.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const results: Record<string, string> = {};
  for (const { id } of couples ?? []) {
    const { data, error: enqueueError } = await admin
      .rpc("enqueue_recap", { p_couple_id: id, p_month_key: monthKey, p_trigger: "scheduled", p_force: false })
      .single<{ status: string }>();
    if (enqueueError) {
      const code = rpcErrorCode(enqueueError);
      results[id] = code === "no_memories" ? "skipped:no_memories" : `error:${code ?? "unknown"}`;
      if (!code) console.error("[cron] enqueue failed", id, enqueueError.message);
    } else {
      results[id] = data.status;
    }
  }

  if (Object.values(results).includes("queued")) await triggerRecapWorker();
  console.log("[cron] monthly recaps", monthKey, results);
  return NextResponse.json({ monthKey, results });
}
