import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicCoupleId } from "@/lib/data/public-space";
import { ApiError } from "@/lib/http";
import { clientIp, enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface Session {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  coupleId: string;
  displayName: string;
}

/**
 * Resolves the signed-in user and their memory space, verified server-side.
 * Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null | "no_space"> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return "no_space";

  return { supabase, userId, coupleId: profile.couple_id, displayName: profile.display_name };
});

/** For pages: redirects to login when there is no valid session. */
export async function requirePageSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) redirect("/login");
  if (session === "no_space") redirect("/login?error=no_space");
  return session;
}

/** For route handlers: throws a 401/403 ApiError when unauthenticated. */
export async function requireApiSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) throw new ApiError(401, "Please sign in again.");
  if (session === "no_space") throw new ApiError(403, "This account isn't part of a memory space.");
  return session;
}

/**
 * Who is looking at a read-only page: a signed-in member (RLS-scoped client), or
 * a signed-out guest browsing the public space (service-role client; every query
 * must filter by `coupleId`). Guests can view months and photos, nothing more.
 */
export type Viewer =
  | { kind: "member"; client: SupabaseClient; coupleId: string; session: Session }
  | { kind: "guest"; client: SupabaseClient; coupleId: string };

const getGuestViewer = cache(async (): Promise<Viewer | null> => {
  const coupleId = await getPublicCoupleId();
  return coupleId ? { kind: "guest", client: createAdminClient(), coupleId } : null;
});

/** Counts once per page render (layout and page both ask). */
const guestPageAllowed = cache(async () => rateLimit(`guest:${clientIp(await headers())}`, 600, 600));

/** For read-only pages: a member, or a guest when public viewing is available; otherwise to login. */
export async function requirePageViewer(): Promise<Viewer> {
  const session = await getSession();
  if (session === "no_space") redirect("/login?error=no_space");
  if (session) return { kind: "member", client: session.supabase as SupabaseClient, coupleId: session.coupleId, session };
  const guest = await getGuestViewer();
  if (!guest) redirect("/login");
  if (!(await guestPageAllowed())) redirect("/login?error=rate_limited");
  return guest;
}

/** For read-only route handlers: a member, or a rate-limited guest. */
export async function requireApiViewer(requestHeaders: Headers): Promise<Viewer> {
  const session = await getSession();
  if (session === "no_space") throw new ApiError(403, "This account isn't part of a memory space.");
  if (session) return { kind: "member", client: session.supabase as SupabaseClient, coupleId: session.coupleId, session };
  const guest = await getGuestViewer();
  if (!guest) throw new ApiError(401, "Please sign in again.");
  await enforceRateLimit(`guest:${clientIp(requestHeaders)}`, 600, 600);
  return guest;
}
