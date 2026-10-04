# Our Memories

A private photo journal for two. Upload photos throughout the month, see them in an editorial gallery, get a cinematic video recap of every month, and share a month with anyone through a private, read-only link.

```
web/        Next.js 16 app (Vercel) — UI, API, auth, uploads, sharing, cron trigger
worker/     Recap video worker (Docker + ffmpeg) — renders monthly MP4s
supabase/   Database schema, RLS policies, job queue, tests, seed template
```

## Architecture

```
Browser ──presigned PUT──▶ R2  tmp/<couple>/<id>        (original, short-lived)
   │
   └──▶ POST /api/memories ──▶ sharp: thumb 800 · display 1600 (WebP) · HD 2560 (JPEG)
                                  ├─▶ R2  media/<couple>/<memory>/{thumb,display,hd}
                                  ├─▶ Supabase: memories + memory_assets (RLS)
                                  └─▶ delete original from tmp/

Generate (button) or Vercel Cron (daily) ──▶ enqueue_recap()  ─ idempotent, deduplicated
                                                 │
                         worker: claim_recap_job() (FOR UPDATE SKIP LOCKED)
                                 render with ffmpeg ─▶ R2 recaps/… ─▶ status = ready

/m/<token> ──▶ server hashes token ─▶ share_links lookup (service role) ─▶ read-only album
```

**Why the pieces are split this way:**

- **Uploads go straight to R2.** Vercel functions cap request bodies at ~4.5 MB, and phone photos are often bigger. The browser PUTs the original to a temporary key using a presigned URL that is locked to its content type and exact size. The server then fetches it, verifies its SHA-256, and makes the optimized versions.
- **The original is not kept.** The 2560px HD JPEG (quality 90, 4:4:4) is visually indistinguishable when viewed or downloaded. Every stored file is auto-rotated, and EXIF data (including GPS location) is removed.
- **Video runs in a separate worker.** Encoding a recap can take minutes, which doesn't fit a serverless request. The web app only puts jobs in a queue. The worker is a small, isolated long-running container.
- **Postgres is the job queue.** There's no extra infrastructure. Jobs are claimed atomically, and the worker sends heartbeats so a crashed worker's job is picked up again. A retry limit with backoff, a hard timeout and a cap on concurrent jobs keep anything from running away.

## Security model

| Concern | How it's handled |
| --- | --- |
| Who can sign in | Two accounts created by hand in Supabase. Public sign-up is disabled, and the app has no sign-up page. |
| Data isolation | RLS on every table. A user only reaches rows of the couple they belong to (`is_couple_member`). Recap and share writes go only through `security definer` functions that check membership. |
| Privileged keys | `SUPABASE_SERVICE_ROLE_KEY`, the R2 keys and `SHARE_TOKEN_ENCRYPTION_KEY` are only read in `server-only` modules. The browser gets only the Supabase URL and anon key. |
| Media access | The R2 bucket is private. Images and videos are served through presigned URLs that expire after about 6 hours. Downloads use 5-minute URLs. |
| Share links | 256-bit random tokens. The database stores only the SHA-256 hash, which is what lookups use, plus an AES-256-GCM encrypted copy so you can copy the link again later. Revoking a link takes effect immediately. Each link is scoped to exactly one month. |
| Brute force / abuse | Rate limits backed by Postgres apply to uploads, recap requests, share creation and all public endpoints (per IP). Supabase Auth rate-limits sign-in. |
| Uploads | Type allow-list and size limit (enforced in the presigned signature), content hash check, decoding by sharp with a pixel limit, and no SVG. |
| Web | Strict CSP, `frame-ancestors 'none'`, `Referrer-Policy: same-origin` (tokens never leak via Referer), `noindex` on share pages, Origin check on writes, SameSite cookies. |
| Errors | API routes return only friendly messages. Details are logged on the server. |

## Setup

### 1. Supabase

