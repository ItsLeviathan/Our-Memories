-- =============================================================================
-- Our Memories — initial schema
--
-- Media (photos, recap videos) lives in Cloudflare R2. This database stores
-- only metadata. Every table has Row Level Security enabled; authenticated
-- users can only reach rows that belong to the couple they are a member of.
-- Public share-page access never touches these tables directly — it goes
-- through trusted server code that validates a hashed share token.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  couple_id     uuid not null references public.couples (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create index profiles_couple_id_idx on public.profiles (couple_id);

create table public.memories (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples (id) on delete cascade,
  uploaded_by   uuid references auth.users (id) on delete set null,
  -- The calendar day the memory belongs to, in the app's configured timezone.
  -- This is the authoritative value for monthly grouping.
  captured_day  date not null,
  -- Precise instant, used for chronological ordering within a day.
  captured_at   timestamptz not null,
  month_key     text generated always as (
                  lpad(extract(year from captured_day)::int::text, 4, '0') || '-' ||
                  lpad(extract(month from captured_day)::int::text, 2, '0')
                ) stored,
  caption       text check (caption is null or char_length(caption) <= 2000),
  location      text check (location is null or char_length(location) <= 200),
  tags          text[] not null default '{}' check (cardinality(tags) <= 20),
  is_favorite   boolean not null default false,
  status        text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  -- SHA-256 of the original upload; prevents the same photo being added twice.
  content_hash  text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  -- Dimensions of the processed image (aspect ratio drives the gallery layout).
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (couple_id, content_hash)
);

create index memories_couple_month_idx on public.memories (couple_id, month_key, captured_at, id);

create table public.memory_assets (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references public.memories (id) on delete cascade,
  couple_id    uuid not null references public.couples (id) on delete cascade,
  variant      text not null check (variant in ('thumb', 'display', 'hd')),
  storage_key  text not null unique,
  width        integer not null check (width > 0),
  height       integer not null check (height > 0),
  file_size    bigint not null check (file_size > 0),
  mime_type    text not null,
  created_at   timestamptz not null default now(),
  unique (memory_id, variant)
);

create index memory_assets_couple_idx on public.memory_assets (couple_id);

create table public.monthly_recaps (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples (id) on delete cascade,
  month_key           text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status              text not null default 'not_generated'
                        check (status in ('not_generated', 'queued', 'processing', 'ready', 'failed')),
  trigger             text not null default 'manual' check (trigger in ('manual', 'scheduled')),
  requested_by        uuid references auth.users (id) on delete set null,
  video_storage_key   text,
  poster_storage_key  text,
  duration_seconds    numeric(8, 2),
  photo_count         integer,
  video_size          bigint,
  attempts            integer not null default 0,
  max_attempts        integer not null default 3,
  next_attempt_at     timestamptz,
  locked_by           text,
  queued_at           timestamptz,
  started_at          timestamptz,
  heartbeat_at        timestamptz,
  generated_at        timestamptz,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (couple_id, month_key)
);

create index monthly_recaps_queue_idx on public.monthly_recaps (status, queued_at)
  where status in ('queued', 'processing');

create table public.share_links (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples (id) on delete cascade,
  month_key        text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- SHA-256 (hex) of the share token. The token itself is never stored.
  token_hash       text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  -- AES-256-GCM encrypted token (server-side key) so members can copy the link
  -- again later. Lookups never use it; they use token_hash.
  token_encrypted  text not null,
  allow_downloads  boolean not null default false,
  active           boolean not null default true,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz,
  revoked_at       timestamptz
);

-- At most one active link per month.
create unique index share_links_one_active_idx on public.share_links (couple_id, month_key) where active;

create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

create trigger monthly_recaps_touch before update on public.monthly_recaps
  for each row execute function public.touch_updated_at();

-- A space belongs to exactly two people.
create or replace function public.enforce_couple_size()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.profiles where couple_id = new.couple_id and id <> new.id) >= 2 then
    raise exception 'A memory space can only have two members';
  end if;
  return new;
end;
$$;

create trigger profiles_couple_size before insert or update of couple_id on public.profiles
  for each row execute function public.enforce_couple_size();

-- Memories and their assets cannot be moved between couples, and authorship is fixed.
create or replace function public.protect_memory_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.couple_id <> old.couple_id or new.uploaded_by is distinct from old.uploaded_by
     or new.content_hash is distinct from old.content_hash then
    raise exception 'Memory ownership fields are immutable';
  end if;
  return new;
end;
$$;

create trigger memories_protect_ownership before update on public.memories
  for each row execute function public.protect_memory_ownership();

