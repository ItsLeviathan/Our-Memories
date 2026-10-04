-- =============================================================================
-- One-time setup of your private memory space.
--
-- 1. In the Supabase dashboard: Authentication → Providers → Email:
--      disable "Allow new users to sign up" (there is no public registration).
-- 2. Authentication → Users → "Add user": create both accounts (email + password,
--    tick "Auto Confirm User").
-- 3. Replace the emails / names below and run this file in the SQL editor.
-- =============================================================================

with space as (
  insert into public.couples (name) values ('Our Memories') returning id
)
insert into public.profiles (user_id, couple_id, display_name)
select u.id, space.id, p.display_name
from space
cross join (values
  ('you@example.com',     'You'),
  ('partner@example.com', 'Partner')
) as p(email, display_name)
join auth.users u on lower(u.email) = lower(p.email);

-- Verify: should return two rows.
select p.display_name, u.email, c.name
from public.profiles p
join auth.users u on u.id = p.user_id
join public.couples c on c.id = p.couple_id;
