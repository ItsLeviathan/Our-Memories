import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";

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
