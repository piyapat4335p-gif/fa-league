import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Real PostgreSQL engine, minimal Supabase auth scaffold; no production data.
const db = new PGlite();
const playerId = '20000000-0000-4000-8000-000000000001';
const adminId = '20000000-0000-4000-8000-000000000002';
const season = '00000000-0000-4000-8000-000000000020';
const home = '00000000-0000-4000-8000-000000000001';
const away = '00000000-0000-4000-8000-000000000002';
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
await db.exec(`insert into auth.users values ('${playerId}', '{"display_name":"Player","role":"admin"}'), ('${adminId}', '{"display_name":"Admin"}');
  update public.profiles set role='admin' where id='${adminId}';`);
const profile = await db.query(`select role from public.profiles where id='${playerId}'`);
assert.equal(profile.rows[0].role, 'player', 'metadata cannot grant admin');
let count = 0;
async function asRole(role, id, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${id || ''}', false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
}
async function denied(role, id, sql) { await assert.rejects(asRole(role, id, sql)); count++; }
const insert = (id, scores='1,0', player=away, author=playerId) => `insert into public.matches(id,season_id,home_player_id,away_player_id,home_score,away_score,created_by) values ('${id}','${season}','${home}','${player}',${scores},'${author}')`;
const newId='30000000-0000-4000-8000-000000000001';
assert.equal((await asRole('anon', null, 'select * from public.matches')).rows.length,30); count++;
await denied('anon', null, insert(newId));
await denied('anon', null, 'select * from public.profiles');
await denied('authenticated', playerId, `update public.profiles set role='admin' where id='${playerId}'`);
await denied('authenticated', playerId, `select public.set_profile_role('${playerId}', 'admin')`);
await asRole('authenticated', adminId, `select public.set_profile_role('${playerId}', 'admin')`); count++;
assert.equal((await db.query(`select role from public.profiles where id='${playerId}'`)).rows[0].role, 'admin'); count++;
await denied('authenticated', adminId, `select public.set_profile_role('${adminId}', 'player')`);
await asRole('authenticated', adminId, `select public.set_profile_role('${playerId}', 'player')`); count++;
assert.equal((await db.query(`select role from public.profiles where id='${playerId}'`)).rows[0].role, 'player'); count++;
await denied('authenticated', playerId, `insert into public.seasons(name) values ('Unauthorized')`);
await denied('authenticated', playerId, `insert into public.players(season_id,player_name,team_name) values ('${season}','Unauthorized','Team')`);
await denied('authenticated', playerId, `select public.activate_season('${season}')`);
await denied('authenticated', playerId, insert(newId,'-1,0'));
await denied('authenticated', playerId, insert(newId,'1,0',home));
await denied('authenticated', playerId, insert(newId,'1,0',away,adminId));
await asRole('authenticated', playerId, insert(newId)); count++;
assert.equal((await asRole('authenticated', playerId, `update public.matches set home_score=5 where id='${newId}' returning id`)).rows.length,0); count++;
assert.equal((await asRole('authenticated', playerId, `delete from public.matches where id='${newId}' returning id`)).rows.length,0); count++;
assert.equal((await asRole('authenticated', playerId, `delete from public.matches where created_by is null returning id`)).rows.length,0); count++;
assert.equal((await asRole('authenticated', adminId, `update public.matches set home_score=4 where id='${newId}' returning id`)).rows.length,1); count++;
await denied('authenticated', adminId, `update public.matches set created_by='${adminId}' where id='${newId}'`);
assert.equal((await asRole('authenticated', adminId, `delete from public.matches where id='${newId}' returning id`)).rows.length,1); count++;
await denied('authenticated', adminId, `delete from public.players where id='${home}'`);
const newSeason='40000000-0000-4000-8000-000000000001';
const newPlayer='50000000-0000-4000-8000-000000000001';
await asRole('authenticated',adminId,`insert into public.seasons(id,name) values ('${newSeason}','Season 21')`);
await asRole('authenticated',adminId,`insert into public.players(id,season_id,player_name,team_name) values ('${newPlayer}','${newSeason}','Test','Test FC')`);
await denied('authenticated',playerId,insert(newId,'1,0',newPlayer));
await asRole('authenticated',adminId,`select public.activate_season('${newSeason}')`);
assert.deepEqual((await db.query('select id from public.seasons where is_active')).rows,[{id:newSeason}]); count++;
console.log(`Database schema + seed passed; ${count} RLS, constraints and role checks passed.`);
await db.close();
