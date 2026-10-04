// Creates worker/.env for local development from web/.env.local (shared Supabase + R2 values).
//   node --env-file=../web/.env.local scripts/env-from-web.mjs
import fs from "node:fs";
import { createRequire } from "node:module";

const e = process.env;
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static").split("\\").join("/");
fs.writeFileSync(
  ".env",
  [
    "# Generated from web/.env.local for local development. Never commit.",
    `SUPABASE_URL=${e.NEXT_PUBLIC_SUPABASE_URL}`,
    `SUPABASE_SERVICE_ROLE_KEY=${e.SUPABASE_SERVICE_ROLE_KEY}`,
    `R2_ACCOUNT_ID=${e.R2_ACCOUNT_ID}`,
    `R2_ACCESS_KEY_ID=${e.R2_ACCESS_KEY_ID}`,
    `R2_SECRET_ACCESS_KEY=${e.R2_SECRET_ACCESS_KEY}`,
    `R2_BUCKET_NAME=${e.R2_BUCKET_NAME}`,
    `FFMPEG_PATH=${ffmpeg}`,
    "WORKER_ID=local-dev",
    "POLL_INTERVAL_MS=5000",
    "PORT=8089",
    "",
  ].join("\n"),
);
console.log("worker/.env written");
