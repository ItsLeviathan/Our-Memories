import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Validated lazily on first use so that `next build`
 * does not require production secrets to be present.
 */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),

  APP_URL: z.url(),
  APP_TIMEZONE: z.string().default("UTC"),

  CRON_SECRET: z.string().min(16),
  SHARE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded"),

  UPLOAD_MAX_MB: z.coerce.number().positive().default(40),

  // Optional: which memory space signed-out visitors can browse (read-only).
  // Defaults to the only space when there is exactly one.
  PUBLIC_COUPLE_ID: z.preprocess(emptyToUndefined, z.uuid().optional()),

  // Optional: start the GitHub Actions recap worker instantly (see .github/workflows).
  GITHUB_DISPATCH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  GITHUB_REPOSITORY: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must look like owner/repo").optional(),
  ),
  GITHUB_WORKFLOW: z.string().default("recap-worker.yml"),
  GITHUB_REF: z.string().default("main"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  if (!isValidTimeZone(parsed.data.APP_TIMEZONE)) {
    throw new Error(`APP_TIMEZONE is not a valid IANA timezone: ${parsed.data.APP_TIMEZONE}`);
  }
  cached = parsed.data;
  return cached;
}

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
