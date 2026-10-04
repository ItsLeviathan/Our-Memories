import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Wraps a route handler: known ApiErrors become friendly JSON responses, and
 * anything unexpected is logged server-side and reported generically — raw
 * backend errors and stack traces never reach the browser.
 */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.message, err.code);
      console.error("[api] unexpected error", err);
      return jsonError(500, "Something went wrong. Please try again.");
    }
  };
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "Invalid request.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "Some details look invalid. Please check and try again.");
  return parsed.data;
}

/** Postgres error text from a Supabase RPC that raised a known exception. */
export function rpcErrorCode(error: { message?: string } | null): string | null {
  const match = error?.message?.match(/^(not_authorized|no_memories|too_many_jobs|invalid_month|invalid_expiry)/);
  return match ? match[1] : null;
}
