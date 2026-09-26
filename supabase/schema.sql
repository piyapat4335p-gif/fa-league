-- FA League: run once in the SQL Editor of a NEW Supabase project.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'player' check (role in ('admin', 'player')),
  created_at timestamptz not null default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index seasons_one_active on public.seasons ((is_active)) where is_active;
create table public.players (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null check (char_length(btrim(player_name)) between 1 and 60),
  team_name text not null check (char_length(btrim(team_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, season_id),
  unique (season_id, player_name)
);
create index players_user_idx on public.players(user_id);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  home_player_id uuid not null,
  away_player_id uuid not null,
  home_score integer not null check (home_score between 0 and 99),
  away_score integer not null check (away_score between 0 and 99),
  played_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_player_id <> away_player_id),
  foreign key (home_player_id, season_id) references public.players(id, season_id) on delete restrict,
  foreign key (away_player_id, season_id) references public.players(id, season_id) on delete restrict
);
create index matches_season_date_idx on public.matches(season_id, played_at desc);
create index matches_home_idx on public.matches(home_player_id, season_id);
create index matches_away_idx on public.matches(away_player_id, season_id);
create index matches_author_idx on public.matches(created_by);

-- Role is read from a protected table, never from editable user metadata.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'); $$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.profiles (id, display_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), 'player');
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure private.handle_new_user();
-- Also cover users created before this schema was installed.
insert into public.profiles(id, display_name, role)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 60), 'player' from auth.users
on conflict(id) do nothing;

create function private.touch_match() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function private.touch_match() from public, anon, authenticated;
create trigger match_updated before update on public.matches for each row execute procedure private.touch_match();

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

revoke all on public.profiles, public.seasons, public.players, public.matches from anon, authenticated;
grant select on public.seasons, public.players, public.matches to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert on public.seasons, public.players, public.matches to authenticated;
grant update (name) on public.seasons to authenticated;
grant update (player_name, team_name, user_id) on public.players to authenticated;
grant update (home_player_id, away_player_id, home_score, away_score, played_at) on public.matches to authenticated;
grant delete on public.players, public.matches to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
-- No profile INSERT/UPDATE/DELETE policy: users cannot promote themselves.
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
create policy players_read on public.players for select to anon, authenticated using (true);
create policy matches_read on public.matches for select to anon, authenticated using (true);
create policy seasons_admin_insert on public.seasons for insert to authenticated with check ((select private.is_admin()));
create policy seasons_admin_update on public.seasons for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy players_admin_insert on public.players for insert to authenticated with check ((select private.is_admin()));
create policy players_admin_update on public.players for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy players_admin_delete on public.players for delete to authenticated using ((select private.is_admin()));
create policy matches_member_insert on public.matches for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid())));
create policy matches_admin_update on public.matches for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy matches_admin_delete on public.matches for delete to authenticated using ((select private.is_admin()));

-- Both changes are in one transaction; the advisory lock serializes activation.
create function public.activate_season(target_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not private.is_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(202620);
  if not exists(select 1 from public.seasons where id = target_id) then raise exception 'Season not found'; end if;
  update public.seasons set is_active = false where is_active;
  update public.seasons set is_active = true where id = target_id;
end; $$;
revoke all on function public.activate_season(uuid) from public, anon;
grant execute on function public.activate_season(uuid) to authenticated;

-- Administrators can manage other confirmed league members, but cannot alter their own role.
create function public.set_profile_role(target_id uuid, target_role text) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not private.is_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  if target_role not in ('admin', 'player') then raise exception 'Invalid role' using errcode = '22023'; end if;
  if target_id = (select auth.uid()) then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = target_id) then raise exception 'Member not found' using errcode = 'P0002'; end if;
  update public.profiles set role = target_role where id = target_id;
end; $$;
revoke all on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;
commit;
