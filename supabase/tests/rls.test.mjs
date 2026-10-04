// Applies every migration to an in-process Postgres (PGlite) with a minimal
// emulation of Supabase's auth schema and roles, then exercises RLS policies,
// the recap job queue, share links and the rate limiter.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const dir = new URL('../migrations/', import.meta.url);
const migration = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  .map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const db = new PGlite();
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ok  ', m); else { failures++; console.log('  FAIL', m); } };
async function expectErr(sql, params, m, match) {
  try { await db.query(sql, params); ok(false, m + ' (no error)'); }
  catch (e) { ok(!match || String(e.message).includes(match), m + ' -> ' + e.message); }
}
// --- Supabase emulation ---
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
`);
await db.exec(migration);
console.log('migration applied');
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', X='00000000-0000-0000-0000-0000000000ff';
const C1='10000000-0000-0000-0000-000000000001', C2='20000000-0000-0000-0000-000000000002';
await db.exec(`insert into auth.users values ('${A}','a@x'),('${B}','b@x'),('${X}','x@x'),('00000000-0000-0000-0000-0000000000ee','e@x');
insert into couples (id,name) values ('${C1}','Us'),('${C2}','Them');
insert into profiles (user_id,couple_id,display_name) values ('${A}','${C1}','A'),('${B}','${C1}','B'),('${X}','${C2}','X');`);
await expectErr(`insert into profiles (user_id,couple_id,display_name) values ('00000000-0000-0000-0000-0000000000ee','${C1}','E')`, [], 'third member rejected', 'two members');

async function as(user, role = 'authenticated') {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false); select set_config('request.jwt.claim.role', '${role}', false); set role ${role};`);
}
const mem = (couple, uploader, day, hash) => db.query(
  `insert into memories (couple_id, uploaded_by, captured_day, captured_at, width, height, content_hash) values ($1,$2,$3,$4,100,100,$5) returning id, month_key`,
  [couple, uploader, day, day + 'T12:00:00Z', hash ?? null]);

await as(A);
const m1 = await mem(C1, A, '2026-10-04', 'a'.repeat(64));
ok(m1.rows[0].month_key === '2026-10', 'month_key generated: ' + m1.rows[0].month_key);
await mem(C1, A, '2026-10-05'); await mem(C1, A, '2026-09-30');
await expectErr(`insert into memories (couple_id, uploaded_by, captured_day, captured_at, width, height) values ('${C2}','${A}','2026-10-01',now(),1,1)`, [], 'A cannot insert into C2', 'row-level security');
await expectErr(`insert into memories (couple_id, uploaded_by, captured_day, captured_at, width, height) values ('${C1}','${B}','2026-10-01',now(),1,1)`, [], 'A cannot impersonate uploader', 'row-level security');
await expectErr(`insert into memories (couple_id, uploaded_by, captured_day, captured_at, width, height, content_hash) values ('${C1}','${A}','2026-10-01',now(),1,1,'${'a'.repeat(64)}')`, [], 'duplicate content hash rejected', 'duplicate');
const mid = m1.rows[0].id;
await db.query(`insert into memory_assets (memory_id,couple_id,variant,storage_key,width,height,file_size,mime_type) values ($1,$2,'thumb','k1',10,10,5,'image/webp')`, [mid, C1]);
await expectErr(`update memories set uploaded_by='${B}' where id='${mid}'`, [], 'uploader immutable', 'immutable');
let r = await db.query(`update memories set caption='hi', captured_day='2026-08-01' where id=$1 returning month_key`, [mid]);
ok(r.rows[0].month_key === '2026-08', 'month_key follows date edit');
await db.query(`update memories set captured_day='2026-10-04' where id=$1`, [mid]);
r = await db.query(`select * from get_month_summaries()`);
ok(r.rows.length === 2 && r.rows[0].month_key === '2026-10' && Number(r.rows[0].memory_count) === 2 && Number(r.rows[0].day_count) === 2, 'summaries: ' + JSON.stringify(r.rows.map(x => [x.month_key, Number(x.memory_count), Number(x.day_count), x.cover_thumb_key, x.recap_status])));

await as(X);
r = await db.query(`select count(*)::int n from memories`); ok(r.rows[0].n === 0, 'X sees no C1 memories');
r = await db.query(`update memories set caption='hacked' returning id`); ok(r.rows.length === 0, 'X cannot update C1 memories');
r = await db.query(`delete from memories returning id`); ok(r.rows.length === 0, 'X cannot delete C1 memories');
r = await db.query(`select count(*)::int n from memory_assets`); ok(r.rows[0].n === 0, 'X sees no C1 assets');
r = await db.query(`select count(*)::int n from profiles`); ok(r.rows[0].n === 1, 'X sees only own couple profiles');
await expectErr(`select enqueue_recap('${C1}','2026-10')`, [], 'X cannot enqueue C1 recap', 'not_authorized');
await expectErr(`select create_share_link('${C1}','2026-10','${'b'.repeat(64)}','enc')`, [], 'X cannot share C1 month', 'not_authorized');
await expectErr(`insert into monthly_recaps (couple_id, month_key) values ('${C2}','2026-10')`, [], 'no direct recap writes', 'row-level security');
await expectErr(`select claim_recap_job('w')`, [], 'authenticated cannot claim jobs', 'permission denied');
await expectErr(`select check_rate_limit('k',1,60)`, [], 'authenticated cannot call rate limiter', 'permission denied');