-- -----------------------------------------------------------------------------
-- Membership helpers (security definer so policies don't recurse into profiles RLS)
-- -----------------------------------------------------------------------------

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where user_id = auth.uid() and couple_id = p_couple_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.couples        enable row level security;
alter table public.profiles       enable row level security;
alter table public.memories       enable row level security;
alter table public.memory_assets  enable row level security;
alter table public.monthly_recaps enable row level security;
alter table public.share_links    enable row level security;
alter table public.rate_limits    enable row level security;

-- couples: members can read their space. Created/edited only by an administrator.
create policy couples_select on public.couples
  for select to authenticated using (public.is_couple_member(id));

-- profiles: members see both profiles in their space; each person edits only their own.
create policy profiles_select on public.profiles
  for select to authenticated using (couple_id = public.current_couple_id());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = public.current_couple_id());

-- memories: full access for members of the owning couple.
create policy memories_select on public.memories
  for select to authenticated using (public.is_couple_member(couple_id));
create policy memories_insert on public.memories
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and uploaded_by = auth.uid());
create policy memories_update on public.memories
  for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));
create policy memories_delete on public.memories
  for delete to authenticated using (public.is_couple_member(couple_id));

-- memory_assets: members only, and the asset must belong to a memory in the same couple.
create policy memory_assets_select on public.memory_assets
  for select to authenticated using (public.is_couple_member(couple_id));
create policy memory_assets_insert on public.memory_assets
  for insert to authenticated
  with check (
    public.is_couple_member(couple_id)
    and exists (select 1 from public.memories m where m.id = memory_id and m.couple_id = memory_assets.couple_id)
  );
create policy memory_assets_delete on public.memory_assets
  for delete to authenticated using (public.is_couple_member(couple_id));

-- monthly_recaps: read-only for members; writes go through enqueue_recap() or the worker.
create policy monthly_recaps_select on public.monthly_recaps
  for select to authenticated using (public.is_couple_member(couple_id));

-- share_links: read-only for members; writes go through create/revoke functions.
create policy share_links_select on public.share_links
  for select to authenticated using (public.is_couple_member(couple_id));

-- rate_limits: no policies — only reachable through check_rate_limit() / service role.

-- -----------------------------------------------------------------------------
-- Month summaries (security invoker: RLS applies)
-- -----------------------------------------------------------------------------

create or replace function public.get_month_summaries()
returns table (
  month_key          text,
  memory_count       bigint,
  day_count          bigint,
  favorite_count     bigint,
  first_day          date,
  last_day           date,
  cover_memory_id    uuid,
  cover_thumb_key    text,
  cover_width        integer,
  cover_height       integer,
  recap_status       text,
  share_active       boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select m.couple_id, m.month_key,
           count(*)                      as memory_count,
           count(distinct m.captured_day) as day_count,
           count(*) filter (where m.is_favorite) as favorite_count,
           min(m.captured_day)           as first_day,
           max(m.captured_day)           as last_day
    from public.memories m
    where m.status = 'ready'
    group by m.couple_id, m.month_key
  )
  select mo.month_key, mo.memory_count, mo.day_count, mo.favorite_count, mo.first_day, mo.last_day,
         cover.id, cover.storage_key, cover.width, cover.height,
         coalesce(r.status, 'not_generated'),
         exists (
           select 1 from public.share_links s
           where s.couple_id = mo.couple_id and s.month_key = mo.month_key and s.active
             and (s.expires_at is null or s.expires_at > now())
         )
  from months mo
  left join public.monthly_recaps r on r.couple_id = mo.couple_id and r.month_key = mo.month_key
  left join lateral (
    select m.id, a.storage_key, a.width, a.height
    from public.memories m
    join public.memory_assets a on a.memory_id = m.id and a.variant = 'thumb'
    where m.couple_id = mo.couple_id and m.month_key = mo.month_key and m.status = 'ready'
    order by m.is_favorite desc, m.captured_at desc, m.id
    limit 1
  ) cover on true
  order by mo.month_key desc;
$$;

-- -----------------------------------------------------------------------------
-- Recap job queue
-- -----------------------------------------------------------------------------

-- Requests generation of a month's recap. Idempotent and duplicate-safe:
--   * queued/processing  -> returned unchanged (no second job)
--   * ready              -> unchanged unless p_force (manual "Regenerate")
--   * failed             -> re-queued for manual requests; left alone for scheduled runs
-- Callable by couple members (manual) and by the service role (scheduler).
create or replace function public.enqueue_recap(
  p_couple_id uuid,
  p_month_key text,
  p_trigger   text default 'manual',
  p_force     boolean default false
)
returns public.monthly_recaps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        public.monthly_recaps;
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_count      bigint;
  v_active     bigint;