1. Create a project.
2. Run `supabase/migrations/20261004000000_initial_schema.sql` in the SQL editor, or `supabase db push` with the CLI.
3. **Authentication → Sign In / Providers → Email:** turn off *Allow new users to sign up*.
4. **Authentication → Users → Add user:** create both accounts with *Auto Confirm* on.
5. Edit and run `supabase/seed.example.sql` to create your space and link both accounts to it.

### 2. Cloudflare R2

1. Create a bucket, for example `our-memories`. Keep it **private** and don't attach a public domain.
2. Create an API token with **Object Read & Write** on that bucket. Note the account ID, access key ID and secret.
3. **CORS policy.** The browser uploads directly to R2, so the bucket needs this policy. Replace the origins with yours:

   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **Lifecycle rule:** delete objects with prefix `tmp/` after 1 day. This cleans up abandoned uploads.

### 3. Web app on Vercel

1. Import the repository and set **Root Directory** to `web`.
2. Add every variable from `web/.env.example`. Generate the two secrets:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # CRON_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # SHARE_TOKEN_ENCRYPTION_KEY
   ```

3. Set `APP_URL` to the production URL and `APP_TIMEZONE` to your IANA timezone.
4. Deploy. `web/vercel.json` registers the daily cron (`/api/cron/monthly-recaps`, 06:00 UTC). On each run it queues the recap for the most recently *completed* month in `APP_TIMEZONE`. It's idempotent, so running it daily is safe: recaps that are ready or already in progress are left alone.

### 4. Recap worker

Any container host that runs a long-lived process works, such as Fly.io, Railway, Render or a small VPS. For example:

```bash
cd worker
docker build -t our-memories-worker .
docker run --env-file .env our-memories-worker
```

Use the variables in `worker/.env.example`: the same Supabase project and R2 bucket. One instance is enough. Running several instances is safe, because jobs are claimed atomically. The container serves a health check on `PORT` (`GET /`).

### Local development

```bash
cd web && cp .env.example .env.local   # fill in values
npm install && npm run dev             # http://localhost:3000

cd worker && cp .env.example .env
npm install && npm run dev             # needs ffmpeg on PATH, or set FFMPEG_PATH
```

## Testing

```bash
cd supabase/tests && npm install && npm test   # schema + RLS + job queue + share links (PGlite)
cd web && npm test                              # layout, timezones, image pipeline, token crypto
cd web && npm run typecheck && npm run lint && npm run build
cd worker && npm test                           # recap planning
cd worker && npm run render:sample              # renders out/sample-recap.mp4 with real ffmpeg
cd worker && npm run render:sample -- 120       # big month (photo cap + chunked assembly)
```

The database tests apply the real migration to an in-process Postgres with Supabase's `auth` schema and roles emulated. They check that:

- one couple can't read or change another couple's data
- anonymous users can't touch any table or function
- recap generation can't be duplicated, faked as "scheduled", or run on an empty month
- stalled jobs are recovered and exhausted ones fail
- regenerating a link revokes the old one immediately
- the rate limiter blocks requests over the limit

## Design notes

- Warm neutral palette with a single muted clay accent, used for favorites, focus and selection. Geist for UI, Instrument Serif italic for the occasional editorial line. Light and dark follow the system. The public album is always dark and cinematic.
- The gallery is a justified-rows layout that never crops or distorts. Favorites get a larger featured row. Photos load progressively, 48 at a time, as you scroll, with thumb and display sizes picked by `srcset`. HD loads only in the fullscreen viewer on large screens.
- The viewer supports keyboard (← → Esc), swipe left and right, swipe down to close, and tap to hide the controls.
- The recap uses restrained Ken Burns motion (≤ 8% zoom) and 0.9s crossfades. Portrait photos are shown whole over a soft blurred fill. The date appears only on the first photo of each day. The opening card reads "October 2026 — *A month of us.*" and the closing card shows the counts. All copy can be changed with environment variables.
- All motion respects `prefers-reduced-motion`.

## Ready for later

The schema already supports tags, locations and favorites, and assets are modelled per variant. That leaves room for short videos, voice notes, yearly recaps, "On This Day", search and a map without restructuring. Recap copy is configurable, and the worker's plan/render split makes new recap styles a contained change.
