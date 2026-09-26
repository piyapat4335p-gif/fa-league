-- Run once in Supabase SQL Editor after schema.sql.
-- It adds the secure RPC used by the admin-management screen.
create or replace function public.set_profile_role(target_id uuid, target_role text) returns void
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
