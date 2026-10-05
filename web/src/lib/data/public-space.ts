import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * The memory space visitors see when they aren't signed in: PUBLIC_COUPLE_ID if
 * set, otherwise the only space in the database. Returns null (guests must sign
 * in) when neither applies, e.g. several spaces and no explicit choice.
 */
export const getPublicCoupleId = cache(async (): Promise<string | null> => {
  const configured = env().PUBLIC_COUPLE_ID;
  if (configured) return configured;
  const { data, error } = await createAdminClient().from("couples").select("id").limit(2);
  if (error) throw error;
  return data?.length === 1 ? (data[0].id as string) : null;
});
