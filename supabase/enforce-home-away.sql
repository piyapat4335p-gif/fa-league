-- Run once in Supabase SQL Editor for an existing FA League project.
-- Existing duplicate results are kept so an admin can review and delete the wrong one.
-- From this point onward, each pairing can have at most one match in each direction.
begin;

create or replace function private.enforce_home_away_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pair_key text;
begin
  pair_key := new.season_id::text || ':' || least(new.home_player_id::text, new.away_player_id::text) || ':' || greatest(new.home_player_id::text, new.away_player_id::text);
  perform pg_advisory_xact_lock(hashtextextended(pair_key, 0));

  if exists (
    select 1 from public.matches m
    where m.season_id = new.season_id
      and m.home_player_id = new.home_player_id
      and m.away_player_id = new.away_player_id
      and m.id <> new.id
  ) then
    raise exception 'This home fixture has already been recorded. Swap home and away players.' using errcode = '23505';
  end if;

  if 2 <= (
    select count(*) from public.matches m
    where m.season_id = new.season_id
      and m.id <> new.id
      and ((m.home_player_id = new.home_player_id and m.away_player_id = new.away_player_id)
        or (m.home_player_id = new.away_player_id and m.away_player_id = new.home_player_id))
  ) then
    raise exception 'This pairing has already completed both home and away fixtures.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_home_away_schedule on public.matches;
create trigger enforce_home_away_schedule
before insert or update of season_id, home_player_id, away_player_id on public.matches
for each row execute function private.enforce_home_away_schedule();

commit;
