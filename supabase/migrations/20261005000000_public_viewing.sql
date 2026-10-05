-- =============================================================================
-- Public read-only viewing
--
-- Visitors who aren't signed in can browse the months of one memory space.
-- Their requests are served by trusted server code with the service role, so
-- this variant of get_month_summaries takes the couple explicitly and is only
-- executable by the service role.
-- =============================================================================

create or replace function public.get_couple_month_summaries(p_couple_id uuid)
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
  recap_status       text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select m.month_key,
           count(*)                      as memory_count,
           count(distinct m.captured_day) as day_count,
           count(*) filter (where m.is_favorite) as favorite_count,
           min(m.captured_day)           as first_day,
           max(m.captured_day)           as last_day
    from public.memories m
    where m.couple_id = p_couple_id and m.status = 'ready'
    group by m.month_key
  )
  select mo.month_key, mo.memory_count, mo.day_count, mo.favorite_count, mo.first_day, mo.last_day,
         cover.id, cover.storage_key, cover.width, cover.height,
         coalesce(r.status, 'not_generated')
  from months mo
  left join public.monthly_recaps r on r.couple_id = p_couple_id and r.month_key = mo.month_key
  left join lateral (
    select m.id, a.storage_key, a.width, a.height
    from public.memories m
    join public.memory_assets a on a.memory_id = m.id and a.variant = 'thumb'
    where m.couple_id = p_couple_id and m.month_key = mo.month_key and m.status = 'ready'
    order by m.is_favorite desc, m.captured_at desc, m.id
    limit 1
  ) cover on true
  order by mo.month_key desc;
$$;

revoke execute on function public.get_couple_month_summaries(uuid) from public, anon, authenticated;
grant execute on function public.get_couple_month_summaries(uuid) to service_role;
