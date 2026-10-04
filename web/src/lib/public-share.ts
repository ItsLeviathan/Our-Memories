import "server-only";
import { resolveShareToken, type ResolvedShare } from "@/lib/data/shares";
import { ApiError } from "@/lib/http";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

/**
 * Guards every public share endpoint: per-IP rate limit (slows token
 * guessing to a crawl on top of 256-bit tokens), then token validation.
 * An invalid, revoked or expired token is indistinguishable from "not found".
 */
export async function requireShare(token: string, headers: Headers): Promise<ResolvedShare> {
  await enforceRateLimit(`public:${clientIp(headers)}`, 600, 600);
  const share = await resolveShareToken(token);
  if (!share) throw new ApiError(404, "This link is no longer available.");
  return share;
}
