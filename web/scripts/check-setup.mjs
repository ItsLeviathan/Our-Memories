/* eslint-disable @typescript-eslint/no-unused-expressions -- ternary logging style */
// Verifies the local configuration end to end without printing secrets.
//   node --env-file=.env.local scripts/check-setup.mjs
import {
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = process.env;
let failures = 0;
const ok = (label, detail = "") => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
const bad = (label, detail = "") => {
  failures++;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
};

console.log("\nEnvironment");
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
  "APP_URL", "APP_TIMEZONE", "CRON_SECRET", "SHARE_TOKEN_ENCRYPTION_KEY",
]) {
  const v = env[name];
  if (!v || v.startsWith("your-")) bad(name, "missing or still a placeholder");
  else if (/\s|^["']/.test(v)) bad(name, "contains spaces or quotes");
  else ok(name);
}

console.log("\nSupabase");
try {
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=display_name`, { headers: h });
  const rows = await res.json();
  if (res.ok) ok("database reachable", `${rows.length} member(s): ${rows.map((r) => r.display_name).join(", ")}`);
  else bad("database", rows.message);
  const settings = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } })).json();
  settings.disable_signup ? ok("public sign-up disabled") : bad("public sign-up is ENABLED");
} catch (e) {
  bad("Supabase connection", e.message);
}

console.log("\nCloudflare R2");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID ?? "", secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "" },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const Bucket = env.R2_BUCKET_NAME;
const Key = `tmp/setup-check-${Date.now()}.txt`;
const body = "our memories setup check";
const origin = env.APP_URL?.replace(/\/$/, "");

try {
  // Same flow as the browser: presigned PUT with signed content type + length.
  const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key, ContentType: "text/plain", ContentLength: body.length }), { expiresIn: 300 });

  const preflight = await fetch(putUrl, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
  });
  const allowed = preflight.headers.get("access-control-allow-origin");
  allowed === origin || allowed === "*"
    ? ok("CORS allows browser uploads", `from ${origin}`)
    : bad("CORS", `browser uploads from ${origin} would be blocked (status ${preflight.status}). Check the bucket's CORS policy.`);

  const put = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": "text/plain", Origin: origin }, body });
  put.ok ? ok("signed upload works") : bad("signed upload", `HTTP ${put.status}: ${(await put.text()).slice(0, 160)}`);

  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
  const got = await fetch(getUrl);
  (await got.text()) === body ? ok("signed download works") : bad("signed download", `HTTP ${got.status}`);

  const anonymous = await fetch(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${Bucket}/${Key}`);
  anonymous.ok ? bad("bucket is PUBLIC — anyone could read photos") : ok("bucket is private", `unsigned access → ${anonymous.status}`);

  await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  ok("delete works", "test file removed");
} catch (e) {
  bad("R2", e.name === "InvalidAccessKeyId" || e.name === "SignatureDoesNotMatch" ? "access key or secret is wrong" : e.message);
}

try {
  const lc = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket }));
  const rule = (lc.Rules ?? []).find((r) => (r.Filter?.Prefix ?? r.Prefix) === "tmp/" && r.Status === "Enabled" && r.Expiration?.Days);
  rule ? ok("tmp/ cleanup rule", `deletes after ${rule.Expiration.Days} day(s)`) : console.log("  ! tmp/ cleanup rule not found (optional, but recommended)");
} catch {
  console.log("  ! could not read lifecycle rules (token may lack permission — fine, optional check)");
}

console.log(failures ? `\n${failures} problem(s) found.\n` : "\nEverything is set up correctly.\n");
process.exit(failures ? 1 : 0);