begin
  if not v_is_service and not public.is_couple_member(p_couple_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_trigger not in ('manual', 'scheduled') then
    raise exception 'invalid_trigger';
  end if;
  if p_trigger = 'scheduled' and not v_is_service then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month';
  end if;

  insert into public.monthly_recaps (couple_id, month_key, trigger)
  values (p_couple_id, p_month_key, p_trigger)
  on conflict (couple_id, month_key) do nothing;

  select * into v_row from public.monthly_recaps
  where couple_id = p_couple_id and month_key = p_month_key
  for update;

  if v_row.status in ('queued', 'processing') then
    return v_row;
  end if;
  if v_row.status = 'ready' and not p_force then
    return v_row;
  end if;
  if v_row.status = 'failed' and p_trigger = 'scheduled' then
    return v_row;
  end if;

  select count(*) into v_count from public.memories
  where couple_id = p_couple_id and month_key = p_month_key and status = 'ready';
  if v_count = 0 then
    raise exception 'no_memories';
  end if;

  -- Hard cap on concurrent work per space, so nothing can flood the worker.
  select count(*) into v_active from public.monthly_recaps
  where couple_id = p_couple_id and status in ('queued', 'processing');
  if v_active >= 3 then
    raise exception 'too_many_jobs';
  end if;

  update public.monthly_recaps set
    status          = 'queued',
    trigger         = p_trigger,
    requested_by    = case when v_is_service then null else auth.uid() end,
    attempts        = 0,
    next_attempt_at = null,
    locked_by       = null,
    queued_at       = now(),
    started_at      = null,
    heartbeat_at    = null,
    error_message   = null
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- Worker: recover stalled jobs, then atomically claim the next queued job.
create or replace function public.claim_recap_job(p_worker_id text, p_stale_seconds integer default 900)
returns setof public.monthly_recaps
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Jobs whose worker stopped heart-beating are retried or failed.
  update public.monthly_recaps set
    status          = case when attempts >= max_attempts then 'failed' else 'queued' end,
    error_message   = case when attempts >= max_attempts
                        then 'Generation timed out. Please try again.' else error_message end,
    next_attempt_at = null,
    locked_by       = null
  where status = 'processing'
    and coalesce(heartbeat_at, started_at, queued_at) < now() - make_interval(secs => p_stale_seconds);

  return query
  update public.monthly_recaps r set
    status       = 'processing',
    attempts     = r.attempts + 1,
    locked_by    = p_worker_id,
    started_at   = now(),
    heartbeat_at = now()
  where r.id = (
    select q.id from public.monthly_recaps q
    where q.status = 'queued' and (q.next_attempt_at is null or q.next_attempt_at <= now())
    order by q.queued_at nulls first
    for update skip locked
    limit 1
  )
  returning r.*;
end;
$$;

-- -----------------------------------------------------------------------------
-- Share links
-- -----------------------------------------------------------------------------

-- Creates (or regenerates) the share link for a month. Any previous active link
-- for that month is revoked in the same transaction. The caller generates the
-- random token server-side and passes only its hash.
create or replace function public.create_share_link(
  p_couple_id       uuid,
  p_month_key       text,
  p_token_hash      text,
  p_token_encrypted text,
  p_allow_downloads boolean default false,
  p_expires_at      timestamptz default null
)
returns public.share_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.share_links;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  update public.share_links set active = false, revoked_at = now()
  where couple_id = p_couple_id and month_key = p_month_key and active;

  insert into public.share_links (couple_id, month_key, token_hash, token_encrypted, allow_downloads, created_by, expires_at)
  values (p_couple_id, p_month_key, p_token_hash, p_token_encrypted, p_allow_downloads, auth.uid(), p_expires_at)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.revoke_share_link(p_couple_id uuid, p_month_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.share_links set active = false, revoked_at = now()
  where couple_id = p_couple_id and month_key = p_month_key and active;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the request is allowed.
-- Server-side only (service role).
-- -----------------------------------------------------------------------------

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup of old windows.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges. Supabase grants EXECUTE to anon by default — lock functions down.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

revoke execute on function public.current_couple_id()                          from public, anon;
revoke execute on function public.is_couple_member(uuid)                       from public, anon;
revoke execute on function public.get_month_summaries()                        from public, anon;
revoke execute on function public.enqueue_recap(uuid, text, text, boolean)     from public, anon;
revoke execute on function public.create_share_link(uuid, text, text, text, boolean, timestamptz) from public, anon;
revoke execute on function public.revoke_share_link(uuid, text)                from public, anon;
revoke execute on function public.claim_recap_job(text, integer)               from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer)     from public, anon, authenticated;
revoke execute on function public.touch_updated_at()                           from public, anon, authenticated;
revoke execute on function public.enforce_couple_size()                        from public, anon, authenticated;
revoke execute on function public.protect_memory_ownership()                   from public, anon, authenticated;

grant execute on function public.current_couple_id()                          to authenticated;
grant execute on function public.is_couple_member(uuid)                       to authenticated;
grant execute on function public.get_month_summaries()                        to authenticated;
grant execute on function public.enqueue_recap(uuid, text, text, boolean)     to authenticated, service_role;
grant execute on function public.create_share_link(uuid, text, text, text, boolean, timestamptz) to authenticated;
grant execute on function public.revoke_share_link(uuid, text)                to authenticated;
grant execute on function public.claim_recap_job(text, integer)               to service_role;
grant execute on function public.check_rate_limit(text, integer, integer)     to service_role;
