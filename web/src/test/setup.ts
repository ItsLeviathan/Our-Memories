// Deterministic, fake configuration for unit tests.
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "bucket",
  APP_URL: "https://memories.example.com",
  APP_TIMEZONE: "Asia/Manila",
  CRON_SECRET: "test-cron-secret-0123456789",
  SHARE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
});