await as(null, 'anon');
await expectErr(`select * from memories`, [], 'anon cannot read memories', 'permission denied');
await expectErr(`select * from share_links`, [], 'anon cannot read share links', 'permission denied');
await expectErr(`select enqueue_recap('${C1}','2026-10')`, [], 'anon cannot enqueue', 'permission denied');
await expectErr(`select get_month_summaries()`, [], 'anon cannot read summaries', 'permission denied');

await as(A);
await expectErr(`select enqueue_recap('${C1}','2026-07')`, [], 'empty month cannot be generated', 'no_memories');
await expectErr(`select enqueue_recap('${C1}','2026-10','scheduled')`, [], 'members cannot fake scheduled', 'not_authorized');
r = await db.query(`select (enqueue_recap('${C1}','2026-10')).*`); ok(r.rows[0].status === 'queued', 'enqueue -> queued');
const rid = r.rows[0].id;
r = await db.query(`select (enqueue_recap('${C1}','2026-10')).*`); ok(r.rows[0].status === 'queued' && r.rows[0].id === rid, 'second enqueue deduped');
r = await db.query(`select count(*)::int n from monthly_recaps`); ok(r.rows[0].n === 1, 'single recap row');

await as(null, 'service_role');
r = await db.query(`select * from claim_recap_job('w1')`); ok(r.rows.length === 1 && r.rows[0].status === 'processing' && r.rows[0].attempts === 1, 'worker claims job');
r = await db.query(`select * from claim_recap_job('w2')`); ok(r.rows.length === 0, 'no double claim');
r = await db.query(`select (enqueue_recap('${C1}','2026-10','scheduled')).*`); ok(r.rows[0].status === 'processing', 'scheduled enqueue does not disturb processing job');
await db.query(`update monthly_recaps set heartbeat_at = now() - interval '1 hour' where id=$1`, [rid]);
r = await db.query(`select * from claim_recap_job('w2', 900)`); ok(r.rows.length === 1 && r.rows[0].attempts === 2 && r.rows[0].locked_by === 'w2', 'stale job recovered and reclaimed');
await db.query(`update monthly_recaps set heartbeat_at = now() - interval '1 hour', attempts = 3 where id=$1`, [rid]);
r = await db.query(`select * from claim_recap_job('w3', 900)`); ok(r.rows.length === 0, 'exhausted job not reclaimed');
r = await db.query(`select status, error_message from monthly_recaps where id=$1`, [rid]); ok(r.rows[0].status === 'failed', 'exhausted job failed: ' + r.rows[0].error_message);
r = await db.query(`select (enqueue_recap('${C1}','2026-10','scheduled')).*`); ok(r.rows[0].status === 'failed', 'scheduled run leaves failed job alone');
await db.query(`update monthly_recaps set status='ready', video_storage_key='v' where id=$1`, [rid]);
r = await db.query(`select (enqueue_recap('${C1}','2026-10','scheduled')).*`); ok(r.rows[0].status === 'ready', 'scheduled run idempotent on ready');
r = await db.query(`select check_rate_limit('k',2,60) a, check_rate_limit('k',2,60) b, check_rate_limit('k',2,60) c`); ok(r.rows[0].a && r.rows[0].b && !r.rows[0].c, 'rate limiter blocks 3rd hit');

await as(A);
r = await db.query(`select (enqueue_recap('${C1}','2026-10')).*`); ok(r.rows[0].status === 'ready', 'manual enqueue w/o force keeps ready');
r = await db.query(`select (enqueue_recap('${C1}','2026-10','manual',true)).*`); ok(r.rows[0].status === 'queued' && r.rows[0].attempts === 0 && r.rows[0].video_storage_key === 'v', 'regenerate re-queues, keeps old video');
await db.query(`select create_share_link('${C1}','2026-10','${'b'.repeat(64)}','enc')`);
await db.query(`select create_share_link('${C1}','2026-10','${'c'.repeat(64)}','enc', true)`);
r = await db.query(`select token_hash, active from share_links`);
ok(r.rows.filter(x => x.active).length === 1 && r.rows.find(x => x.active).token_hash.startsWith('c'), 'regenerate revokes old link');
await db.query(`select revoke_share_link('${C1}','2026-10')`);
r = await db.query(`select count(*)::int n from share_links where active`); ok(r.rows[0].n === 0, 'revoke deactivates');
r = await db.query(`update share_links set active = true returning id`); ok(r.rows.length === 0, 'no direct share writes');
r = await db.query(`delete from memories where id=$1 returning id`, [mid]); ok(r.rows.length === 1, 'A can delete own memory');
await db.exec(`reset role`);
r = await db.query(`select count(*)::int n from memory_assets`); ok(r.rows[0].n === 0, 'assets cascade on delete');
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL DB TESTS PASSED');
process.exit(failures ? 1 : 0);
