-- Run once in Supabase SQL Editor. Payment notes are visible only to league administrators.
begin;
create table if not exists public.player_fees (
  player_id uuid primary key references public.players(id) on delete cascade,
  paid boolean not null default false,
  note text not null default '' check (char_length(note) <= 160),
  updated_at timestamptz not null default now()
);
alter table public.player_fees enable row level security;
revoke all on public.player_fees from anon, authenticated;
grant select, insert, update, delete on public.player_fees to authenticated;
drop policy if exists player_fees_admin_only on public.player_fees;
create policy player_fees_admin_only on public.player_fees for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
commit;
