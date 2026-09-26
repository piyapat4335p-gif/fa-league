-- Run once in Supabase SQL Editor. Imports final standings only; it does not invent missing match-by-match results.
begin;
create table if not exists public.historical_standings (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  played integer not null check (played >= 0), won integer not null check (won >= 0), drawn integer not null check (drawn >= 0), lost integer not null check (lost >= 0),
  gf integer not null check (gf >= 0), ga integer not null check (ga >= 0), points integer not null check (points >= 0),
  primary key (season_id, player_id)
);
alter table public.historical_standings enable row level security;
grant select on public.historical_standings to anon, authenticated;
grant insert, update, delete on public.historical_standings to authenticated;
drop policy if exists historical_standings_read on public.historical_standings;
drop policy if exists historical_standings_admin_write on public.historical_standings;
create policy historical_standings_read on public.historical_standings for select to anon, authenticated using (true);
create policy historical_standings_admin_write on public.historical_standings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

with source(season,player,team,pl,w,d,l,gf,ga,pts) as (values
('FA League 20','Ta','Gunner',10,8,1,1,26,8,25),('FA League 20','Nicky','Udon FC',11,6,3,2,17,13,21),('FA League 20','Nice','HumNoiy',11,4,3,4,14,11,15),('FA League 20','คิคุง','TikungShow2',12,5,0,7,15,19,15),('FA League 20','กร','Korn',8,2,2,4,12,14,8),('FA League 20','OB','Sakamoto',8,2,1,5,4,14,7),('FA League 20','Pok','PokkyShow',8,2,0,6,4,13,6),
('FA League 19','กร','Korn',12,8,3,1,27,12,27),('FA League 19','Nice','HumNoiy',11,6,3,2,23,16,21),('FA League 19','Nicky','Udon FC',12,5,3,4,15,14,18),('FA League 19','Pok','PokkyShow',11,4,3,4,21,19,15),('FA League 19','Ta','Gunner',10,3,3,4,13,14,12),('FA League 19','คิคุง','TikungShow2',12,2,0,6,18,22,6),('FA League 19','OB','Sakamoto',10,1,0,9,7,27,3),
('FA League 18','Nicky','Udon FC',10,6,3,1,23,14,21),('FA League 18','Nice','HumNoiy',10,4,4,2,16,12,16),('FA League 18','คิคุง','TikungShow2',10,4,1,5,15,13,13),('FA League 18','Pok','PokkyShow',9,2,5,2,14,14,11),('FA League 18','Ta','Gunner',8,1,4,3,9,11,7),('FA League 18','OB','Sakamoto',9,1,3,5,8,21,6),
('FA League 17','Nice','HumNoiy',16,10,3,3,39,19,33),('FA League 17','คิคุง','TikungShow2',16,9,1,6,24,18,28),('FA League 17','Nicky','Udon FC',16,8,3,5,31,22,27),('FA League 17','OB','Sakamoto',16,8,1,7,21,25,25),('FA League 17','Pok','PokkyShow',16,7,2,7,31,25,23),('FA League 17','Ta','Gunner',15,7,2,6,26,25,23),('FA League 17','กร','Korn',14,6,1,7,37,34,19),('FA League 17','โฟร์','Liver',13,4,0,9,13,20,12),('FA League 17','Bell','Lum luk ka',16,3,1,12,9,43,10),
('FA League 16','กร','Korn',15,11,2,2,39,15,35),('FA League 16','Nicky','Udon FC',14,7,6,1,35,24,27),('FA League 16','คิคุง','TikungShow2',16,6,4,6,25,27,22),('FA League 16','Ta','Gunner',14,6,2,6,26,25,20),('FA League 16','Pok','PokkyShow',15,6,2,7,21,27,20),('FA League 16','OB','Sakamoto',15,5,3,7,25,27,18),('FA League 16','Nice','HumNoiy',15,5,3,7,29,36,18),('FA League 16','Bell','Lum luk ka',14,4,1,9,22,30,13),('FA League 16','โฟร์','Liver',8,1,1,6,8,19,4)
), new_seasons as (insert into public.seasons(name,is_active) select distinct season,false from source where not exists(select 1 from public.seasons s where s.name=source.season) returning id,name)
insert into public.players(season_id,player_name,team_name)
select s.id,source.player,source.team from source join public.seasons s on s.name=source.season
where not exists(select 1 from public.players p where p.season_id=s.id and p.player_name=source.player);
with source(season,player,pl,w,d,l,gf,ga,pts) as (values
('FA League 20','Ta',10,8,1,1,26,8,25),('FA League 20','Nicky',11,6,3,2,17,13,21),('FA League 20','Nice',11,4,3,4,14,11,15),('FA League 20','คิคุง',12,5,0,7,15,19,15),('FA League 20','กร',8,2,2,4,12,14,8),('FA League 20','OB',8,2,1,5,4,14,7),('FA League 20','Pok',8,2,0,6,4,13,6),
('FA League 19','กร',12,8,3,1,27,12,27),('FA League 19','Nice',11,6,3,2,23,16,21),('FA League 19','Nicky',12,5,3,4,15,14,18),('FA League 19','Pok',11,4,3,4,21,19,15),('FA League 19','Ta',10,3,3,4,13,14,12),('FA League 19','คิคุง',12,2,0,6,18,22,6),('FA League 19','OB',10,1,0,9,7,27,3),
('FA League 18','Nicky',10,6,3,1,23,14,21),('FA League 18','Nice',10,4,4,2,16,12,16),('FA League 18','คิคุง',10,4,1,5,15,13,13),('FA League 18','Pok',9,2,5,2,14,14,11),('FA League 18','Ta',8,1,4,3,9,11,7),('FA League 18','OB',9,1,3,5,8,21,6),
('FA League 17','Nice',16,10,3,3,39,19,33),('FA League 17','คิคุง',16,9,1,6,24,18,28),('FA League 17','Nicky',16,8,3,5,31,22,27),('FA League 17','OB',16,8,1,7,21,25,25),('FA League 17','Pok',16,7,2,7,31,25,23),('FA League 17','Ta',15,7,2,6,26,25,23),('FA League 17','กร',14,6,1,7,37,34,19),('FA League 17','โฟร์',13,4,0,9,13,20,12),('FA League 17','Bell',16,3,1,12,9,43,10),
('FA League 16','กร',15,11,2,2,39,15,35),('FA League 16','Nicky',14,7,6,1,35,24,27),('FA League 16','คิคุง',16,6,4,6,25,27,22),('FA League 16','Ta',14,6,2,6,26,25,20),('FA League 16','Pok',15,6,2,7,21,27,20),('FA League 16','OB',15,5,3,7,25,27,18),('FA League 16','Nice',15,5,3,7,29,36,18),('FA League 16','Bell',14,4,1,9,22,30,13),('FA League 16','โฟร์',8,1,1,6,8,19,4)
) insert into public.historical_standings select s.id,p.id,pl,w,d,l,gf,ga,pts from source join public.seasons s on s.name=source.season join public.players p on p.season_id=s.id and p.player_name=source.player on conflict do nothing;
commit;
